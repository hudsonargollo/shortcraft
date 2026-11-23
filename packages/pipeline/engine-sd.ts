// packages/pipeline/engine-sd.ts — generic SD image-generation adapter.
//
// Generation is driven by an SD-compatible endpoint. The web app calls this from
// a server action with network access to the host. This module turns a processed
// ref prompt into bytes that the caller persists via saveRefImage() into
// projects/<slug>/ref/<shot>_<id>.png, keeping the kit's render.mjs contract.
//
// For the local Evo engine with CSRF + endpoint probing, prefer engine-evolution.ts.

import type { SDRef, SDProject, SDBoardFrame } from "./index";
import type { ShotRefPrompt } from "./prompts";

export interface GenOptions {
  api: string;
  secret?: string;
  model?: string;
  aspect: "9:16" | "16:9";
  resolution: "720p" | "1080p" | "1440p" | "2160p";
}

const DEFAULT_MODEL = "sd-xl";

export interface GenerationResult {
  ok: boolean;
  bytes?: Uint8Array;
  error?: string;
}

/** Call a generic /images/generations-style endpoint and download the image. */
export async function generateReferenceImage(
  ref: SDRef,
  rawPrompt: ShotRefPrompt,
  options: GenOptions,
): Promise<GenerationResult> {
  try {
    const body = {
      prompt: rawPrompt.prompt,
      negative_prompt: rawPrompt.negative,
      n: 1,
      size: options.aspect === "9:16" ? "1080x1920" : "1280x720",
      model: options.model || DEFAULT_MODEL,
      seed: ref.seed,
    };
    const res = await fetch(`${options.api.replace(/\/$/, "")}/images/generations`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(options.secret ? { "x-api-key": options.secret } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) return { ok: false, error: `SD returned HTTP ${res.status}` };

    const j = await res.json().catch(() => null);
    const jAny = j as Record<string, unknown> | null;
    const url = typeof jAny?.url === "string"
      ? jAny.url
      : Array.isArray(jAny?.data)
        ? (jAny!.data as Record<string, unknown>[]).find((d) => typeof d?.url === "string")?.url as string | undefined
        : undefined;
    if (!url) return { ok: false, error: "SD returned no image URL" };

    const img = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!img.ok) return { ok: false, error: `image fetch HTTP ${img.status}` };
    const bytes = new Uint8Array(await img.arrayBuffer());
    if (!bytes.length) return { ok: false, error: "empty image" };
    return { ok: true, bytes };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Stable ref filename for a shot + ref id (used by saveRefImage). */
export function refImageName(ref: SDRef): string {
  return `${ref.shotId}_${ref.id.slice(-8)}.png`;
}

// Deduplicate ref prompts by prompt hash so we don't re-send identical prompts.
export function fingerprint(prompt: string, negative: string): string {
  let h = 0;
  for (let i = 0; i < prompt.length; i++) h = (h * 31 + prompt.charCodeAt(i)) >>> 0;
  for (let i = 0; i < negative.length; i++) h = (h * 31 + negative.charCodeAt(i)) >>> 0;
  return `${h & 0xffff}`.padStart(4, "0");
}

export function cachedRefFilenames(project: SDProject, shotId: string): string[] {
  return project.refs
    .filter((r) => r.shotId === shotId && r.status === "done")
    .map((r) => r.image || "");
}

/** Build storyboard frames from the approved refs for a shot. */
export function boardFramesForShot(project: SDProject, shotId: string, t: number): SDBoardFrame[] {
  return project.refs
    .filter((r) => r.shotId === shotId && r.stage === "approved" && r.status === "done" && r.image)
    .map((r) => ({
      shotId,
      image: r.image!,
      caption: r.promptPreview || r.prompt,
      time: t,
      label: r.id,
    }));
}
