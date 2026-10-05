# HyFlex React — Page-by-Page Migration Structure

This build is a structural React migration baseline. The original project is preserved in `migration-source/` so no existing behavior is lost.

## Admin routes
- `/admin/dashboard` → `features/dashboard/DashboardPage.jsx`
- `/admin/students` → `features/students/StudentsPage.jsx` (existing Phase 4 student functionality)
- `/admin/academic` → `features/academic/AcademicPage.jsx`
- `/admin/courses` → `features/courses/CoursesPage.jsx`
- `/admin/videos` → `features/videos/VideosPage.jsx`
- `/admin/progress` → `features/progress/ProgressPage.jsx`
- `/admin/history` → `features/history/HistoryPage.jsx`
- `/admin/admins` → `features/admins/AdminsPage.jsx`

## Student routes
- `/student` → `features/dashboard/StudentHomePage.jsx`
- `/student/courses` → `features/courses/StudentCoursesPage.jsx`
- `/student/courses/:courseId` → `features/courses/StudentCoursesPage.jsx`
- `/student/video/:videoId` → `features/videos/StudentVideoPage.jsx`

## Rule
No legacy functionality is intentionally deleted. Each legacy page/function is migrated into its own React feature module, with shared UI in `components/` and server access through `server/src/routes/`.
