import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

// Hides pages from people who are not logged in or have the wrong role.
// (This is only for UX. The real protection is the backend's role checks.)
export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8 text-slate-500">Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}
