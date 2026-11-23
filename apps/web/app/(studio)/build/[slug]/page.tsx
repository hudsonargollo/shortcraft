import { notFound } from "next/navigation";
import { getProject, renderStatus, scenesDir } from "@pkg/pipeline";
import fs from "node:fs";
import { StageNav } from "@/app/(studio)/_components/StageNav";
import { startRenderAction } from "@/lib/actions";
import BuildPoller from "./BuildPoller";

export const dynamic = "force-dynamic";

export default async function BuildPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();
  const status = renderStatus(slug);
  const render = startRenderAction.bind(null, slug);
  const sceneFiles = fs.existsSync(scenesDir(slug))
    ? fs.readdirSync(scenesDir(slug)).filter((f) => f.endsWith(".js"))
    : [];

  return (
    <main className="page">
      <StageNav slug={slug} active="build" />
      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Step 05 — the render</p>
            <h1>Build the video</h1>
            <p className="lede small">
              The app generates one scene stub per shot and hands them to the kit's
              renderer. Chromium draws the frames, ffmpeg muxes them, and the
              result lands in your project folder.
            </p>
          </div>
          <form action={render}>
            <button type="submit" className="btn-primary">Generate scenes & render →</button>
          </form>
        </div>

        <div className="grid two-col">
          <div className="card">
            <h2 className="card-title">Render status</h2>
            <BuildPoller slug={slug} initial={status} />
          </div>
          <div className="card">
            <h2 className="card-title">Scene files</h2>
            {sceneFiles.length === 0 ? (
              <p className="muted small">No scene files yet — they are created when you render.</p>
            ) : (
              <ul className="file-list mono small">
                {sceneFiles.map((f) => <li key={f}>{f}</li>)}
              </ul>
            )}
            <p className="muted small mt-2">
              Edit these in <span className="mono">projects/{slug}/scenes/shots/</span> to
              replace stubs with real animation code (registerShot + draw).
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
