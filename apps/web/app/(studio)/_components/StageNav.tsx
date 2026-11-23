import Link from "next/link";

export function StageNav({ slug, active }: { slug?: string; active?: string }) {
  const stages = [
    { id: "story", label: "Story", href: `/story/${slug}` },
    { id: "refs", label: "References", href: `/refs/${slug}` },
    { id: "storyboard", label: "Storyboard", href: `/storyboard/${slug}` },
    { id: "build", label: "Build", href: `/build/${slug}` },
    { id: "video", label: "Video", href: `/video/${slug}` },
  ];
  return (
    <nav className="nav" aria-label="Project stages">
      <Link href="/" className="brand">Shortcraft</Link>
      {slug && stages.map((s) => (
        <Link key={s.id} href={s.href} className={active === s.id ? "nav-link active" : "nav-link"}>
          {s.label}
        </Link>
      ))}
    </nav>
  );
}
