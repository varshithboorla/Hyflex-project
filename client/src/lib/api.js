// client/src/lib/api.js

const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'https://hyflex-project.onrender.com';

/**
 * Main API helper
 * All requests go through the Node/Express backend.
 */
export async function api(path, options = {}) {
  const {
    method = 'GET',
    body,
    headers = {},
    ...rest
  } = options;

  const config = {
    method,
    credentials: 'include',
    ...rest,
    headers: {
      ...headers,
    },
  };

  // Only add Content-Type when we actually send a body.
  if (body !== undefined && body !== null) {
    config.headers['Content-Type'] = 'application/json';

    config.body =
      typeof body === 'string'
        ? body
        : JSON.stringify(body);
  }

  const response = await fetch(
    `${API_BASE_URL}${path}`,
    config
  );

  // Handle empty responses safely
  const contentType = response.headers.get('content-type') || '';

  let data;

  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const message =
      typeof data === 'object'
        ? data?.error ||
          data?.message ||
          `Request failed with status ${response.status}`
        : data || `Request failed with status ${response.status}`;

    const error = new Error(message);
    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
}

/* =========================================================
   AUTH
   ========================================================= */

export const authApi = {
  login: (payload) =>
    api('/api/auth/login', {
      method: 'POST',
      body: payload,
    }),

  me: () =>
    api('/api/auth/me'),

  logout: () =>
    api('/api/auth/logout', {
      method: 'POST',
    }),
};


/* =========================================================
   ADMIN - STUDENTS
   ========================================================= */

export const adminApi = {
  /* ---------- Students ---------- */

  getStudents: (params = {}) => {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (
        value !== undefined &&
        value !== null &&
        value !== ''
      ) {
        query.set(key, value);
      }
    });

    const queryString = query.toString();

    return api(
      `/api/admin/students${queryString ? `?${queryString}` : ''}`
    );
  },

  createStudent: (payload) =>
    api('/api/admin/students', {
      method: 'POST',
      body: payload,
    }),

  updateStudent: (id, payload) =>
    api(`/api/admin/students/${id}`, {
      method: 'PATCH',
      body: payload,
    }),

  deleteStudents: (student_ids) =>
    api('/api/admin/students', {
      method: 'DELETE',
      body: {
        student_ids,
      },
    }),

  moveStudents: (payload) =>
    api('/api/admin/students/move', {
      method: 'POST',
      body: payload,
    }),

  getStudent: (id) =>
    api(`/api/admin/students/${id}`),

  /* ---------- Student-related data ---------- */

  getBranches: () =>
    api('/api/admin/students/branches'),

  getBatches: () =>
    api('/api/admin/students/batches'),

  getSemesters: () =>
    api('/api/admin/students/semesters'),

  getAcademicYears: () =>
    api('/api/admin/students/academic-years'),
};


/* =========================================================
   ADMIN - DASHBOARD
   ========================================================= */

export const dashboardApi = {
  getDashboard: () =>
    api('/api/admin/dashboard'),
};


/* =========================================================
   ADMIN - ACADEMIC
   ========================================================= */

export const academicApi = {
  getAcademicYears: () =>
    api('/api/admin/academic/years'),

  createAcademicYear: (payload) =>
    api('/api/admin/academic/years', {
      method: 'POST',
      body: payload,
    }),

  updateAcademicYear: (id, payload) =>
    api(`/api/admin/academic/years/${id}`, {
      method: 'PATCH',
      body: payload,
    }),

  deleteAcademicYear: (id) =>
    api(`/api/admin/academic/years/${id}`, {
      method: 'DELETE',
    }),

  getRegulations: () =>
    api('/api/admin/academic/regulations'),

  createRegulation: (payload) =>
    api('/api/admin/academic/regulations', {
      method: 'POST',
      body: payload,
    }),

  updateRegulation: (id, payload) =>
    api(`/api/admin/academic/regulations/${id}`, {
      method: 'PATCH',
      body: payload,
    }),

  deleteRegulation: (id) =>
    api(`/api/admin/academic/regulations/${id}`, {
      method: 'DELETE',
    }),

  getBatches: () =>
    api('/api/admin/academic/batches'),

  createBatch: (payload) =>
    api('/api/admin/academic/batches', {
      method: 'POST',
      body: payload,
    }),

  updateBatch: (id, payload) =>
    api(`/api/admin/academic/batches/${id}`, {
      method: 'PATCH',
      body: payload,
    }),

  deleteBatch: (id) =>
    api(`/api/admin/academic/batches/${id}`, {
      method: 'DELETE',
    }),

  getSemesters: () =>
    api('/api/admin/academic/semesters'),

  getBranches: () =>
    api('/api/admin/academic/branches'),
};


/* =========================================================
   ADMIN - COURSES
   ========================================================= */

export const coursesApi = {
  getCourses: (params = {}) => {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (
        value !== undefined &&
        value !== null &&
        value !== ''
      ) {
        query.set(key, value);
      }
    });

    const queryString = query.toString();

    return api(
      `/api/admin/courses${queryString ? `?${queryString}` : ''}`
    );
  },

  getCourse: (id) =>
    api(`/api/admin/courses/${id}`),

  createCourse: (payload) =>
    api('/api/admin/courses', {
      method: 'POST',
      body: payload,
    }),

  updateCourse: (id, payload) =>
    api(`/api/admin/courses/${id}`, {
      method: 'PATCH',
      body: payload,
    }),

  deleteCourse: (id) =>
    api(`/api/admin/courses/${id}`, {
      method: 'DELETE',
    }),

  getOfferings: (params = {}) => {
    const query = new URLSearchParams(params).toString();

    return api(
      `/api/admin/courses/offerings${query ? `?${query}` : ''}`
    );
  },

  getFolders: (params = {}) => {
    const query = new URLSearchParams(params).toString();

    return api(
      `/api/admin/courses/folders${query ? `?${query}` : ''}`
    );
  },
};


/* =========================================================
   ADMIN - VIDEOS
   ========================================================= */

export const videosApi = {
  getVideos: (params = {}) => {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (
        value !== undefined &&
        value !== null &&
        value !== ''
      ) {
        query.set(key, value);
      }
    });

    const queryString = query.toString();

    return api(
      `/api/admin/videos${queryString ? `?${queryString}` : ''}`
    );
  },

  getVideo: (id) =>
    api(`/api/admin/videos/${id}`),

  createVideo: (payload) =>
    api('/api/admin/videos', {
      method: 'POST',
      body: payload,
    }),

  updateVideo: (id, payload) =>
    api(`/api/admin/videos/${id}`, {
      method: 'PATCH',
      body: payload,
    }),

  deleteVideo: (id) =>
    api(`/api/admin/videos/${id}`, {
      method: 'DELETE',
    }),

  addQuestion: (videoId, payload) =>
    api(`/api/admin/videos/${videoId}/questions`, {
      method: 'POST',
      body: payload,
    }),

  updateQuestion: (questionId, payload) =>
    api(`/api/admin/videos/questions/${questionId}`, {
      method: 'PATCH',
      body: payload,
    }),

  deleteQuestion: (questionId) =>
    api(`/api/admin/videos/questions/${questionId}`, {
      method: 'DELETE',
    }),
};


/* =========================================================
   ADMIN - PROGRESS
   ========================================================= */

export const progressApi = {
  getProgress: (params = {}) => {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (
        value !== undefined &&
        value !== null &&
        value !== ''
      ) {
        query.set(key, value);
      }
    });

    const queryString = query.toString();

    return api(
      `/api/admin/progress${queryString ? `?${queryString}` : ''}`
    );
  },

  getStudentProgress: (studentId, params = {}) => {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (
        value !== undefined &&
        value !== null &&
        value !== ''
      ) {
        query.set(key, value);
      }
    });

    const queryString = query.toString();

    return api(
      `/api/admin/progress/student/${studentId}${
        queryString ? `?${queryString}` : ''
      }`
    );
  },
};


/* =========================================================
   ADMIN - HISTORY
   ========================================================= */

export const historyApi = {
  getHistory: (params = {}) => {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (
        value !== undefined &&
        value !== null &&
        value !== ''
      ) {
        query.set(key, value);
      }
    });

    const queryString = query.toString();

    return api(
      `/api/admin/history${queryString ? `?${queryString}` : ''}`
    );
  },

  getStudentHistory: (studentId) =>
    api(`/api/admin/history/student/${studentId}`),
};


/* =========================================================
   ADMIN - ADMINS
   ========================================================= */

export const adminsApi = {
  getAdmins: () =>
    api('/api/admin/admins'),

  createAdmin: (payload) =>
    api('/api/admin/admins', {
      method: 'POST',
      body: payload,
    }),

  updateAdmin: (id, payload) =>
    api(`/api/admin/admins/${id}`, {
      method: 'PATCH',
      body: payload,
    }),

  deleteAdmin: (id) =>
    api(`/api/admin/admins/${id}`, {
      method: 'DELETE',
    }),
};


/* =========================================================
   STUDENT
   ========================================================= */

export const studentApi = {
  /* ---------- Profile ---------- */

  getProfile: () =>
    api('/api/student/profile'),

  /* ---------- Courses ---------- */

  getCourses: (params = {}) => {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (
        value !== undefined &&
        value !== null &&
        value !== ''
      ) {
        query.set(key, value);
      }
    });

    const queryString = query.toString();

    return api(
      `/api/student/courses${queryString ? `?${queryString}` : ''}`
    );
  },

  getCourse: (courseId) =>
    api(`/api/student/courses/${courseId}`),

  /* ---------- Videos ---------- */

  getVideo: (videoId) =>
    api(`/api/student/videos/${videoId}`),

  getCourseVideos: (courseId) =>
    api(`/api/student/courses/${courseId}/videos`),

  /* ---------- Video Progress ---------- */

  getVideoProgress: (videoId) =>
    api(`/api/student/videos/${videoId}/progress`),

  saveVideoProgress: (videoId, payload) =>
    api(`/api/student/videos/${videoId}/progress`, {
      method: 'POST',
      body: payload,
    }),

  updateVideoProgress: (videoId, payload) =>
    api(`/api/student/videos/${videoId}/progress`, {
      method: 'PATCH',
      body: payload,
    }),

  /* ---------- Question Attempts ---------- */

  submitQuestion: (videoId, payload) =>
    api(`/api/student/videos/${videoId}/questions/attempt`, {
      method: 'POST',
      body: payload,
    }),

  getQuestionAttempts: (videoId) =>
    api(`/api/student/videos/${videoId}/questions/attempts`),
};


/* =========================================================
   DEFAULT EXPORT
   ========================================================= */

export default api;