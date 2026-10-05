# HyFlex React Migration — Phase 4

This phase continues the React SPA migration while preserving the existing EduLearn-style admin UI.

## Architecture

- React + Vite + Tailwind CSS
- React Router for real SPA routes
- Express backend
- Supabase accessed only by the backend
- HTTP-only session cookie authentication

## Phase 4 — Students

Admin route:

`/admin/students`

Implemented:

- Student listing
- Search by roll number, name or email
- Academic year, semester, branch and batch filters
- Add Student
- Creates the student's first `student_enrollments` record
- Multi-select students
- Bulk Move Students
- Moves the current enrollment to another academic year/semester
- Reuses an existing enrollment when a student is moved back to a semester, avoiding duplicate `(student_id, academic_year_id, semester_id)` records
- Responsive table and mobile-friendly dialogs

### Expected existing tables

- `students`
- `student_enrollments`
- `academic_years`
- `semesters`
- `branches`
- `batches` (optional; the UI hides batch controls if this table is unavailable)

The implementation follows the current schema rather than creating a second student table.

## Run

### Backend

```bash
cd server
npm install
npm run dev
```

### Frontend

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173`.

## Environment

Create `server/.env` from `server/.env.example` and provide the Supabase URL, server-side service-role key, session secret and client origin.
"# Hyflex-project" 
"# Hyflex-project" 
