// apps/web/app/(studio)/story/[slug]/page.tsx — editable shot bible.
// A server component renders the shots; a tiny client editor saves the list as JSON.
import { notFound } from "next/navigation";
import { getProject } from "@pkg/pipeline";
import { StageNav } from "@/app/(studio)/_components/StageNav";
import ShotEditor from "./ShotEditor";

export const dynamic = "force-dynamic";

export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  return (
    <main className="page">
      <StageNav slug={slug} active="story" />
      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Step 02 — the shots</p>
            <h1>{project.config.title}</h1>
            <p className="lede small">
              Each line is one shot. Edit the scene (what we see), the line (what is
              said), and the set. Timing stays contiguous — change start/end together.
            </p>
          </div>
          <span className="tag">{project.shots.length} shots · {Math.round(project.duration)}s</span>
        </div>
        <ShotEditor slug={slug} shots={project.shots} />
      </section>
    </main>
  );
}
