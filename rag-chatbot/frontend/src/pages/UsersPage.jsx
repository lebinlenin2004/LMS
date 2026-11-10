// Admin: create users, change role/status, reset password, delete.
import { useCallback, useEffect, useState } from "react";
import { fetchUsers, createUser, updateUser, deleteUser, getErrorMessage } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { Page, Button, Field, inputClass, Notice, Badge } from "../components/ui.jsx";

const ROLES = ["student", "instructor", "admin"];
const roleColor = { admin: "red", instructor: "blue", student: "green" };
const emptyForm = { name: "", email: "", password: "", role: "student" };

export default function UsersPage({ staffOnly = false }) {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ ...emptyForm, role: staffOnly ? "instructor" : "student" });
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    try {
      setUsers(await fetchUsers());
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn, okMessage) => {
    setError("");
    setSuccess("");
    try {
      await fn();
      setSuccess(okMessage);
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    await run(() => createUser(form), "User created.");
    setForm({ ...emptyForm, role: staffOnly ? "instructor" : "student" });
  };

  const resetPassword = (u) => {
    const password = window.prompt(`New password for ${u.name} (min 8 characters):`);
    if (password) run(() => updateUser(u.id, { password }), "Password reset.");
  };

  const remove = (u) => {
    if (window.confirm(`Delete ${u.name}? This cannot be undone.`)) run(() => deleteUser(u.id), "User deleted.");
  };

  const roleOptions = staffOnly ? ["instructor", "admin"] : ROLES;
  const shown = users.filter((u) => (staffOnly ? ["instructor", "admin"].includes(u.role) : true) && (filter === "all" || u.role === filter));

  return (
    <Page title={staffOnly ? "Staff" : "Users"} action={<Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Close" : staffOnly ? "Add staff" : "Add user"}</Button>}>
      <div className="space-y-4">
        <Notice>{error}</Notice>
        <Notice type="success">{success}</Notice>

        {showForm && (
          <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 sm:p-6">
            <Field label="Full name">
              <input className={inputClass} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Email">
              <input className={inputClass} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Temporary password (min 8 characters)">
              <input className={inputClass} type="text" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
            <Field label="Role">
              <select className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {roleOptions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit">Create user</Button>
            </div>
          </form>
        )}

        <div className="flex flex-wrap gap-2 text-sm">
          {["all", ...roleOptions].map((r) => (
            <button
              key={r}
              onClick={() => setFilter(r)}
              className={`rounded-full px-3 py-1.5 capitalize transition ${filter === r ? "bg-slate-900 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {r}
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center text-sm text-slate-500">No {staffOnly ? "staff accounts" : "users"} found.</div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {shown.map((u) => {
              const isMe = String(u.id) === String(me.id);
              const initials = u.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
              return (
                <article key={u.id} className="flex flex-col gap-4 px-4 py-4 transition-colors hover:bg-slate-50/80 sm:px-5 lg:flex-row lg:items-center">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-3">
                    <div className="flex min-w-56 flex-1 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 font-semibold text-slate-700">{initials || "U"}</div>
                      <div className="min-w-0"><p className="truncate font-semibold text-slate-900">{u.name}</p><p className="truncate text-sm text-slate-500">{u.email}</p></div>
                    </div>
                    <div className="flex flex-wrap gap-2"><Badge color={roleColor[u.role]}>{u.role}</Badge><Badge color={u.active ? "green" : "amber"}>{u.active ? "Active" : "Deactivated"}</Badge></div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 lg:justify-end lg:border-0 lg:pt-0">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
                      Role
                      <select
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        value={u.role}
                        disabled={isMe}
                        onChange={(e) => run(() => updateUser(u.id, { role: e.target.value }), "Role updated.")}
                      >
                        {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" disabled={isMe} onClick={() => run(() => updateUser(u.id, { active: !u.active }), u.active ? "User deactivated." : "User activated.")}>{u.active ? "Deactivate" : "Activate"}</Button>
                      <Button variant="secondary" onClick={() => resetPassword(u)}>Reset password</Button>
                      <Button variant="danger" disabled={isMe} onClick={() => remove(u)}>Delete</Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </Page>
  );
}
