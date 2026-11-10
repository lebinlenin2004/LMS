import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchCourses, fetchStudent, fetchUsers, getErrorMessage, updateStudent } from "../services/api.js";
import CourseAssignmentSelect from "../components/CourseAssignmentSelect.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { Badge, Button, Field, inputClass, Notice, Page } from "../components/ui.jsx";

export default function StudentProfilePage() {
  const { studentId } = useParams();
  const { user } = useAuth();
  const isAdmin = user.role === "admin";
  const [student, setStudent] = useState(null);
  const [courses, setCourses] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profile, courseRows, userRows] = await Promise.all([
        fetchStudent(studentId), fetchCourses(), isAdmin ? fetchUsers() : Promise.resolve([]),
      ]);
      const visibleCourses = courseRows;
      const existingCourseIds = (profile.courses || [])
        .filter((assigned) => visibleCourses.some((course) => String(course.id) === String(assigned.id)))
        .map((course) => String(course.id));
      setStudent(profile);
      setCourses(visibleCourses);
      setInstructors(userRows.filter((u) => u.role === "instructor" && u.active));
      setForm({
        name: profile.name,
        email: profile.email,
        active: profile.active,
        assignedInstructorId: profile.assignedInstructorId ? String(profile.assignedInstructorId) : "",
        courseIds: existingCourseIds,
      });
      setError("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [studentId, isAdmin]);

  useEffect(() => { load(); }, [load]);

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await updateStudent(studentId, {
        name: form.name,
        email: form.email,
        active: form.active,
        courseIds: form.courseIds,
        ...(isAdmin ? { assignedInstructorId: form.assignedInstructorId || null } : {}),
      });
      setSuccess("Intern profile updated.");
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading && !student) return <Page title="Intern profile"><p className="text-slate-500">Loading profile...</p></Page>;
  if (!student) return <Page title="Intern profile"><Notice>{error || "Profile not found."}</Notice><Link to="/students" className="mt-4 inline-block text-sm text-emerald-700 hover:underline">Back to students</Link></Page>;

  return (
    <Page title={student.name} action={<Badge color={student.active ? "green" : "amber"}>{student.active ? "Active" : "Inactive"}</Badge>}>
      <div className="mx-auto max-w-3xl space-y-5">
        <Link to="/students" className="inline-flex items-center rounded-lg py-1 text-sm font-medium text-emerald-700 hover:text-emerald-800">← Back to interns</Link>
        <Notice>{error}</Notice>
        <Notice type="success">{success}</Notice>
        <form onSubmit={save} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name"><input className={inputClass} required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Email"><input className={inputClass} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Status">
              <select className={inputClass} value={form.active ? "active" : "inactive"} onChange={(e) => setForm({ ...form, active: e.target.value === "active" })}>
                <option value="active">Active</option><option value="inactive">Inactive</option>
              </select>
            </Field>
            {isAdmin && <Field label="Assigned instructor">
              <select className={inputClass} value={form.assignedInstructorId} onChange={(e) => setForm({ ...form, assignedInstructorId: e.target.value })}>
                <option value="">Not assigned</option>
                {instructors.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.email})</option>)}
              </select>
            </Field>}
          </div>

          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-slate-800">Course assignments</legend>
            {courses.length
              ? <CourseAssignmentSelect courses={courses} selectedIds={form.courseIds} onChange={(courseIds) => setForm({ ...form, courseIds })} />
              : <p className="text-sm text-slate-500">No courses are available to assign.</p>}
            {!isAdmin && <p className="mt-2 text-xs text-slate-500">Your changes apply to courses you teach. Other course assignments remain unchanged.</p>}
          </fieldset>
          <div className="border-t border-slate-100 pt-4"><Button type="submit" disabled={busy}>{busy ? "Saving..." : "Save profile"}</Button></div>
        </form>
      </div>
    </Page>
  );
}
