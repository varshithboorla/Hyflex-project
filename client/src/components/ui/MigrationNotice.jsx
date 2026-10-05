export default function MigrationNotice({ source, children }) {
  return <div className="rounded-xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
    <p className="font-semibold">React page structure ready</p>
    <p className="mt-1">This page is being migrated from <code className="rounded bg-white px-1.5 py-0.5">{source}</code>. Existing functionality is retained in the migration source and will be moved into this page without removing features.</p>
    {children}
  </div>;
}
