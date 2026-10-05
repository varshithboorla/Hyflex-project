import { Navigate, Route, Routes } from 'react-router-dom';
import DashboardPage from '../../features/dashboard/DashboardPage';
import StudentsPage from '../../features/students/StudentsPage';
import AcademicPage from '../../features/academic/AcademicPage';
import CoursesPage from '../../features/courses/CoursesPage';
import VideosPage from '../../features/videos/VideosPage';
import ProgressPage from '../../features/progress/ProgressPage';
import HistoryPage from '../../features/history/HistoryPage';
import AdminsPage from '../../features/admins/AdminsPage';

export default function AdminRoutes() {
  return <Routes>
    <Route index element={<Navigate to="dashboard" replace />} />
    <Route path="dashboard" element={<DashboardPage />} />
    <Route path="students" element={<StudentsPage />} />
    <Route path="academic" element={<AcademicPage />} />
    <Route path="courses" element={<CoursesPage />} />
    <Route path="videos" element={<VideosPage />} />
    <Route path="progress" element={<ProgressPage />} />
    <Route path="history" element={<HistoryPage />} />
    <Route path="admins" element={<AdminsPage />} />
    <Route path="*" element={<Navigate to="dashboard" replace />} />
  </Routes>;
}
