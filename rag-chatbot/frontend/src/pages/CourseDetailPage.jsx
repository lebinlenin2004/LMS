// Admin or the course's instructor: edit course, manage enrolled students, manage PDFs.
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FiFileText, FiTrash2, FiUploadCloud, FiLoader } from "react-icons/fi";
import {
  fetchCourse, updateCourse, deleteCourse, fetchUsers, fetchStudents, fetchCourseStudents,
  enrollStudent, removeStudent, fetchDocuments, uploadDocument, deleteDocument, getErrorMessage,
} from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { Page, Button, Field, inputClass, Notice } from "../components/ui.jsx";

const Section = ({ title, children }) => (
  <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
    <h3 className="border-b border-slate-100 pb-3 text-base font-semibold tracking-tight text-slate-900">{title}</h3>
    {children}
  </section>
);

export default function CourseDetailPage() {
  const { courseId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user.role === "admin";

  const [course, setCourse] = useState(null);
  const [form, setForm] = useState(null);
  const [instructors, setInstructors] = useState([]);
  const [enrolled, setEnrolled] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [studentToAdd, setStudentToAdd] = useState("");
  const [documents, setDocuments] = useState([]);
  const [uploadState, setUploadState] = useState({ busy: false, message: "", ok: true });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const c = await fetchCourse(courseId);
      setCourse(c);
      setForm({ title: c.title, code: c.code, description: c.description || "", status: c.status, instructorId: c.instructor?.id || "" });
      const [students, enrolledList, docs] = await Promise.all([
        fetchStudents(), fetchCourseStudents(courseId), fetchDocuments(courseId),
      ]);
      setAllStudents(students);
      setEnrolled(enrolledList);
      setDocuments(docs);
      if (isAdmin) setInstructors((await fetchUsers()).filter((u) => u.role === "instructor" && u.active));
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }, [courseId, isAdmin]);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn, okMessage) => {
    setError("");
    setSuccess("");
    try {
      await fn();
      if (okMessage) setSuccess(okMessage);
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const saveDetails = (e) => {
    e.preventDefault();
    // The backend only accepts description/status from instructors, so send only what they may change.
    const body = isAdmin
      ? { ...form, instructorId: form.instructorId || null }
      : { description: form.description, status: form.status };
    run(() => updateCourse(courseId, body), "Course updated.");
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") return setUploadState({ busy: false, ok: false, message: "Please choose a PDF file." });
    if (file.size > 10 * 1024 * 1024) return setUploadState({ busy: false, ok: false, message: "File is larger than 10 MB." });

    setUploadState({ busy: true, ok: true, message: `Processing ${file.name}...` });
    try {
      const res = await uploadDocument(courseId, file);
      setUploadState({ busy: false, ok: true, message: res.message });
      setDocuments(await fetchDocuments(courseId));
    } catch (err) {
      setUploadState({ busy: false, ok: false, message: getErrorMessage(err) });
    }
  };

  if (!course) return <Page title="Course">{error ? <Notice>{error}</Notice> : <p className="text-slate-500">Loading...</p>}</Page>;

  const enrolledIds = new Set(enrolled.map((s) => String(s.id)));
  const available = allStudents.filter((s) => s.active !== false && !enrolledIds.has(String(s.id)));

  return (
    <Page
      title={`${course.title} (${course.code})`}
      action={
        user.role === "instructor" && course.status === "active" && (
          <Link to={`/courses/${courseId}/chat`}><Button>Open chat</Button></Link>
        )
      }
    >
      <div className="space-y-4">
        <Link to="/courses" className="text-sm text-emerald-700 hover:underline">Back to courses</Link>
        <Notice>{error}</Notice>
        <Notice type="success">{success}</Notice>

        <Section title="Course details">
          <form onSubmit={saveDetails} className="grid gap-3 sm:grid-cols-2">
            {isAdmin && (
              <>
                <Field label="Title">
                  <input className={inputClass} required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </Field>
                <Field label="Course code">
                  <input className={inputClass} required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
                </Field>
                <Field label="Instructor">
                  <select className={inputClass} value={form.instructorId} onChange={(e) => setForm({ ...form, instructorId: e.target.value })}>
                    <option value="">Not assigned</option>
                    {instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </Field>
              </>
            )}
            <Field label="Status">
              <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="archived">Archived (chat disabled)</option>
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description">
                <textarea className={inputClass} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit">Save changes</Button>
              {isAdmin && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={async () => {
                    if (window.confirm("Delete this course and all its documents?")) {
                      try { await deleteCourse(courseId); navigate("/courses"); } catch (e) { setError(getErrorMessage(e)); }
                    }
                  }}
                >
                  Delete course
                </Button>
              )}
            </div>
          </form>
        </Section>

        <Section title={`Students (${enrolled.length})`}>
        <div className="flex flex-col gap-2 sm:flex-row">
            <select className={inputClass} value={studentToAdd} onChange={(e) => setStudentToAdd(e.target.value)}>
              <option value="">Select a student to enrol</option>
              {available.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.email})</option>)}
            </select>
            <Button
              disabled={!studentToAdd}
              onClick={() => run(() => enrollStudent(courseId, studentToAdd), "Student enrolled.").then(() => setStudentToAdd(""))}
            >
              Enrol
            </Button>
          </div>
          {enrolled.length === 0 ? (
            <p className="text-sm text-slate-500">No students enrolled yet.</p>
          ) : (
            <ul className="grid gap-2 text-sm sm:grid-cols-2">
              {enrolled.map((s) => (
                <li key={s.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <span className="min-w-0"><span className="block truncate font-medium text-slate-800">{s.name}</span><span className="block truncate text-xs text-slate-500">{s.email}</span></span>
                  <Button variant="danger" onClick={() => run(() => removeStudent(courseId, s.id), "Student removed.")}>Remove</Button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Course documents (chatbot knowledge)">
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleUpload} />
          <Button variant="secondary" disabled={uploadState.busy} onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2">
            {uploadState.busy ? <FiLoader className="animate-spin" /> : <FiUploadCloud />}
            {uploadState.busy ? "Processing..." : "Upload PDF"}
          </Button>
          {uploadState.message && <Notice type={uploadState.ok ? "success" : "error"}>{uploadState.message}</Notice>}

          {documents.length === 0 ? (
            <p className="text-sm text-slate-500">No documents yet. Students cannot get answers until you upload one.</p>
          ) : (
            <ul className="grid gap-2 text-sm sm:grid-cols-2">
              {documents.map((d) => (
                <li key={d.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <FiFileText className="shrink-0 text-slate-400" />
                    <span className="min-w-0"><span className="block truncate font-medium text-slate-800">{d.name}</span><span className="text-xs text-slate-500">{d.pageCount} pages · {d.chunkCount} chunks</span></span>
                  </span>
                  <button
                    aria-label={`Delete ${d.name}`}
                    className="text-red-500 hover:text-red-700"
                    onClick={() => window.confirm(`Delete ${d.name}?`) && run(() => deleteDocument(courseId, d.id), "Document deleted.")}
                  >
                    <FiTrash2 />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </Page>
  );
}
