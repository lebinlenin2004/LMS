import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowUpRight, FiBookOpen, FiMail, FiPlus, FiSearch, FiUserCheck } from "react-icons/fi";
import CourseAssignmentSelect from "../components/CourseAssignmentSelect.jsx";
import { createStudent, fetchCourses, fetchStudents, fetchUsers, getErrorMessage } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { Badge, Button, Field, inputClass, Notice, Page } from "../components/ui.jsx";

const blankForm = { name: "", email: "", password: "", assignedInstructorId: "", courseIds: [] };

export default function StudentsPage() {
  const { user } = useAuth();
  const isAdmin = user.role === "admin";
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [studentRows, courseRows, userRows] = await Promise.all([
        fetchStudents(), fetchCourses(), isAdmin ? fetchUsers() : Promise.resolve([]),
      ]);
      setStudents(studentRows);
      setCourses(courseRows.filter((c) => c.status === "active"));
      setInstructors(userRows.filter((u) => u.role === "instructor" && u.active));
      setError("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return students;
    return students.filter((s) => [s.name, s.email, s.assignedInstructorName, ...(s.courses || []).map((c) => c.title)]
      .some((value) => String(value || "").toLowerCase().includes(term)));
  }, [students, search]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await createStudent({ ...form, role: "student", assignedInstructorId: form.assignedInstructorId || null });
      setSuccess("Student profile created and assignments saved.");
      setForm(blankForm);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      title="Interns"
      action={isAdmin && <Button onClick={() => setShowForm((v) => !v)}><span className="inline-flex items-center gap-2"><FiPlus />{showForm ? "Close" : "Add intern"}</span></Button>}
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500">{isAdmin ? "Manage intern profiles, status, instructors, and course assignments." : "View and update the profiles assigned to you."}</p>
        <Notice>{error}</Notice>
        <Notice type="success">{success}</Notice>

        {showForm && isAdmin && (
          <form onSubmit={submit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h3 className="font-semibold">New intern profile</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full name"><input className={inputClass} required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Email"><input className={inputClass} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="Temporary password"><input className={inputClass} type="password" required minLength={8} maxLength={100} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
              <Field label="Assigned instructor">
                <select className={inputClass} value={form.assignedInstructorId} onChange={(e) => setForm({ ...form, assignedInstructorId: e.target.value })}>
                  <option value="">Not assigned</option>
                  {instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </Field>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-700">Course assignments</legend>
              {courses.length
                ? <CourseAssignmentSelect courses={courses} selectedIds={form.courseIds} onChange={(courseIds) => setForm({ ...form, courseIds })} />
                : <p className="text-sm text-slate-500">No active courses available.</p>}
            </fieldset>
            <Button type="submit" disabled={busy}>{busy ? "Creating..." : "Create profile"}</Button>
          </form>
        )}

        <label className="relative block max-w-md">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className={`${inputClass} pl-9`} type="search" placeholder="Search interns" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>

        {loading ? (
          <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {[0, 1, 2].map((item) => <div key={item} className="h-52 animate-pulse rounded-2xl border border-slate-200 bg-slate-50" />)}
          </div>
        ) : shown.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
            <p className="font-medium text-slate-700">{search ? "No matching interns." : isAdmin ? "No intern profiles yet." : "No interns are assigned to you yet."}</p>
            {isAdmin && !search && <p className="mt-1 text-sm text-slate-500">Add an intern to start managing profiles and course assignments.</p>}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((s) => {
              const initials = s.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
              const assignedCourses = s.courses || [];
              return (
                <Link
                  key={s.id}
                  to={`/students/${s.id}`}
                  aria-label={`Open ${s.name}'s intern profile`}
                  className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
                >
                  <article className="flex flex-col gap-4 px-4 py-4 transition-colors group-hover:bg-emerald-50/30 sm:px-5 lg:flex-row lg:items-center">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-8 gap-y-3">
                      <div className="flex min-w-56 flex-1 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-100">
                          {initials || "IN"}
                        </div>
                        <div className="min-w-0">
                          <h2 className="truncate font-semibold text-slate-900 group-hover:text-emerald-800">{s.name}</h2>
                          <p className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-xs text-slate-500"><FiMail className="shrink-0" />{s.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm lg:min-w-48">
                        <FiUserCheck className="shrink-0 text-slate-400" />
                        <span className="text-slate-500">Instructor</span>
                        <span className="truncate font-medium text-slate-700">{s.assignedInstructorName || "Unassigned"}</span>
                      </div>
                      <div className="flex min-w-48 flex-1 items-start gap-2 text-sm">
                        <FiBookOpen className="mt-0.5 shrink-0 text-slate-400" />
                        <div className="min-w-0">
                          <span className="mr-2 text-slate-500">Courses</span>
                          {assignedCourses.length ? (
                            <span className="inline-flex flex-wrap gap-1.5 align-middle">
                              {assignedCourses.slice(0, 3).map((course) => <span key={course.id} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{course.code}</span>)}
                              {assignedCourses.length > 3 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">+{assignedCourses.length - 3}</span>}
                            </span>
                          ) : <span className="text-xs text-slate-400">None</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 lg:justify-end lg:border-0 lg:pt-0">
                      <Badge color={s.active ? "green" : "amber"}>{s.active ? "Active" : "Inactive"}</Badge>
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-700">View profile <FiArrowUpRight /></span>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Page>
  );
}
