const content = {
  students: ['Students', 'Add, search, edit and move students. This section is the next migration step.'],
  courses: ['Courses', 'Manage courses and their videos. This section will be migrated from courses.html next.'],
  academic: ['Academic Setup', 'Manage academic years, semesters, branches, batches and subjects.'],
  progress: ['Video Progress', 'View completion status, student progress and progress history.'],
  admins: ['Admins', 'Manage administrator accounts and access.'],
};

export default function PlaceholderSection({ section }) {
  const [title, description] = content[section] || ['Section', ''];
  return <section><div className="mb-6"><h2 className="text-xl font-bold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div><div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center"><p className="text-sm font-semibold text-slate-700">{title} migration is ready to be built here.</p><p className="mt-2 text-xs text-slate-500">The navigation and SPA shell are already connected.</p></div></section>;
}
