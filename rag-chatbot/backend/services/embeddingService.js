// Embeddings + vector store setup.
//
// An embedding is a list of numbers that represents the meaning of a text.
// Texts with similar meaning get similar numbers, so we can search by meaning.
// MongoDBAtlasVectorSearch is LangChain's wrapper that stores those vectors in
// MongoDB and runs the $vectorSearch query for us.
import { Embeddings } from "@langchain/core/embeddings";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { getChunksCollection } from "../config/database.js";

let embeddings = null;
let vectorStore = null;

const embeddingModel = () => process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
const embeddingDimensions = () => Number(process.env.GEMINI_EMBEDDING_DIMENSIONS || 768);

function normalize(vector) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) throw new Error("Gemini returned an empty embedding. Check GOOGLE_API_KEY and Gemini API access.");
  return vector.map((value) => value / magnitude);
}

class GeminiRetrievalEmbeddings extends Embeddings {
  constructor() {
    super({});
    const common = {
      apiKey: process.env.GOOGLE_API_KEY,
      model: embeddingModel(),
      outputDimensionality: embeddingDimensions(),
    };
    this.documentModel = new GoogleGenerativeAIEmbeddings({ ...common, taskType: "RETRIEVAL_DOCUMENT" });
    this.queryModel = new GoogleGenerativeAIEmbeddings({ ...common, taskType: "RETRIEVAL_QUERY" });
  }

  async embedDocuments(texts) {
    const vectors = await this.documentModel.embedDocuments(texts);
    if (vectors.length !== texts.length || vectors.some((v) => v.length !== embeddingDimensions())) {
      throw new Error("Gemini failed to create document embeddings. Check Gemini API access and quota.");
    }
    return vectors.map(normalize);
  }

  async embedQuery(text) {
    const vector = await this.queryModel.embedQuery(text);
    if (vector.length !== embeddingDimensions()) throw new Error("Gemini returned an embedding with an unexpected size.");
    return normalize(vector);
  }
}

export function getEmbeddings() {
  if (!embeddings) {
    embeddings = new GeminiRetrievalEmbeddings();
  }
  return embeddings;
}

export function getVectorStore() {
  if (!vectorStore) {
    vectorStore = new MongoDBAtlasVectorSearch(getEmbeddings(), {
      collection: getChunksCollection(),
      indexName: process.env.VECTOR_INDEX_NAME || "vector_index",
      textKey: "text", // field holding the chunk text
      embeddingKey: "embedding", // field holding the vector
    });
  }
  return vectorStore;
}
