const api = async (path, options = {}) => {
  const response = await fetch(path, {
    credentials: 'include',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.message || 'Request failed'); error.status = response.status; throw error; }
  return data;
};

export const authApi = {
  login: (payload) => api('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  me: () => api('/api/auth/me'),
  logout: () => api('/api/auth/logout', { method: 'POST' }),
};

export const adminApi = {
  dashboard: () => api('/api/admin/dashboard'),
  students: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null));
    return api(`/api/admin/students${qs.toString() ? `?${qs}` : ''}`);
  },
  createStudent: (payload) => api('/api/admin/students', { method: 'POST', body: JSON.stringify(payload) }),
  updateStudent: (id, payload) => api(`/api/admin/students/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  moveStudents: (payload) => api('/api/admin/students/move', { method: 'POST', body: JSON.stringify(payload) }),
  deleteStudents: (student_ids) => api('/api/admin/students', { method: 'DELETE', body: JSON.stringify({ student_ids }) }),
  academic: () => api('/api/admin/academic'),
  createAcademicYear: (payload) => api('/api/admin/academic/years', { method: 'POST', body: JSON.stringify(payload) }),
  setCurrentAcademicYear: (id) => api(`/api/admin/academic/years/${id}/current`, { method: 'POST' }),
  deleteAcademicYear: (id) => api(`/api/admin/academic/years/${id}`, { method: 'DELETE' }),
  createRegulation: (payload) => api('/api/admin/academic/regulations', { method: 'POST', body: JSON.stringify(payload) }),
  deleteRegulation: (id) => api(`/api/admin/academic/regulations/${id}`, { method: 'DELETE' }),
  createBatch: (payload) => api('/api/admin/academic/batches', { method: 'POST', body: JSON.stringify(payload) }),
  updateBatchRegulation: (id, regulation_id) => api(`/api/admin/academic/batches/${id}/regulation`, { method: 'PATCH', body: JSON.stringify({ regulation_id }) }),
  deleteBatch: (id) => api(`/api/admin/academic/batches/${id}`, { method: 'DELETE' }),
  courseMeta: () => api('/api/admin/courses/meta'),
  courseOfferings: () => api('/api/admin/courses/offerings'),
  syncCourseFolders: () => api('/api/admin/courses/folders/sync', { method: 'POST' }),
  updateCourseFolder: (id, payload) => api(`/api/admin/courses/folders/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  createCourse: (payload) => api('/api/admin/courses/offerings', { method: 'POST', body: JSON.stringify(payload) }),
  updateCourse: (id, payload) => api(`/api/admin/courses/offerings/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteCourse: (id) => api(`/api/admin/courses/offerings/${id}`, { method: 'DELETE' }),
  videos: (params = {}) => { const qs = new URLSearchParams(Object.entries(params).filter(([,v]) => v !== '' && v != null)); return api(`/api/admin/videos${qs.toString() ? `?${qs}` : ''}`); },
  videoEditor: (id) => api(`/api/admin/videos/${id}`),
  createVideo: (payload) => api('/api/admin/videos', { method:'POST', body:JSON.stringify(payload) }),
  updateVideo: (id,payload) => api(`/api/admin/videos/${id}`, { method:'PATCH', body:JSON.stringify(payload) }),
  saveVideoEditor: (id,payload) => api(`/api/admin/videos/${id}/editor`, { method:'PUT', body:JSON.stringify(payload) }),
  deleteVideo: (id) => api(`/api/admin/videos/${id}`, { method:'DELETE' }),
  moveVideo: (id,direction) => api(`/api/admin/videos/${id}/move`, { method:'POST', body:JSON.stringify({direction}) }),
  progress: () => api('/api/admin/progress'),
  progressHistory: () => api('/api/admin/progress/history'),
  admins: () => api('/api/admin/admins'),
  createAdmin: (payload) => api('/api/admin/admins', { method: 'POST', body: JSON.stringify(payload) }),
  updateAdmin: (id, payload) => api(`/api/admin/admins/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteAdmin: (id) => api(`/api/admin/admins/${id}`, { method: 'DELETE' }),
};


export const studentApi = {
  profile: () => api('/api/student/profile'),
  courses: () => api('/api/student/courses'),
  videos: (offeringId) => api(`/api/student/courses/${offeringId}/videos`),
  video: (videoId) => api(`/api/student/videos/${videoId}`),
  progress: (videoId) => api(`/api/student/videos/${videoId}/progress`),
  saveProgress: (videoId, payload) => api(`/api/student/videos/${videoId}/progress`, { method: 'PUT', body: JSON.stringify(payload) }),
  saveAttempt: (videoId, payload) => api(`/api/student/videos/${videoId}/attempts`, { method: 'POST', body: JSON.stringify(payload) }),
};
