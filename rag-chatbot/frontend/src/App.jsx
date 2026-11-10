import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Layout from "./components/Layout.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.jsx";
import UsersPage from "./pages/UsersPage.jsx";
import StudentsPage from "./pages/StudentsPage.jsx";
import StudentProfilePage from "./pages/StudentProfilePage.jsx";
import ReviewsPage from "./pages/ReviewsPage.jsx";
import CoursesPage from "./pages/CoursesPage.jsx";
import CourseDetailPage from "./pages/CourseDetailPage.jsx";
import CourseChatPage from "./pages/CourseChatPage.jsx";

// Route access by role (mirrors the backend rules):
//   admin               -> /students, /staff, /courses, /courses/:id
//   instructor          -> assigned /students, /courses, /courses/:id, /courses/:id/chat
//   student             -> /courses, /courses/:id/chat
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route element={<ProtectedRoute roles={["admin", "instructor"]} />}>
            <Route path="/students" element={<StudentsPage />} />
            <Route path="/students/:studentId" element={<StudentProfilePage />} />
          </Route>

          <Route element={<ProtectedRoute roles={["admin", "instructor"]} />}>
            <Route path="/courses/:courseId" element={<CourseDetailPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={["instructor", "student"]} />}>
            <Route path="/courses/:courseId/chat" element={<CourseChatPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={["admin"]} />}>
            <Route path="/staff" element={<UsersPage staffOnly />} />
            <Route path="/users" element={<UsersPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/courses" replace />} />
    </Routes>
  );
}
