// All HTTP calls live here. The browser only talks to our backend,
// never to OpenAI or MongoDB, so no secrets exist in the frontend.
import axios from "axios";

const TOKEN_KEY = "academic_chat_token";

const client = axios.create({ baseURL: import.meta.env.VITE_API_URL || "/api" });

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

// Attach the JWT to every request.
client.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the token is rejected (expired / user deactivated), tell the app to log out.
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);
client.interceptors.response.use(
  (r) => r,
  (error) => {
    const isPublicAuthCall = ["/auth/login", "/auth/forgot-password", "/auth/reset-password"].some((path) => error.config?.url?.includes(path));
    if (error.response?.status === 401 && !isPublicAuthCall) onUnauthorized();
    return Promise.reject(error);
  },
);

export function getErrorMessage(error) {
  if (error.response?.data?.message) return error.response.data.message;
  if (error.code === "ERR_NETWORK") return "Cannot reach the server. Is the backend running on port 5000?";
  return "Something went wrong. Please try again.";
}

const unwrap = (p) => p.then((r) => r.data);

// Auth
export const login = (email, password) => unwrap(client.post("/auth/login", { email, password }));
export const requestPasswordReset = (email) => unwrap(client.post("/auth/forgot-password", { email }));
export const resetPassword = (token, newPassword) => unwrap(client.post("/auth/reset-password", { token, newPassword }));
export const fetchMe = () => unwrap(client.get("/auth/me"));
export const changePassword = (currentPassword, newPassword) =>
  unwrap(client.post("/auth/change-password", { currentPassword, newPassword }));

// Users (admin)
export const fetchUsers = () => unwrap(client.get("/users")).then((d) => d.users);
export const createUser = (body) => unwrap(client.post("/users", body));
export const updateUser = (id, body) => unwrap(client.patch(`/users/${id}`, body));
export const deleteUser = (id) => unwrap(client.delete(`/users/${id}`));
export const fetchStudents = () => unwrap(client.get("/users/students")).then((d) => d.students);
export const createStudent = (body) => unwrap(client.post("/users/students", body));
export const fetchStudent = (id) => unwrap(client.get(`/users/students/${id}`)).then((d) => d.student);
export const updateStudent = (id, body) => unwrap(client.patch(`/users/students/${id}`, body));

// Scheduled reviews
export const fetchReviews = () => unwrap(client.get("/reviews")).then((d) => d.reviews);
export const createReview = (body) => unwrap(client.post("/reviews", body)).then((d) => d.review);
export const updateReview = (id, body) => unwrap(client.patch(`/reviews/${id}`, body)).then((d) => d.review);

// Courses
export const fetchCourses = () => unwrap(client.get("/courses")).then((d) => d.courses);
export const fetchCourse = (id) => unwrap(client.get(`/courses/${id}`)).then((d) => d.course);
export const createCourse = (body) => unwrap(client.post("/courses", body));
export const updateCourse = (id, body) => unwrap(client.patch(`/courses/${id}`, body));
export const deleteCourse = (id) => unwrap(client.delete(`/courses/${id}`));

// Enrolment
export const fetchCourseStudents = (id) => unwrap(client.get(`/courses/${id}/students`)).then((d) => d.students);
export const enrollStudent = (id, studentId) => unwrap(client.post(`/courses/${id}/students`, { studentId }));
export const removeStudent = (id, studentId) => unwrap(client.delete(`/courses/${id}/students/${studentId}`));

// Course documents
export const fetchDocuments = (courseId) => unwrap(client.get(`/courses/${courseId}/documents`)).then((d) => d.documents);
export const deleteDocument = (courseId, docId) => unwrap(client.delete(`/courses/${courseId}/documents/${docId}`));
export function uploadDocument(courseId, file) {
  const formData = new FormData();
  formData.append("file", file); // must match upload.single("file")
  return unwrap(client.post(`/courses/${courseId}/documents`, formData, { timeout: 120000 }));
}

// Chat
export const sendQuestion = (courseId, conversationId, question) =>
  unwrap(client.post("/chat", { courseId, conversationId, question }, { timeout: 180000 }));
export const fetchConversations = (courseId, search = "") =>
  unwrap(client.get("/chat/conversations", { params: { courseId, search } })).then((d) => d.conversations);
export const createConversation = (courseId) =>
  unwrap(client.post("/chat/conversations", { courseId })).then((d) => d.conversation);
export const fetchConversation = (courseId, conversationId) =>
  unwrap(client.get(`/chat/conversations/${conversationId}`, { params: { courseId } })).then((d) => d.conversation);
