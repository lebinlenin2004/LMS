import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getErrorMessage } from "../services/api.js";
import { requestPasswordReset } from "../services/api.js";
import { Button, Field, inputClass, Notice } from "../components/ui.jsx";

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  if (user) return <Navigate to="/courses" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      navigate("/courses");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const forgotPassword = async () => {
    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }
    setBusy(true);
    setError("");
    setResetMessage("");
    try {
      const result = await requestPasswordReset(email);
      setResetMessage(result.message);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden bg-gradient-to-br from-slate-100 via-white to-emerald-50 p-4 sm:p-8">
      <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-emerald-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-cyan-100/50 blur-3xl" />
      <form onSubmit={submit} className="relative w-full max-w-md space-y-5 rounded-3xl border border-white/80 bg-white/90 p-7 shadow-2xl shadow-slate-900/10 backdrop-blur sm:p-9">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-sm font-bold tracking-tight text-white shadow-lg shadow-emerald-600/20">AC</div>
          <div><p className="text-sm font-semibold text-slate-900">Academic Chat</p><p className="text-xs text-slate-500">Course workspace</p></div>
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Welcome back</h1>
          <p className="mt-1 text-sm leading-6 text-slate-500">Sign in with the account your administrator created for you.</p>
        </div>
        {location.state?.message && <Notice type="success">{location.state.message}</Notice>}
        <Notice>{error}</Notice>
        <Notice type="success">{resetMessage}</Notice>
        <Field label="Email">
          <input className={inputClass} type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <input className={inputClass} type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Logging in..." : "Log in"}
        </Button>
        <button type="button" disabled={busy} onClick={forgotPassword} className="w-full rounded-lg py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-50">
          Forgot password?
        </button>
      </form>
    </div>
  );
}
