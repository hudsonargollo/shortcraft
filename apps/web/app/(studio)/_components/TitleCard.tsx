export function TitleCard({ title, slug }: { title: string; slug: string }) {
  return (
    <div className="text-center">
      <h1 className="text-3xl font-bold text-ink">{title}</h1>
      <p className="text-muted mt-1">{slug}</p>
    </div>
  );
}
