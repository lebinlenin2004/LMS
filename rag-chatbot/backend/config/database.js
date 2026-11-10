// MongoDB connection + collection helpers.
import { MongoClient } from "mongodb";

export const DB_NAME = "rag_chatbot";
export const CHUNKS_COLLECTION = "document_chunks"; // text chunks + embeddings
export const DOCUMENTS_COLLECTION = "documents"; // one record per uploaded PDF (belongs to a course)
export const USERS_COLLECTION = "users";
export const COURSES_COLLECTION = "courses";
export const CHATS_COLLECTION = "chats";
export const REVIEWS_COLLECTION = "reviews";

// Must match GEMINI_EMBEDDING_DIMENSIONS in .env and the active Atlas Vector Search index.
export const EMBEDDING_DIMENSIONS = Number(process.env.GEMINI_EMBEDDING_DIMENSIONS || 768);

let client = null;

export async function connectDatabase() {
  if (client) return client;
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing. Copy .env.example to .env and fill it in.");
  }
  client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  console.log("✅ Connected to MongoDB Atlas");
  return client;
}

function getDb() {
  if (!client) throw new Error("Database not connected. Call connectDatabase() first.");
  return client.db(DB_NAME);
}

export const getChunksCollection = () => getDb().collection(CHUNKS_COLLECTION);
export const getDocumentsCollection = () => getDb().collection(DOCUMENTS_COLLECTION);
export const getUsersCollection = () => getDb().collection(USERS_COLLECTION);
export const getCoursesCollection = () => getDb().collection(COURSES_COLLECTION);
export const getChatsCollection = () => getDb().collection(CHATS_COLLECTION);
export const getReviewsCollection = () => getDb().collection(REVIEWS_COLLECTION);

export async function closeDatabase() {
  if (client) await client.close();
  client = null;
}

// The vector index has two kinds of fields:
//  - "vector": the embedding we search by similarity
//  - "filter": metadata we can restrict a search to (here: only chunks of ONE course)
export const vectorIndexDefinition = {
  fields: [
    { type: "vector", path: "embedding", numDimensions: EMBEDDING_DIMENSIONS, similarity: "cosine" },
    { type: "filter", path: "courseId" },
    { type: "filter", path: "embeddingModel" },
  ],
};

// Creates collections, normal indexes, and the Atlas Vector Search index.
// If the vector index step fails, create/update it manually - see README.
export async function ensureSetup() {
  const db = getDb();
  const existing = (await db.listCollections().toArray()).map((c) => c.name);
  for (const name of [CHUNKS_COLLECTION, DOCUMENTS_COLLECTION, USERS_COLLECTION, COURSES_COLLECTION, CHATS_COLLECTION, REVIEWS_COLLECTION]) {
    if (!existing.includes(name)) await db.createCollection(name);
  }

  await getUsersCollection().createIndex({ email: 1 }, { unique: true });
  await getCoursesCollection().createIndex({ code: 1 }, { unique: true });
  await getCoursesCollection().createIndex({ instructorId: 1 });
  await getCoursesCollection().createIndex({ studentIds: 1 });
  await getChatsCollection().createIndex({ userId: 1, courseId: 1, updatedAt: -1 });
  await getReviewsCollection().createIndex({ internId: 1, date: 1 });
  await getReviewsCollection().createIndex({ advisorId: 1, date: 1 });
  await getChunksCollection().createIndex({ documentId: 1 });
  await getChunksCollection().createIndex({ courseId: 1 });

  // Old version: one global unique hash. Now the same PDF may exist in different courses.
  try {
    await getDocumentsCollection().dropIndex("fileHash_1");
  } catch {
    /* index did not exist - fine */
  }
  await getDocumentsCollection().createIndex({ courseId: 1, fileHash: 1 }, { unique: true });

  const indexName = process.env.VECTOR_INDEX_NAME || "vector_index";
  try {
    const indexes = await getChunksCollection().listSearchIndexes().toArray();
    const current = indexes.find((i) => i.name === indexName);

    if (!current) {
      await getChunksCollection().createSearchIndex({
        name: indexName,
        type: "vectorSearch",
        definition: vectorIndexDefinition,
      });
      console.log(`✅ Created vector search index "${indexName}" (may take ~1 minute to become active)`);
      return;
    }

    // Keep vector dimensions and filters in sync with the active embedding model.
    const hasCourseFilter = current.latestDefinition?.fields?.some((f) => f.path === "courseId");
    const hasEmbeddingModelFilter = current.latestDefinition?.fields?.some((f) => f.path === "embeddingModel");
    const vectorField = current.latestDefinition?.fields?.find((f) => f.path === "embedding");
    if (!hasCourseFilter || !hasEmbeddingModelFilter || vectorField?.numDimensions !== EMBEDDING_DIMENSIONS) {
      await getChunksCollection().updateSearchIndex(indexName, vectorIndexDefinition);
      console.log(`✅ Updated vector index "${indexName}" for Gemini embeddings (wait until Active)`);
    }
  } catch (err) {
    console.warn(`⚠️  Could not auto-create/update the vector index: ${err.message}`);
    console.warn("   Create it manually in the Atlas UI (see README, section 7).");
  }
}
