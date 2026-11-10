// Everyone sees their own list (backend filters by role). Only admins can create courses.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiBookOpen, FiUsers } from "react-icons/fi";
import { fetchCourses, createCourse, fetchUsers, getErrorMessage } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { Page, Button, Field, inputClass, Notice, Badge } from "../components/ui.jsx";

const emptyForm = { title: "", code: "", description: "", instructorId: "" };

export default function CoursesPage() {
  const { user } = useAuth();
  const isAdmin = user.role === "admin";
  const [courses, setCourses] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setCourses(await fetchCourses());
      if (isAdmin) setInstructors((await fetchUsers()).filter((u) => u.role === "instructor" && u.active));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);
  useEffect(() => {
    load();
    // Refresh the intern dashboard when a tab returns to the foreground after assignments change.
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await createCourse({ ...form, instructorId: form.instructorId || null });
      setForm(emptyForm);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <Page
      title={isAdmin ? "Courses" : "My courses"}
      action={isAdmin && <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Close" : "New course"}</Button>}
    >
      <div className="space-y-4">
        <Notice>{error}</Notice>

        {showForm && (
          <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 sm:p-6">
            <Field label="Title">
              <input className={inputClass} required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>
            <Field label="Course code (unique)">
              <input className={inputClass} required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </Field>
            <Field label="Instructor (optional)">
              <select className={inputClass} value={form.instructorId} onChange={(e) => setForm({ ...form, instructorId: e.target.value })}>
                <option value="">Not assigned</option>
                {instructors.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Description">
              <input className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit">Create course</Button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : courses.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center text-slate-500 shadow-sm">
            {isAdmin
              ? "No courses yet. Create the first one."
              : user.role === "instructor"
                ? "You have not been assigned to any course yet."
                : "You are not enrolled in any course yet."}
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {courses.map((c) => (
              <div key={c.id} className="group flex min-h-64 flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"><FiBookOpen size={19} /></div>
                    <div className="min-w-0 pt-0.5">
                      <p className="line-clamp-2 font-semibold leading-5 text-slate-900">{c.title}</p>
                      <p className="mt-1 text-xs font-medium tracking-wide text-slate-500">{c.code}</p>
                    </div>
                  </div>
                  <Badge color={c.status === "active" ? "green" : "amber"}>{c.status}</Badge>
                </div>
                <p className="line-clamp-3 min-h-12 text-sm leading-6 text-slate-600">{c.description || "Course materials and discussions for this class."}</p>
                <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span className="truncate">{c.instructor ? c.instructor.name : "Instructor not assigned"}</span>
                  <span className="ml-2 inline-flex shrink-0 items-center gap-1"><FiUsers />{c.studentCount}</span>
                </div>
                <div className="flex gap-2 pt-1">
                  {user.role !== "student" && (
                    <Link to={`/courses/${c.id}`}>
                      <Button variant="secondary">Manage</Button>
                    </Link>
                  )}
                  {user.role !== "admin" && c.status === "active" && (
                    <Link to={`/courses/${c.id}/chat`}>
                      <Button>Open chat</Button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Page>
  );
}
