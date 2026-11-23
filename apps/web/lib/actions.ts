// apps/web/lib/actions.ts — server actions for the Shortcraft studio.
// Every action validates its inputs, calls packages/pipeline, and revalidates
// the affected route. No secrets are accepted from the browser other than an
// explicitly-entered engine key, which is passed straight to the engine client.

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createProject,
  getProject,
  saveShots,
  saveRefs,
  saveBoards,
  saveRefImage,
  newRef,
  generateScenes,
  startRender,
  generateLocal,
  generate,
  type Shot,
  type SDRef,
} from "@pkg/pipeline";
import { refImageName } from "@pkg/pipeline/engine-sd";
import { buildShotRefPrompt, type ProjectConfig } from "@pkg/pipeline/prompts";

function refresh(slug: string, stage: string) {
  revalidatePath(`/story/${slug}`);
  revalidatePath(`/refs/${slug}`);
  revalidatePath(`/storyboard/${slug}`);
  revalidatePath(`/build/${slug}`);
  revalidatePath(`/video/${slug}`);
  if (stage) revalidatePath(stage);
}

/** Script intake: create a project and its beats/shots skeleton, then go to Story. */
export async function createProjectAction(form: FormData): Promise<void> {
  const title = String(form.get("title") || "").trim() || "Untitled video";
  const script = String(form.get("script") || "").trim();
  const aspect = String(form.get("aspect") || "16:9") === "9:16" ? "9:16" : "16:9";
  const style = String(form.get("style") || "emerald");
  const project = createProject(title, { script, aspect, style });
  revalidatePath("/");
  redirect(`/story/${project.slug}`);
}

/** Save the editable shot list from the Story page. */
export async function saveShotsAction(slug: string, raw: string): Promise<void> {
  const p = getProject(slug);
  if (!p) throw new Error("Project not found");
  let shots: Shot[];
  try {
    shots = JSON.parse(raw) as Shot[];
  } catch {
    throw new Error("Invalid shot JSON");
  }
  if (!Array.isArray(shots)) throw new Error("Shots must be a list");
  saveShots(slug, shots);
  refresh(slug, "/");
}

/** Generate reference images for all shots that don't have a done ref yet. */
export async function generateRefsAction(slug: string, form: FormData): Promise<void> {
  const p = getProject(slug);
  if (!p) throw new Error("Project not found");
  const host = String(form.get("host") || "").trim();
  const apiKey = String(form.get("apiKey") || "").trim();
  const engineConfig = {
    ...(host ? { host } : {}),
    ...(apiKey ? { apiKey } : {}),
  };
  const isLocal = Boolean(host) && !apiKey;
  const engine = isLocal ? "local" : "evolution";
  const cfg: ProjectConfig = {
    aspect: p.config.aspect,
    resolution: p.config.resolution,
    style: p.config.style,
    fps: p.config.fps,
    engine: isLocal ? "sd" : "evolution",
  };

  const changed: SDRef[] = [...p.refs];
  for (const shot of p.shots) {
    const existing = changed.find((r) => r.shotId === shot.id && r.status === "done");
    if (existing) continue;
    const ref = changed.find((r) => r.shotId === shot.id) || newRef(shot.id, p.config.aspect);
    const prompt = buildShotRefPrompt(
      { ...shot, set: shot.set || null, notes: shot.notes || "", bars: shot.bars || null, in: shot.in || { type: "cut" } },
      cfg,
    );
    ref.prompt = prompt.prompt;
    ref.negative = prompt.negative;
    ref.promptPreview = prompt.promptPreview;
    ref.status = "processing";
    ref.updatedAt = Math.floor(Date.now() / 1000);
    const res = isLocal
      ? await generateLocal(
          prompt.prompt,
          prompt.negative,
          { aspect: p.config.aspect, seed: ref.seed, host: engineConfig.host, apiKey: engineConfig.apiKey },
        )
      : await generate(
          prompt,
          { aspect: p.config.aspect, seed: ref.seed, config: { host: engineConfig.host, apiKey: engineConfig.apiKey } },
        );
    if (res.ok && res.bytes) {
      const filename = refImageName(ref);
      if (saveRefImage(slug, filename, res.bytes)) {
        ref.image = filename;
        ref.status = "done";
        ref.error = undefined;
      } else {
        ref.status = "failed";
        ref.error = "could not persist image";
      }
    } else {
      ref.status = "failed";
      ref.error = res.error || "generation failed";
    }
    const idx = changed.findIndex((r) => r.shotId === shot.id);
    if (idx >= 0) changed[idx] = ref;
    else changed.push(ref);
  }
  saveRefs(slug, changed);
  refresh(slug, "/");
}

/** Approve or un-approve a single ref (approved refs drive the storyboard). */
export async function setRefStageAction(slug: string, refId: string, stage: "draft" | "approved"): Promise<void> {
  const p = getProject(slug);
  if (!p) return;
  saveRefs(slug, p.refs.map((r) => (r.id === refId ? { ...r, stage } : r)));
  refresh(slug, "/");
}

/** Sync storyboard frames from approved refs (one frame per shot). */
export async function syncBoardAction(slug: string): Promise<void> {
  const p = getProject(slug);
  if (!p) return;
  const frames = p.shots.flatMap((shot) => {
    const approved = p.refs.find((r) => r.shotId === shot.id && r.stage === "approved" && r.status === "done" && r.image);
    return approved
      ? [{ shotId: shot.id, image: approved.image!, caption: approved.promptPreview || approved.prompt, time: shot.start, label: shot.id }]
      : [];
  });
  saveBoards(slug, frames);
  refresh(slug, "/");
}

/** Generate scene stubs for every shot, then start the render subprocess. */
export async function startRenderAction(slug: string): Promise<void> {
  const p = getProject(slug);
  if (!p) throw new Error("Project not found");
  if (!p.shots.length) throw new Error("No shots to render — add shots in Story first");
  generateScenes(slug);
  startRender(slug);
  refresh(slug, "/");
}
