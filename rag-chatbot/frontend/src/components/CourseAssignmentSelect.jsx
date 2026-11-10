import { useState } from "react";
import { FiPlus, FiX } from "react-icons/fi";
import { inputClass } from "./ui.jsx";

export default function CourseAssignmentSelect({ courses, selectedIds, onChange }) {
  const [courseToAdd, setCourseToAdd] = useState("");
  const selected = new Set(selectedIds.map(String));
  const available = courses.filter((course) => !selected.has(String(course.id)));

  const addCourse = () => {
    if (!courseToAdd) return;
    onChange([...selectedIds, courseToAdd]);
    setCourseToAdd("");
  };

  return (
    <div className="space-y-3">
      {available.length > 0 ? (
        <div className="flex gap-2">
          <select className={inputClass} value={courseToAdd} onChange={(e) => setCourseToAdd(e.target.value)} aria-label="Choose a course to assign">
            <option value="">Choose a course</option>
            {available.map((course) => <option key={course.id} value={String(course.id)}>{course.title} ({course.code})</option>)}
          </select>
          <button type="button" onClick={addCourse} disabled={!courseToAdd} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <FiPlus /> Assign
          </button>
        </div>
      ) : <p className="text-sm text-slate-500">No more courses available to assign.</p>}

      {selectedIds.length > 0 ? (
        <ul className="space-y-2">
          {selectedIds.map((id) => {
            const course = courses.find((item) => String(item.id) === String(id));
            if (!course) return null;
            return (
              <li key={id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <span>{course.title} <span className="text-slate-500">({course.code})</span></span>
                <button type="button" onClick={() => onChange(selectedIds.filter((selectedId) => String(selectedId) !== String(id)))} className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${course.title}`}>
                  <FiX />
                </button>
              </li>
            );
          })}
        </ul>
      ) : <p className="text-sm text-slate-500">No courses assigned.</p>}
    </div>
  );
}
