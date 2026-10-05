import { Route, Routes } from 'react-router-dom';
import StudentHomePage from '../../features/dashboard/StudentHomePage';
import StudentCoursesPage from '../../features/courses/StudentCoursesPage';
import StudentVideoPage from '../../features/videos/StudentVideoPage';
export default function StudentRoutes(){return <Routes><Route index element={<StudentHomePage/>}/><Route path="courses" element={<StudentCoursesPage/>}/><Route path="courses/:courseId" element={<StudentCoursesPage/>}/><Route path="video/:videoId" element={<StudentVideoPage/>}/></Routes>}
