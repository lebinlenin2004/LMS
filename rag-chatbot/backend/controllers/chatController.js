import { answerQuestion } from "../services/ragService.js";
import { getCourseFor, canChat } from "../services/courseService.js";
import { HttpError } from "../utils/helpers.js";
import { ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { getChatsCollection } from "../config/database.js";

const MAX_QUESTION_LENGTH = 1000;

export async function chat(req, res, next) {
  try {
    const { courseId, conversationId, question } = req.body ?? {};

    // Authorization: only the course's instructor or an enrolled student may chat with it.
    const course = await getCourseFor(req.user, courseId, canChat);
    if (course.status !== "active") throw new HttpError(400, "This course is archived.");

    if (typeof question !== "string" || !question.trim()) {
      throw new HttpError(400, "A non-empty 'question' string is required.");
    }
    if (question.length > MAX_QUESTION_LENGTH) {
      throw new HttpError(400, `Question is too long (max ${MAX_QUESTION_LENGTH} characters).`);
    }

    if (typeof conversationId !== "string" || !ObjectId.isValid(conversationId)) {
      throw new HttpError(400, "A valid conversation is required. Start a new chat first.");
    }
    const chats = getChatsCollection();
    const conversation = await chats.findOne({ _id: new ObjectId(conversationId), userId: req.user.id, courseId: String(course._id) });
    if (!conversation) throw new HttpError(404, "Chat not found.");

    const history = (conversation.messages || [])
      .filter((m) => ["user", "assistant"].includes(m.role) && typeof m.content === "string")
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

    const cleanQuestion = question.trim();
    const { answer, sources } = await answerQuestion({ question: cleanQuestion, history, course });
    const now = new Date();
    const firstMessage = (conversation.messages || []).length === 0;
    await chats.updateOne({ _id: conversation._id, userId: req.user.id }, {
      $push: { messages: { $each: [
        { id: randomUUID(), role: "user", content: cleanQuestion, createdAt: now },
        { id: randomUUID(), role: "assistant", content: answer, sources, createdAt: now },
      ] } },
      $set: {
        ...(firstMessage ? { title: cleanQuestion.slice(0, 80) } : {}),
        lastMessage: answer.slice(0, 180),
        updatedAt: now,
      },
    });
    res.json({ success: true, conversationId, answer, sources });
  } catch (error) {
    next(error);
  }
}

async function getChatCourse(req) {
  const course = await getCourseFor(req.user, req.query.courseId || req.body?.courseId, canChat);
  if (course.status !== "active") throw new HttpError(400, "This course is archived.");
  return course;
}

export async function listConversations(req, res, next) {
  try {
    const course = await getChatCourse(req);
    const filter = { userId: req.user.id, courseId: String(course._id), messages: { $exists: true, $ne: [] } };
    const search = String(req.query.search || "").trim().slice(0, 100);
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const matcher = new RegExp(escaped, "i");
      filter.$or = [{ title: matcher }, { messages: { $elemMatch: { content: matcher } } }];
    }
    const conversations = await getChatsCollection()
      .find(filter, { projection: { title: 1, lastMessage: 1, createdAt: 1, updatedAt: 1 } })
      .sort({ updatedAt: -1 })
      .limit(500)
      .toArray();
    res.json({ success: true, conversations });
  } catch (error) { next(error); }
}

export async function createConversation(req, res, next) {
  try {
    const course = await getChatCourse(req);
    const now = new Date();
    const conversation = {
      userId: req.user.id,
      courseId: String(course._id),
      title: "New chat",
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    const { insertedId } = await getChatsCollection().insertOne(conversation);
    res.status(201).json({ success: true, conversation: { id: insertedId, ...conversation } });
  } catch (error) { next(error); }
}

export async function getConversation(req, res, next) {
  try {
    const course = await getChatCourse(req);
    if (!ObjectId.isValid(req.params.conversationId)) throw new HttpError(404, "Chat not found.");
    const conversation = await getChatsCollection().findOne({
      _id: new ObjectId(req.params.conversationId),
      userId: req.user.id,
      courseId: String(course._id),
    });
    if (!conversation) throw new HttpError(404, "Chat not found.");
    res.json({ success: true, conversation: { id: conversation._id, title: conversation.title, messages: conversation.messages } });
  } catch (error) { next(error); }
}
