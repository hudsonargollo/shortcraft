export function ShotCard({ shot }: { shot: any }) {
  return (
    <div className="p-4 rounded-xl bg-panel-2 border border-panel-3">
      <p className="font-mono text-xs text-muted">{shot.id}</p>
      <p className="text-sm text-ink mt-1">{shot.line}</p>
    </div>
  );
}
