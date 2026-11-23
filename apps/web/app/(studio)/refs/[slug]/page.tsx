// apps/web/app/(studio)/refs/[slug]/page.tsx — reference-image gallery for a project.
// One ref per shot. The generate action calls the Evo engine (CSRF + endpoint
// probing) and persists each image into projects/<slug>/ref/ via the pipeline.
import { notFound } from "next/navigation";
import { getProject } from "@pkg/pipeline";
import { StageNav } from "@/app/(studio)/_components/StageNav";
import { generateRefsAction, setRefStageAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function RefsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  const genAction = generateRefsAction.bind(null, slug);
  const approve = setRefStageAction.bind(null, slug);
  const done = project.refs.filter((r) => r.status === "done").length;

  return (
    <main className="page">
      <StageNav slug={slug} active="refs" />
      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Step 03 — the look</p>
            <h1>Reference frames</h1>
            <p className="lede small">
              Each shot gets a still that locks light, mood and palette. The
              animation scenes are anchored to these images, so approve the ones
              that feel right.
            </p>
          </div>
          <span className="tag">{done}/{project.shots.length} generated</span>
        </div>

        <form action={genAction} className="card form-row generate-bar">
          <label className="grow">
            <span className="label">Evo host (optional)</span>
            <input name="host" className="input" placeholder={process.env.SHORTCRAFT_EVO_HOST || "http://localhost:9740"} />
          </label>
          <label className="grow">
            <span className="label">API key (optional)</span>
            <input name="apiKey" type="password" className="input" placeholder="use server default" />
          </label>
          <button type="submit" className="btn-primary">Generate references →</button>
        </form>

        {project.shots.length === 0 ? (
          <div className="card empty muted">No shots yet — add them in the Story page first.</div>
        ) : (
          <div className="grid refs-grid">
            {project.shots.map((shot) => {
              const ref = project.refs.find((r) => r.shotId === shot.id);
              const status = ref?.status || "pending";
              return (
                <div className="card ref-card" key={shot.id}>
                  <div className="flex-between">
                    <span className="mono accent">{shot.id}</span>
                    <span className={`status status-${status}`}>{status}</span>
                  </div>
                  <div className="ref-image">
                    {ref?.image ? (
                      <img src={`/api/ref/${slug}/${ref.image}`} alt={`Reference for ${shot.id}`} />
                    ) : (
                      <span className="muted small">No reference yet</span>
                    )}
                  </div>
                  <p className="small ink">{shot.scene}</p>
                  {ref?.promptPreview && <p className="small muted">{ref.promptPreview}</p>}
                  {ref?.error && <p className="small error mono">{ref.error}</p>}
                  {ref?.image && (
                    <form action={approve.bind(null, ref.id, ref.stage === "approved" ? "draft" : "approved")}>
                      <button type="submit" className={ref.stage === "approved" ? "btn-approve on" : "btn-approve"}>
                        {ref.stage === "approved" ? "✓ Approved — click to unapprove" : "Approve this frame"}
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
