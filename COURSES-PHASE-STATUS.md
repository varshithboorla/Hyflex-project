# Courses Phase

Implemented the next React migration page: Admin Courses.

Preserved from the current source project:
- Academic Year folders with automatic Odd / Even folders
- Folder notes/descriptions
- Folder sync through `ensure_all_year_folders`
- Folder course counts and current-year/running-term indicators
- Course offerings inside a selected folder
- Search by course name
- Department/branch filter
- Semester filter
- Batch filter
- Add Course Offering
- Edit Course Offering
- Multiple batches when adding
- Branch selection or All Branches
- Published / Draft state
- Batch-derived regulation
- Batch + academic year + folder validation of semester
- Delete offering with dependent videos, questions, question options, skips, progress and attempts cleanup
- Remove unused course subject after the last offering is deleted
- Backend session-protected Express API

Important schema terminology used here:
- `branches.name` / `branches.code`
- `batches.label`
- `course_offerings`
- `course_offering_branches`
- `folders`
- `academic_years`
- `courses`
- `videos` / question/progress tables for offering deletion cleanup

The old project remains under `migration-source/` as the migration reference.
