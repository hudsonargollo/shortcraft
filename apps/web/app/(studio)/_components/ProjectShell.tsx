export async function ProjectShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="glass rounded-2xl p-5 border border-panel-2">{children}</div>
    </main>
  );
}

export default ProjectShell;
