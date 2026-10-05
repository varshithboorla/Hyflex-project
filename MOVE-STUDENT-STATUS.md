# Move Student conversion

This package is the valid structured Phase 5 baseline with the Move Students workflow preserved in `client/src/features/students/StudentsPage.jsx` and the backend in `server/src/routes/adminStudents.js`.

The previous assistant response referenced a separate `hyflex-react-move-students.zip`; that archive was not actually created. This package replaces that missing artifact.

Database source of truth: the user's supplied schema. In particular, branches use `name`/`code`, batches use `label`, students use `semester_id`, and student_enrollments/student_promotions record semester movement.
