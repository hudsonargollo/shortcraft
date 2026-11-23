import Link from "next/link";
import { listProjects } from "@pkg/pipeline";
import { StageNav } from "./_components/StageNav";

export const dynamic = "force-dynamic";

export default async function StudioIndex() {
  const projects = listProjects();
  return (
    <main className="page">
      <StageNav />
      <section className="hero">
        <p className="eyebrow">Script to screen</p>
        <h1>Every story deserves a scene.</h1>
        <p className="lede">
          Paste a script. Shortcraft turns it into shots, reference frames, a
          storyboard, and a narrated animated video — one project at a time.
        </p>
        <Link href="/script/new" className="btn-primary">Start a new video →</Link>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Your projects</h2>
          <span className="muted">{projects.length} total</span>
        </div>
        {projects.length === 0 ? (
          <div className="card empty">
            <p className="muted">No projects yet. Your first video starts with a script.</p>
          </div>
        ) : (
          <div className="grid">
            {projects.map((p) => (
              <Link key={p.slug} href={`/story/${p.slug}`} className="card project-card">
                <div className="flex-between">
                  <span className="tag">{p.config.style}</span>
                  <span className="muted mono">{p.config.aspect}</span>
                </div>
                <h3>{p.config.title}</h3>
                <p className="muted small">{p.shots.length} shots · {Math.round(p.duration || 0)}s</p>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${Math.min(100, p.shots.length ? (p.refs.filter((r) => r.status === "done").length / p.shots.length) * 100 : 0)}%` }}
                  />
                </div>
                <span className="small accent">Continue →</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
