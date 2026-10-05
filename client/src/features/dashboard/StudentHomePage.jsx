  import { useEffect, useState } from 'react';
import { studentApi } from '../../lib/api';

export default function StudentHomePage() {
  const [data, setData] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([studentApi.getProfile(), studentApi.getCourses()])
      .then(([profile, courseData]) => { setData(profile); setCourses(courseData.courses || []); })
      .catch(e => setError(e.message || 'Unable to load student profile.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="student-loading">Loading student portal...</div>;
  if (error) return <div className="student-error">{error}</div>;

  const s = data.student;
  return (
    <section className="student-content">
      <div className="student-welcome">
        <h2>Welcome, <span>{s.first_name || 'Student'}</span></h2>
        <p>Your academic information and learning progress.</p>
      </div>

      <div className="student-info-grid">
        <Info label="Roll Number" value={s.roll_number} />
        <Info label="Email" value={s.email} />
        <Info label="First Name" value={s.first_name} />
        <Info label="Last Name" value={s.last_name} />
        <Info label="Branch" value={data.branch?.name || data.branch?.code} />
        <Info label="Semester" value={data.semester?.name || `Semester ${data.semester?.semester_number || '-'}`} />
        <Info label="Batch" value={data.batch?.label} />
        <Info label="Regulation" value={data.regulation?.name || data.regulation?.code} />
        <Info label="Academic Year" value={data.academicYear?.label} />
      </div>

      <div className="student-learning-summary">
        <div>
          <span>Current Courses</span>
          <strong>{courses.length}</strong>
        </div>
        <div>
          <span>Academic Year</span>
          <strong>{data.academicYear?.label || '-'}</strong>
        </div>
        <div>
          <span>Semester</span>
          <strong>{data.semester?.name || '-'}</strong>
        </div>
      </div>
    </section>
  );
}

function Info({ label, value }) {
  return <div className="student-info-card"><span>{label}</span><strong>{value || '-'}</strong></div>;
}
