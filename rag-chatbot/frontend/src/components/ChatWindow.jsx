import { useEffect, useRef } from "react";
import { FiCpu } from "react-icons/fi";
import ChatMessage from "./ChatMessage.jsx";
import ChatInput from "./ChatInput.jsx";

export default function ChatWindow({ messages, loading, onSend, hasDocuments }) {
  const bottomRef = useRef(null);

  // Scroll to the newest message whenever messages change or loading starts.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-slate-50/70 to-white">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-7 sm:px-6">
          {messages.length === 0 && (
            <div className="mx-auto mt-16 max-w-xl rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-sm sm:mt-24 sm:p-10">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"><FiCpu size={24} /></div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                {hasDocuments ? "Ask anything about your documents" : "Upload a PDF to get started"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {hasDocuments
                  ? "Answers come only from the PDFs you uploaded, with page references."
                  : "Use the sidebar to add a PDF, then ask questions about it here."}
              </p>
            </div>
          )}

          {messages.map((m) => (
            <ChatMessage key={m.id} message={m} />
          ))}

          {loading && (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                <FiCpu />
              </div>
              <div className="flex gap-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm" aria-label="Thinking">
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <ChatInput onSend={onSend} disabled={loading} />
    </div>
  );
}
