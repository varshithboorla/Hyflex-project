import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import pgSession from 'connect-pg-simple';

import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import adminStudentsRouter from './routes/adminStudents.js';
import adminCoursesRouter from './routes/adminCourses.js';
import adminVideosRouter from './routes/adminVideos.js';
import adminAcademicRouter from './routes/adminAcademic.js';
import adminProgressRouter from './routes/adminProgress.js';
import adminAdminsRouter from './routes/adminAdmins.js';
import studentRouter from './routes/student.js';

const app = express();

const port = Number(process.env.PORT || 5000);
const isProduction = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);

/* =========================================================
   CORS
   ========================================================= */

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://hyflex-project-client.vercel.app'
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests without an Origin header
      // such as server-to-server requests.
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error(`CORS blocked origin: ${origin}`)
      );
    },

    credentials: true,

    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS'
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization'
    ]
  })
);

/* =========================================================
   JSON BODY
   ========================================================= */

app.use(
  express.json({
    limit: '2mb'
  })
);

/* =========================================================
   INVALID JSON HANDLER
   ========================================================= */

app.use((err, _req, res, next) => {
  if (
    err instanceof SyntaxError &&
    err.status === 400 &&
    'body' in err
  ) {
    return res
      .status(400)
      .json({
        message: 'Invalid JSON request body.'
      });
  }

  return next(err);
});

/* =========================================================
   SESSION
   ========================================================= */

const sessionOptions = {
  name: 'hyflex.sid',

  secret: process.env.SESSION_SECRET,

  resave: false,

  saveUninitialized: false,

  cookie: {
    httpOnly: true,

    secure: isProduction,

    sameSite: isProduction
      ? 'none'
      : 'lax',

    maxAge: 1000 * 60 * 60 * 8
  }
};

/*
 * Store sessions in PostgreSQL when DATABASE_URL
 * is available.
 */
if (process.env.DATABASE_URL) {
  sessionOptions.store = new (
    pgSession(session)
  )({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true
  });
}

app.use(session(sessionOptions));

/* =========================================================
   AUTH ROUTES
   ========================================================= */

app.use(
  '/api/auth',
  authRouter
);

/* =========================================================
   ADMIN ROUTES
   ========================================================= */

app.use(
  '/api/admin',
  adminRouter
);

app.use(
  '/api/admin',
  adminStudentsRouter
);

app.use(
  '/api/admin',
  adminCoursesRouter
);

app.use(
  '/api/admin',
  adminVideosRouter
);

app.use(
  '/api/admin',
  adminAcademicRouter
);

app.use(
  '/api/admin',
  adminProgressRouter
);

app.use(
  '/api/admin',
  adminAdminsRouter
);

/* =========================================================
   STUDENT ROUTES
   ========================================================= */

app.use(
  '/api/student',
  studentRouter
);

/* =========================================================
   HEALTH CHECK
   ========================================================= */

app.get(
  '/api/health',
  (_req, res) => {
    res.json({
      ok: true
    });
  }
);

/* =========================================================
   START SERVER
   ========================================================= */

app.listen(
  port,
  '0.0.0.0',
  () => {
    console.log(
      `HyFlex API listening on port ${port}`
    );
  }
);