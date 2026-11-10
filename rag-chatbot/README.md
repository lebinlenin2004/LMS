# Academic Chat: course-based RAG chatbot with role-based access

A MERN app where an **admin** creates users and courses, **instructors** manage their courses, students and course PDFs, and **students** chat with the material of the courses they are enrolled in. Answers use Gemini and Google embeddings with RAG (LangChain.js, MongoDB Atlas Vector Search) from that course's PDFs only.

## Roles and permissions

| Action | Admin | Instructor | Student |
|---|---|---|---|
| Log in | yes | yes | yes |
| Create / edit / deactivate / delete users, reset passwords, change roles | yes | no | no |
| Create and delete courses, assign an instructor, edit title/code | yes | no | no |
| Edit description/status of a course | any course | own courses | no |
| Enrol / remove students | any course | own courses | no |
| Upload / delete course PDFs | any course | own courses | no |
| View the list of students (id, name, email) | yes | yes (to enrol) | no |
| Manage intern profiles, status, instructor and course assignments | yes | assigned interns only | no |
| Chat with a course's documents | no | own courses | enrolled courses |

"Own courses" means the course's assigned instructor. Admins are limited to user and course management and cannot use the chatbot. Every rule is enforced in the backend (`middleware/auth.js`, `services/courseService.js`). The React route guards only hide pages. Users get a 404 (not 403) for courses they cannot see.

Extra safeguards: no public sign-up (admin creates accounts), bcrypt-hashed passwords, JWT sessions checked against the database on every request (deactivating a user locks them out immediately), the last active admin cannot be removed, admins cannot delete or demote themselves, login attempts are rate limited.

## Project structure

```
backend/
  config/database.js        collections, indexes, vector index (auto create/update)
  middleware/               auth.js (authenticate, requireRole), uploadMiddleware.js, loginLimiter.js
  utils/                    pdfProcessor.js, helpers.js
  services/                 userService.js, courseService.js (access rules), documentService.js,
                            embeddingService.js, ragService.js
  controllers/              auth, user, course, document, chat
  routes/                   authRoutes, userRoutes, courseRoutes, chatRoutes
frontend/src/
  context/AuthContext.jsx   login state + token
  components/               Layout, ProtectedRoute, ChatWindow, ChatMessage, ChatInput, ui
  pages/                    LoginPage, UsersPage, CoursesPage, CourseDetailPage, CourseChatPage
  services/api.js           all HTTP calls (adds the JWT to every request)
```

## API

| Method and path | Who |
|---|---|
| `POST /api/auth/login`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `GET /api/auth/me`, `POST /api/auth/change-password` | login and password recovery public, others any user |
| `GET/POST /api/users`, `PATCH/DELETE /api/users/:id` | admin |
| `GET/POST /api/users/students`, `GET/PATCH /api/users/students/:studentId` | admin; instructors only their assigned interns for reads/updates |
| `GET /api/courses` | any user (filtered by role) |
| `POST /api/courses`, `DELETE /api/courses/:courseId` | admin |
| `GET /api/courses/:courseId` | admin, own instructor, enrolled student |
| `PATCH /api/courses/:courseId` | admin, own instructor (limited fields) |
| `GET/POST /api/courses/:courseId/students`, `DELETE .../students/:studentId` | admin, own instructor |
| `GET /api/courses/:courseId/documents` | admin, own instructor, enrolled student |
| `POST /api/courses/:courseId/documents`, `DELETE .../documents/:documentId` | admin, own instructor |
| `GET/POST /api/chat/conversations`, `GET /api/chat/conversations/:conversationId` | own instructor, enrolled student |
| `POST /api/chat` with `{ courseId, conversationId, question }` | own instructor, enrolled student |
| `GET/POST /api/reviews`, `PATCH /api/reviews/:reviewId` | admin; instructor for assigned interns; intern reads own reviews |

## Setup

Requirements: Node.js 20+, MongoDB Atlas account, Google Gemini API key.

```bash
cd backend && npm install
cd ../frontend && npm install
```

Create `backend/.env` from `.env.example` and fill it in:

```
PORT=5000
MONGODB_URI=...
GOOGLE_API_KEY=...
LLM_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GEMINI_EMBEDDING_DIMENSIONS=768
VECTOR_INDEX_NAME=vector_index
JWT_SECRET=<long random string, 16+ characters>
JWT_EXPIRES_IN=8h
FRONTEND_URL=http://localhost:5173
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM=Academic Chat <no-reply@example.com>
ADMIN_NAME=Administrator
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=<a strong password>
```

Generate a secret with: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

On first start the backend creates the admin account from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (only if no admin exists). Log in with it, then change the password.

Password recovery uses SMTP in production; the sign-in page sends a one-hour, single-use reset link to the account email. Configure `FRONTEND_URL` to the deployed frontend URL so links point to the right site. For local development without SMTP, the reset link is printed in the backend terminal after requesting it. Recovery responses do not reveal whether an email exists.

### Vector Search index (important change)

Chunks are now filtered by course, so the index needs a `filter` field in addition to the vector field. The backend creates the index, or **updates your existing `vector_index`**, automatically on startup. If it prints a warning, edit the index in Atlas (Atlas Search, `rag_chatbot.document_chunks`, `vector_index`, JSON editor) to:

```json
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 768, "similarity": "cosine" },
    { "type": "filter", "path": "courseId" },
    { "type": "filter", "path": "embeddingModel" }
  ]
}
```

Wait until the index is **Active** after any change.

### Upgrading from the previous single-document version

Old chunks may have been embedded with OpenAI and cannot be searched with Gemini vectors. Those chunks are excluded from Gemini retrieval. Re-upload each existing PDF; the app detects stale vectors and replaces them with Gemini embeddings. The Atlas index is updated automatically to 768 dimensions and to include the `embeddingModel` filter; wait until its status is Active.

### Run

```bash
cd backend && npm run dev     # terminal 1, http://localhost:5000
cd frontend && npm run dev    # terminal 2, http://localhost:5173
```

## Typical workflow

1. Admin logs in, opens **Users**, and creates instructors and students.
2. Admin opens **Courses**, creates a course and assigns an instructor.
3. Instructor logs in, opens the course with **Manage**, enrols students and uploads PDFs.
4. Student logs in, sees only enrolled courses, and uses **Open chat**.

## Chat history

Conversations are saved per user and course. In a course chat, use **New chat** to start a separate conversation or search the history panel to find a past conversation by its title or message text. Opening a conversation restores its messages and sources. Chat history is removed when its user or course is deleted.

## Intern profiles

Admins use **Students** to create intern/student profiles, set account status, assign an instructor, and assign courses from the dropdown. **Staff** manages instructor and admin accounts. Instructors see only interns assigned to them and can edit those profiles, status, and course assignments for courses they teach. These checks are enforced by the backend.

## Scheduled reviews

Admins and instructors can schedule and update reviews with a date, title, reviewer, intern, and one of that intern's assigned courses. Assigned instructors can update reviews for their interns. Interns see their own scheduled review details in **Reviews**.

## How course-based RAG works

Ingestion stores each chunk with `courseId`, `documentId`, `documentName`, `pageNumber`, `chunkIndex`. When a question arrives, the backend first checks the user may chat with that course, then runs vector search with `preFilter: { courseId }`, so only that course's top 4 chunks reach the LLM. The prompt rules (answer only from context, say when unsure, treat documents as untrusted data) are unchanged. Deleting a PDF or a course deletes the related chunks.

## Troubleshooting

| Problem | Fix |
|---|---|
| Server stops with `JWT_SECRET is missing` | Add it to `backend/.env` (16+ characters). |
| "No admin exists" warning | Set `ADMIN_EMAIL` and `ADMIN_PASSWORD`, restart. |
| Chat always says it cannot find the answer | The index lacks the `courseId` filter or is not Active yet, or the course has no PDFs, or you are using chunks uploaded before the upgrade (re-upload). |
| `MongoServerSelectionError` | Add your IP in Atlas Network Access and check the URI. |
| Logged out unexpectedly | Token expired (8h) or the account was deactivated. |
| 429 on login | Too many attempts; wait 15 minutes. |

## Notes and limits

- The JWT is stored in `localStorage` for simplicity. For production consider httpOnly cookies, HTTPS, and a shared rate-limit store.
- Ingestion is still synchronous (fine for small PDFs). Document records already carry a `status`, so moving to a background queue later is straightforward.
