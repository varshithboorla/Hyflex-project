# Move Students

The current Move Students workflow remains inside `../StudentsPage.jsx` to preserve the exact behavior of the existing migration baseline.

It supports:
- individual and bulk selection
- academic year + target semester
- reuse of an existing target enrollment
- current enrollment closure
- `students.semester_id` synchronization
- `student_promotions` recording

Do not remove or replace this workflow during subsequent page migrations.
