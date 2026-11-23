import { notFound } from "next/navigation";
import { getProject } from "@pkg/pipeline";
import { StageNav } from "@/app/(studio)/_components/StageNav";
import { syncBoardAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function StoryboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();
  const sync = syncBoardAction.bind(null, slug);

  return (
    <main className="page">
      <StageNav slug={slug} active="storyboard" />
      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Step 04 — the sequence</p>
            <h1>Storyboard</h1>
            <p className="lede small">
              Approved reference frames, in order. This is the artifact animation
              reviewers sign off on before the render.
            </p>
          </div>
          <form action={sync}>
            <button type="submit" className="btn-secondary">Sync from approved refs →</button>
          </form>
        </div>

        {project.boards.length === 0 ? (
          <div className="card empty muted">
            No frames yet. Approve reference images, then sync to build the board.
          </div>
        ) : (
          <div className="board">
            {project.boards.map((frame, i) => (
              <div className="board-frame" key={`${frame.shotId}-${i}`}>
                <div className="board-image">
                  <img src={`/api/ref/${slug}/${frame.image}`} alt={frame.label} />
                </div>
                <div className="board-meta">
                  <span className="mono accent">{frame.shotId}</span>
                  <span className="muted small">@{frame.time.toFixed(1)}s</span>
                  <p className="small">{frame.caption}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
