export function Storyboard({ shots }: { shots: any[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {shots.map(s => (
        <div key={s.id} className="p-4 rounded-xl bg-panel-2 border border-panel-3">
          <p className="font-mono text-xs text-muted">{s.id}</p>
          <p className="text-sm text-ink mt-1">{s.line}</p>
        </div>
      ))}
    </div>
  );
}
