import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button, Field, inputClass, Notice } from "../components/ui.jsx";
import { getErrorMessage, resetPassword } from "../services/api.js";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!token) return setError("This password reset link is invalid or has expired.");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    setBusy(true);
    try {
      await resetPassword(token, password);
      navigate("/login", { replace: true, state: { message: "Password updated. You can now sign in." } });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden bg-gradient-to-br from-slate-100 via-white to-emerald-50 p-4 sm:p-8">
      <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-emerald-200/40 blur-3xl" />
      <form onSubmit={submit} className="relative w-full max-w-md space-y-5 rounded-3xl border border-white/80 bg-white/90 p-7 shadow-2xl shadow-slate-900/10 backdrop-blur sm:p-9">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-sm font-bold tracking-tight text-white shadow-lg shadow-emerald-600/20">AC</div>
          <div><p className="text-sm font-semibold text-slate-900">Academic Chat</p><p className="text-xs text-slate-500">Account recovery</p></div>
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Set a new password</h1>
          <p className="mt-1 text-sm leading-6 text-slate-500">Choose a password with at least 8 characters.</p>
        </div>
        <Notice>{error}</Notice>
        <Field label="New password">
          <input className={inputClass} type="password" required minLength={8} maxLength={100} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Confirm new password">
          <input className={inputClass} type="password" required minLength={8} maxLength={100} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </Field>
        <Button type="submit" disabled={busy} className="w-full">{busy ? "Updating..." : "Update password"}</Button>
        <p className="text-center text-sm text-slate-500"><Link to="/login" className="font-medium text-emerald-700 hover:text-emerald-800">Back to sign in</Link></p>
      </form>
    </div>
  );
}
