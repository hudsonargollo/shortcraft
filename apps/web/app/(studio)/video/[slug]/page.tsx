import { notFound } from "next/navigation";
import { getProject, renderStatus, videoFilePath } from "@pkg/pipeline";
import { StageNav } from "@/app/(studio)/_components/StageNav";

export const dynamic = "force-dynamic";

export default async function VideoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();
  const status = renderStatus(slug);
  const hasVideo = !!videoFilePath(slug);

  return (
    <main className="page">
      <StageNav slug={slug} active="video" />
      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Step 06 — the result</p>
            <h1>{project.config.title}</h1>
            <p className="lede small">
              {hasVideo ? "Your video is ready." : "Render the project in the Build stage to see it here."}
            </p>
          </div>
          {hasVideo && (
            <a className="btn-primary" href={`/api/video?slug=${encodeURIComponent(slug)}`} download>
              Download MP4 ↓
            </a>
          )}
        </div>
        {hasVideo ? (
          <div className="video-wrap card">
            <video controls playsInline src={`/api/video?slug=${encodeURIComponent(slug)}`} />
          </div>
        ) : (
          <div className="card empty muted">No video yet — head to Build and start a render.</div>
        )}
      </section>
    </main>
  );
}
