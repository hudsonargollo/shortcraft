export function RefGrid({ refs }: { refs: any[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {refs.map(r => (
        <img key={r.id} src={r.preview} alt={r.shot} className="w-full h-32 object-cover rounded-xl bg-panel-3" />
      ))}
    </div>
  );
}
