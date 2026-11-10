// Small shared UI pieces so pages stay short.
export const Page = ({ title, action, children }) => (
  <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
    <div className="mb-7 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
      <div className="min-w-0">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Academic workspace</p>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{title}</h2>
      </div>
      {action}
    </div>
    {children}
  </div>
);

export const Button = ({ variant = "primary", className = "", ...props }) => {
  const styles = {
    primary: "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 hover:shadow",
    secondary: "border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50",
    danger: "border border-red-200 bg-white text-red-600 hover:bg-red-50",
  };
  return (
    <button
      {...props}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    />
  );
};

export const Field = ({ label, children }) => (
  <label className="block text-sm">
    <span className="mb-1.5 block font-semibold text-slate-700">{label}</span>
    {children}
  </label>
);

export const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:bg-slate-50";

export const Notice = ({ type = "error", children }) =>
  children ? (
    <p
      className={`rounded-xl border px-4 py-3 text-sm ${
        type === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}
    >
      {children}
    </p>
  ) : null;

export const Badge = ({ children, color = "slate" }) => {
  const colors = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-700",
    blue: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${colors[color]}`}>{children}</span>;
};
