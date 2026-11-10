import { FiUser, FiCpu, FiFileText } from "react-icons/fi";

export default function ChatMessage({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          isUser ? "bg-slate-800 text-white" : "bg-emerald-600 text-white shadow-sm"
        }`}
      >
        {isUser ? <FiUser /> : <FiCpu />}
      </div>

      <div className={`max-w-[88%] sm:max-w-[80%] ${isUser ? "text-right" : ""}`}>
        <div
          className={`inline-block whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-left text-[15px] leading-relaxed ${
            isUser
              ? "bg-slate-800 text-white shadow-sm"
              : message.isError
                ? "border border-red-200 bg-red-50 text-red-700"
                : "border border-slate-200/80 bg-white text-slate-800 shadow-sm"
          }`}
        >
          {message.content}
        </div>

        {message.sources?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.sources.map((s) => (
              <span
                key={`${s.documentName}-${s.pageNumber}`}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm"
              >
                <FiFileText className="text-slate-400" />
                {s.documentName}, p. {s.pageNumber}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
