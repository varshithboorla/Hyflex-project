# React page-by-page structure

The old project is preserved under `migration-source/` and `legacy-assets/` so no functionality or reference implementation is lost.

## Admin pages
- `src/features/dashboard/DashboardPage.jsx`
- `src/features/students/StudentsPage.jsx`
- `src/features/academic/AcademicPage.jsx`
- `src/features/courses/CoursesPage.jsx`
- `src/features/videos/VideosPage.jsx`
- `src/features/progress/ProgressPage.jsx`
- `src/features/history/HistoryPage.jsx`
- `src/features/admins/AdminsPage.jsx`

## Student pages
- `src/features/dashboard/StudentHomePage.jsx`
- `src/features/courses/StudentCoursesPage.jsx`
- `src/features/videos/StudentVideoPage.jsx`

## Shared layers
- `src/components/layout/` — shells/sidebar/header
- `src/components/ui/` — reusable UI primitives
- `src/features/<feature>/` — feature-specific pages/components/API as migration proceeds
- `src/pages/admin/AdminRoutes.jsx` — admin route map
- `src/pages/student/StudentRoutes.jsx` — student route map

Existing Phase 4 Students functionality remains active. The remaining legacy functionality is intentionally not deleted; each module will be migrated into its own feature folder rather than replaced by a generic placeholder in the final implementation.
