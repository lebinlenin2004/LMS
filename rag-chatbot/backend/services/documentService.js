// Document ingestion pipeline:
// PDF -> extract text -> clean -> chunk -> embed -> store in MongoDB.
import crypto from "crypto";
import { ObjectId } from "mongodb";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { getChunksCollection, getDocumentsCollection } from "../config/database.js";
import { extractPages } from "../utils/pdfProcessor.js";
import { getVectorStore } from "./embeddingService.js";

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const EMBED_BATCH_SIZE = 50; // keep embedding requests within provider limits
const EMBEDDING_MODEL = () => process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";

export async function listDocuments(courseId) {
  return getDocumentsCollection()
    .find({ courseId: String(courseId), status: "ready" }, { projection: { fileHash: 0 } })
    .sort({ createdAt: -1 })
    .toArray();
}

// Removes one PDF and all of its chunks from the vector store.
export async function deleteDocument(courseId, documentId) {
  const doc = await getDocumentsCollection().findOne({ _id: documentId, courseId: String(courseId) });
  if (!doc) return false;
  await getChunksCollection().deleteMany({ documentId: String(documentId) });
  await getDocumentsCollection().deleteOne({ _id: documentId });
  return true;
}

// courseId ties every document and chunk to ONE course, so students of a course
// can only ever retrieve that course's material.
export async function ingestPdf({ buffer, originalName, courseId, uploadedBy }) {
  courseId = String(courseId);
  if (buffer.subarray(0, 5).toString() !== "%PDF-") {
    const err = new Error("The uploaded file is not a valid PDF.");
    err.statusCode = 400;
    throw err;
  }

  // Avoid duplicate ingestion (per course): the same file content always has the same hash.
  const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");
  const documents = getDocumentsCollection();
  const existing = await documents.findOne({ courseId, fileHash });
  if (existing?.status === "ready" && existing.embeddingModel === EMBEDDING_MODEL()) {
    return { document: existing, duplicate: true };
  }
  if (existing) {
    // Re-uploading a PDF replaces stale vectors created by a previous embedding model.
    await getChunksCollection().deleteMany({ documentId: existing._id.toString() });
    await documents.deleteOne({ _id: existing._id });
  }

  // Save a record first (status "processing"). This is what makes it easy to move
  // ingestion to a background job later: the API could return right here.
  const documentId = new ObjectId();
  await documents.insertOne({
    _id: documentId,
    name: originalName,
    courseId,
    uploadedBy,
    embeddingModel: EMBEDDING_MODEL(),
    fileHash,
    status: "processing",
    createdAt: new Date(),
  });

  try {
    // 1. Extract text per page (so we can remember page numbers).
    const pages = await extractPages(buffer);
    if (pages.length === 0) {
      const err = new Error("No readable text found. Scanned/image-only PDFs are not supported.");
      err.statusCode = 422;
      throw err;
    }

    // 2. Chunking: split long text into ~1000 character pieces with 200 characters
    //    of overlap, so a sentence cut at a boundary still appears whole in a chunk.
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: CHUNK_SIZE,
      chunkOverlap: CHUNK_OVERLAP,
    });
    const pageDocs = pages.map(
      (p) => new Document({ pageContent: p.text, metadata: { pageNumber: p.pageNumber } }),
    );
    const splitDocs = await splitter.splitDocuments(pageDocs);

    // 3. Attach the metadata we want to store with every chunk.
    const chunkDocs = splitDocs.map(
      (doc, chunkIndex) =>
        new Document({
          pageContent: doc.pageContent,
          metadata: {
            courseId, // used as a filter in vector search
            embeddingModel: EMBEDDING_MODEL(),
            documentId: documentId.toString(),
            documentName: originalName,
            pageNumber: doc.metadata.pageNumber,
            chunkIndex,
          },
        }),
    );

    // 4. Embed + store. addDocuments() calls Gemini to turn each chunk into a vector
    //    and inserts { text, embedding, ...metadata } into the document_chunks collection.
    const vectorStore = getVectorStore();
    for (let i = 0; i < chunkDocs.length; i += EMBED_BATCH_SIZE) {
      await vectorStore.addDocuments(chunkDocs.slice(i, i + EMBED_BATCH_SIZE));
    }

    const update = { status: "ready", pageCount: pages.length, chunkCount: chunkDocs.length };
    await documents.updateOne({ _id: documentId }, { $set: update });
    return {
      document: { _id: documentId, name: originalName, createdAt: new Date(), ...update },
      duplicate: false,
    };
  } catch (error) {
    // Roll back so a failed upload leaves no half-ingested data behind.
    await getChunksCollection().deleteMany({ documentId: documentId.toString() });
    await documents.deleteOne({ _id: documentId });
    throw error;
  }
}
