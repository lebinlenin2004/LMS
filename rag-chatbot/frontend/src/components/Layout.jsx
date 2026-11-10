import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { FiBook, FiLogOut, FiMenu, FiX, FiUserCheck, FiBriefcase, FiCalendar } from "react-icons/fi";
import { useAuth } from "../context/AuthContext.jsx";

const linkClass = ({ isActive }) =>
  `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
    isActive ? "bg-emerald-400/10 text-emerald-200 ring-1 ring-inset ring-emerald-300/15" : "text-slate-300 hover:bg-white/5 hover:text-white"
  }`;

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-full bg-slate-50 text-slate-900">
      <aside
        className={`fixed inset-y-0 left-0 z-20 flex w-72 flex-col border-r border-white/10 bg-slate-950 p-4 text-white shadow-2xl transition-transform md:static md:translate-x-0 md:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-1 py-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400 font-bold tracking-tight text-slate-950 shadow-lg shadow-emerald-950/30">AC</div>
            <div>
              <h1 className="text-sm font-semibold tracking-wide">Academic Chat</h1>
              <p className="mt-0.5 text-[11px] text-slate-400">Course workspace</p>
            </div>
          </div>
          <button className="rounded-lg p-2 text-slate-300 hover:bg-white/10 md:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            <FiX />
          </button>
        </div>

        <div className="mt-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Workspace</div>
        <nav className="flex flex-col gap-1.5" onClick={() => setOpen(false)}>
          <NavLink to="/courses" className={linkClass}>
            <FiBook /> {user.role === "student" ? "My courses" : user.role === "instructor" ? "My courses" : "Courses"}
          </NavLink>
          {(user.role === "admin" || user.role === "instructor") && <NavLink to="/students" className={linkClass}><FiUserCheck /> Students</NavLink>}
          {user.role === "admin" && <NavLink to="/staff" className={linkClass}><FiBriefcase /> Staff</NavLink>}
          <NavLink to="/reviews" className={linkClass}><FiCalendar /> Reviews</NavLink>
        </nav>

        <div className="mt-auto rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold text-emerald-200 ring-1 ring-white/10">{user.name?.trim()?.[0]?.toUpperCase() || "U"}</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs capitalize text-slate-400">{user.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <FiLogOut /> Log out
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-10 bg-black/40 md:hidden" onClick={() => setOpen(false)} />}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
          <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" onClick={() => setOpen(true)} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="font-medium">Academic Chat</span>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
