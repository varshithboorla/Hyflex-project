import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, PlayCircle, Search, X } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { studentApi } from '../../lib/api';

export default function StudentCoursesPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [videos, setVideos] = useState([]);
  const [videosProgress, setVideosProgress] = useState([]);
  const [profile, setProfile] = useState(null);
  const [search, setSearch] = useState('');
  const [videoSearch, setVideoSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    studentApi.profile().then(setProfile).catch(() => {});
    studentApi.courses().then(r => setCourses(r.courses || [])).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!courseId) return;
    setLoading(true); setError('');
    studentApi.videos(courseId).then(r => { setVideos(r.videos || []); setVideosProgress(r.progress || []); }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [courseId]);

  const filteredCourses = useMemo(() => courses.filter(c => `${c.course_name} ${c.course_code || ''}`.toLowerCase().includes(search.toLowerCase())), [courses, search]);
  const filteredVideos = useMemo(() => videos.filter(v => `${v.video_title} ${v.description || ''}`.toLowerCase().includes(videoSearch.toLowerCase())), [videos, videoSearch]);
  const course = courses.find(c => String(c.offering_id) === String(courseId));

  if (courseId) {
    return (
      <section className="student-content">
        <div className="student-video-list-panel">
          <div className="student-list-header">
            <div>
              <div className="student-breadcrumb">
                <button type="button" onClick={() => navigate('/student/courses')}><ArrowLeft size={15} /> My Courses</button>
                <span>/</span><span>{course?.course_name || 'Course'}</span>
              </div>
              <h2>Videos</h2>
              <p>{course?.course_code || 'Course'}{profile?.academicYear?.label ? ` • ${profile.academicYear.label}` : ''}</p>
            </div>
            <span className="student-count">{filteredVideos.length} video{filteredVideos.length === 1 ? '' : 's'}</span>
          </div>

          <div className="student-filter-bar">
            <div className="student-search-wrap"><Search size={16} /><input value={videoSearch} onChange={e => setVideoSearch(e.target.value)} placeholder="Search videos..." /></div>
            {videoSearch && <button type="button" className="student-clear-btn" onClick={() => setVideoSearch('')}><X size={14} /> Clear</button>}
          </div>
          <div className="student-ordering-hint">Videos are shown in the same order configured by your instructor.</div>

          {loading ? <div className="student-loading">Loading videos...</div> : error ? <div className="student-error">{error}</div> : <VideoGrid videos={filteredVideos} progress={videosProgress} courseId={courseId} />}
        </div>
      </section>
    );
  }

  return (
    <section className="student-content">
      <div className="student-section-header">
        {/* <div>
          <h2>My Courses</h2>
          <p>Courses available for <strong>{profile?.semester?.name || 'your semester'}</strong> and <strong>{profile?.branch?.name || profile?.branch?.code || 'your branch'}</strong>.</p>
        </div> */}
        {/* <span className="student-count">{filteredCourses.length} course{filteredCourses.length === 1 ? '' : 's'}</span> */}
      </div>

      <div className="student-filter-bar">
        <div className="student-search-wrap"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search courses..." /></div>
        {search && <button type="button" className="student-clear-btn" onClick={() => setSearch('')}><X size={14} /> Clear</button>}
      </div>

      {loading ? <div className="student-loading">Loading courses...</div> : error ? <div className="student-error">{error}</div> : filteredCourses.length ? <div className="student-course-grid">{filteredCourses.map(c => <CourseCard key={c.offering_id} course={c} />)}</div> : <div className="student-empty">No courses available for your current enrollment.</div>}
    </section>
  );
}

function CourseCard({ course }) {
  const total = Number(course.video_count || 0);
  const completed = Number(course.completed_count || 0);
  const inProgress = Number(course.in_progress_count || 0);
  const notStarted = Number(course.not_started_count || 0);

  return <Link to={`/student/courses/${course.offering_id}`} className="student-course-card">
    <div className="student-course-card-top">
      <div className="student-course-icon"><BookOpen size={20} /></div>
      <span className="student-course-label">COURSE</span>
    </div>

    <div className="student-course-title">
      <h3>{course.course_name}</h3>
      <p>{course.course_code || 'Course'}</p>
    </div>

    <div className="student-course-video-summary">
      <div className="student-course-total">
        <strong>{total}</strong>
        <span>Video{total === 1 ? '' : 's'}</span>
      </div>
      <div className="student-course-status-grid">
        <div><strong>{completed}</strong><span>Completed</span></div>
        <div><strong>{inProgress}</strong><span>In progress</span></div>
        <div><strong>{notStarted}</strong><span>Not started</span></div>
      </div>
    </div>

    <div className="student-course-card-actions"><span>Open course</span><span className="student-course-open-icon"><PlayCircle size={17} /></span></div>
  </Link>;
}

function getVideoStatus(progress) {
  if (progress?.completed) return { label: 'Completed', className: 'completed' };
  if (progress && (Number(progress.max_watched_seconds || 0) > 0 || Number(progress.questions_solved || 0) > 0)) {
    return { label: 'In Progress', className: 'in-progress' };
  }
  return { label: 'Not Started', className: 'not-started' };
}

function VideoGrid({ videos, progress = [], courseId }) {
  if (!videos.length) return <div className="student-empty">No videos are currently available for this course.</div>;
  const progressByVideo = new Map(progress.map(p => [Number(p.video_id), p]));
  return <div className="student-video-grid">{videos.map(v => {
    const status = getVideoStatus(progressByVideo.get(Number(v.video_id)));
    return <Link key={v.video_id} to={`/student/video/${v.video_id}`} state={{ courseId }} className="student-video-card">
      <img src={`https://img.youtube.com/vi/${yt(v.youtube_url)}/hqdefault.jpg`} alt="" />
      <div className="student-video-card-body"><h3>{v.video_title}</h3><p>{v.description || 'Video lesson'}</p><div className="student-video-meta-row"><span className={`student-video-status ${status.className}`}>{status.label}</span><div className="student-video-deadline"><span>Deadline</span><strong>{formatDeadline(v.end_date)}</strong></div></div></div>
    </Link>;
  })}</div>;
}
function formatDeadline(value) {
  if (!value) return 'No deadline';
  const date = new Date(`${String(value).slice(0, 10)}T23:59:59`);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}
function yt(url) { const m = String(url || '').match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/); return m?.[1] || ''; }
