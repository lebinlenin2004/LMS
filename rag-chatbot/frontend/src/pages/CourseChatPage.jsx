import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FiMessageSquare, FiPlus, FiSearch, FiX } from "react-icons/fi";
import ChatWindow from "../components/ChatWindow.jsx";
import { createConversation, fetchConversation, fetchConversations, fetchCourse, fetchDocuments, sendQuestion, getErrorMessage } from "../services/api.js";

let nextId = 1;

export default function CourseChatPage() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [docCount, setDocCount] = useState(0);
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [search, setSearch] = useState("");
  const [refreshHistory, setRefreshHistory] = useState(0);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setCourse(null);
    setMessages([]);
    setConversationId(null);
    setError("");
    Promise.all([fetchCourse(courseId), fetchDocuments(courseId)])
      .then(([c, docs]) => {
        if (cancelled) return;
        setCourse(c);
        setDocCount(docs.length);
      })
      .catch((e) => { if (!cancelled) setError(getErrorMessage(e)); });
    return () => { cancelled = true; };
  }, [courseId]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      fetchConversations(courseId, search)
        .then((items) => { if (!cancelled) setConversations(items); })
        .catch((e) => { if (!cancelled) setError(getErrorMessage(e)); });
    }, search ? 200 : 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [courseId, search, refreshHistory]);

  const startNewChat = async () => {
    setError("");
    setSwitching(true);
    try {
      const conversation = await createConversation(courseId);
      setConversationId(String(conversation.id));
      setMessages([]);
      setHistoryOpen(false);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSwitching(false);
    }
  };

  const openConversation = async (id) => {
    if (id === conversationId || switching || loading) return;
    setSwitching(true);
    setError("");
    try {
      const conversation = await fetchConversation(courseId, id);
      setConversationId(String(conversation.id));
      setMessages((conversation.messages || []).map((message) => ({
        ...message,
        id: message.id || nextId++,
      })));
      setHistoryOpen(false);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSwitching(false);
    }
  };

  const handleSend = async (question) => {
    if (loading || switching) return;
    setError("");
    setLoading(true);
    let activeId = conversationId;
    try {
      if (!activeId) {
        const conversation = await createConversation(courseId);
        activeId = String(conversation.id);
        setConversationId(activeId);
      }
      setMessages((prev) => [...prev, { id: nextId++, role: "user", content: question }]);
      const data = await sendQuestion(courseId, activeId, question);
      setMessages((prev) => [...prev, { id: nextId++, role: "assistant", content: data.answer, sources: data.sources }]);
      setRefreshHistory((v) => v + 1);
    } catch (e) {
      setMessages((prev) => [...prev, { id: nextId++, role: "assistant", content: getErrorMessage(e), isError: true }]);
    } finally {
      setLoading(false);
    }
  };

  if (error && !course) return <p className="p-8 text-red-600">{error}</p>;
  if (!course) return <p className="p-8 text-slate-500">Loading...</p>;

  return (
    <div className="relative flex h-full min-h-0 bg-white">
      <aside className={`${historyOpen ? "flex" : "hidden"} absolute inset-y-0 left-0 z-10 w-72 shrink-0 flex-col border-r border-slate-200 bg-slate-50/95 p-4 shadow-xl backdrop-blur md:static md:shadow-none md:bg-slate-50`}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="px-1 text-sm font-semibold text-slate-700">Chat history</h2>
          <button onClick={() => setHistoryOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 md:hidden" aria-label="Close chat history"><FiX /></button>
        </div>
        <button
          onClick={startNewChat}
          disabled={switching || loading}
          className="mb-3 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
        >
          <FiPlus /> New chat
        </button>
        <label className="relative mb-3 block">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
          />
        </label>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {conversations.map((item) => {
            const id = String(item._id);
            return (
              <button
                key={id}
                onClick={() => openConversation(id)}
                disabled={switching || loading}
                className={`w-full rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-200/80 disabled:opacity-50 ${id === conversationId ? "bg-white shadow-sm ring-1 ring-slate-200" : ""}`}
              >
                <span className="flex items-center gap-2 truncate text-sm font-medium text-slate-700"><FiMessageSquare className="shrink-0 text-slate-400" />{item.title || "New chat"}</span>
                {item.lastMessage && <span className="mt-1 block truncate pl-6 text-xs text-slate-500">{item.lastMessage}</span>}
              </button>
            );
          })}
          {conversations.length === 0 && <p className="px-2 py-3 text-xs text-slate-500">{search ? "No matching chats." : "Your conversations will appear here."}</p>}
        </div>
      </aside>

      {historyOpen && <button className="absolute inset-0 z-0 bg-black/20 md:hidden" onClick={() => setHistoryOpen(false)} aria-label="Close chat history overlay" />}

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 bg-white px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setHistoryOpen((v) => !v)} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm transition hover:bg-slate-50" aria-label="Toggle chat history"><FiMessageSquare /></button>
            <div className="min-w-0">
              <p className="truncate font-semibold">{course.title}</p>
              <p className="text-xs text-slate-500">{course.code} · {docCount} {docCount === 1 ? "document" : "documents"}</p>
            </div>
          </div>
          <Link to="/courses" className="shrink-0 text-sm text-emerald-700 hover:underline">All courses</Link>
        </div>
        {error && <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
        <div className="min-h-0 flex-1">
          <ChatWindow messages={messages} loading={loading || switching} onSend={handleSend} hasDocuments={docCount > 0} />
        </div>
      </section>
    </div>
  );
}
