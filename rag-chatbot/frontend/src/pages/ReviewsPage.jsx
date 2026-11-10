import { useCallback, useEffect, useMemo, useState } from "react";
import { FiCalendar, FiEdit2, FiX } from "react-icons/fi";
import { createReview, fetchReviews, fetchStudents, getErrorMessage, updateReview } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { Badge, Button, Field, inputClass, Notice, Page } from "../components/ui.jsx";

const blankForm = { internId: "", courseId: "", date: "", title: "", reviewerName: "" };

function formatDate(date) {
  if (!date) return "Date not set";
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export default function ReviewsPage() {
  const { user } = useAuth();
  const canManage = user.role === "admin" || user.role === "instructor";
  const [reviews, setReviews] = useState([]);
  const [interns, setInterns] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reviewRows, internRows] = await Promise.all([
        fetchReviews(), canManage ? fetchStudents() : Promise.resolve([]),
      ]);
      setReviews(reviewRows);
      setInterns(internRows);
      setError("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => { load(); }, [load]);

  const selectedIntern = interns.find((intern) => String(intern.id) === String(form.internId));
  const assignedCourses = selectedIntern?.courses || [];
  const sortedReviews = useMemo(() => [...reviews].sort((a, b) => a.date.localeCompare(b.date)), [reviews]);

  const startNew = () => {
    setEditingId(null);
    setForm(blankForm);
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const startEdit = (review) => {
    setEditingId(String(review.id));
    setForm({
      internId: String(review.intern.id),
      courseId: String(review.course.id),
      date: review.date,
      title: review.title,
      reviewerName: review.reviewerName,
    });
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const changeIntern = (internId) => setForm((current) => ({ ...current, internId, courseId: "" }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const action = editingId ? updateReview(editingId, form) : createReview(form);
      await action;
      setSuccess(editingId ? "Review updated." : "Review scheduled.");
      setForm(blankForm);
      setEditingId(null);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title="Reviews" action={canManage && <Button onClick={startNew}><span className="inline-flex items-center gap-2"><FiCalendar /> Schedule review</span></Button>}>
      <div className="mx-auto max-w-4xl space-y-4">
        <p className="text-sm text-slate-500">Schedule intern reviews for their assigned courses and keep the details in one place.</p>
        <Notice>{error}</Notice>
        <Notice type="success">{success}</Notice>

        {showForm && canManage && (
          <form onSubmit={submit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">{editingId ? "Update review" : "Schedule a review"}</h2>
              <button type="button" onClick={() => setShowForm(false)} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close review form"><FiX /></button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Intern">
                <select className={inputClass} required value={form.internId} onChange={(e) => changeIntern(e.target.value)}>
                  <option value="">Select an intern</option>
                  {interns.map((intern) => <option key={intern.id} value={intern.id}>{intern.name} ({intern.email})</option>)}
                </select>
              </Field>
              <Field label="Assigned course">
                <select className={inputClass} required value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })} disabled={!selectedIntern}>
                  <option value="">Select an assigned course</option>
                  {assignedCourses.map((course) => <option key={course.id} value={course.id}>{course.title} ({course.code})</option>)}
                </select>
              </Field>
              <Field label="Review date"><input className={inputClass} type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
              <Field label="Review title"><input className={inputClass} required maxLength={150} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Monthly progress review" /></Field>
              <Field label="Reviewer name"><input className={inputClass} required maxLength={100} value={form.reviewerName} onChange={(e) => setForm({ ...form, reviewerName: e.target.value })} /></Field>
            </div>
            {selectedIntern && assignedCourses.length === 0 && <p className="text-sm text-amber-700">Assign a course to this intern before scheduling a course review.</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={busy || !assignedCourses.length}>{busy ? "Saving..." : editingId ? "Save changes" : "Schedule review"}</Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        )}

        {loading ? <p className="text-sm text-slate-500">Loading reviews...</p> : sortedReviews.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center text-slate-500">
            {canManage ? "No reviews scheduled yet." : "You have no scheduled reviews."}
          </div>
        ) : (
          <div className="space-y-3">
            {sortedReviews.map((review) => (
              <article key={review.id} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:shadow-md sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{review.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{formatDate(review.date)} · Reviewer: {review.reviewerName}</p>
                  </div>
                  {canManage && <Button variant="secondary" onClick={() => startEdit(review)}><span className="inline-flex items-center gap-2"><FiEdit2 /> Edit</span></Button>}
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  {canManage && <Badge color="blue">{review.intern.name}</Badge>}
                  <Badge color="green">{review.course.title} · {review.course.code}</Badge>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </Page>
  );
}
