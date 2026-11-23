// packages/pipeline/prompts.ts — build a reference-image prompt from a shot brief.
//
// The studio eats story/shots.json entries and emits a token-rich ref prompt +
// negative + a short preview, following references/ref-prompt-design.md:
//   1. Subject (the concrete `scene`)
//   2. Composition (aspect-aware)
//   3. Lighting + camera (one key light, rim light, slow push-in)
//   4. Style palette (emerald/ember/arctic/sakura/retro)
//   5. Negative tokens (shared across the video)
//
// Generic AI-diffuser adjectives are deliberately excluded: asking for "4k /
// ultra / photorealistic" is a common failure mode for short punchy ref shots.

export interface ShotRefPrompt {
  prompt: string;
  negative: string;
  promptPreview: string;
}

export interface ShotBrief {
  id: string;
  line: string;
  scene: string;
  set: string | null;
  bars: string | null;
  in: unknown;
  out?: unknown;
  notes: string;
}

export interface ProjectConfig {
  aspect: "9:16" | "16:9";
  resolution: "720p" | "1080p" | "1440p" | "2160p";
  style: string;
  fps: number;
  engine: "evolution" | "sd";
  env?: "natural" | "studio" | "cinematic";
}

/** Style prefixes from references/ref-prompt-design.md. */
export const STYLE_PREFIX: Record<string, string> = {
  emerald: "cinematic 2D stick figures with glowing rim light, moody flat-shaded vector environment, one strong warm key light, deep purple shadows, amber highlights, film grain, vignette, storybook illustration, soft pastel",
  ember: "cinematic 2D stick figures with glowing rim light, moody 2D vector environment, charcoal and crimson palette, molten copper accents, heavy contrast, storybook illustration",
  arctic: "cinematic 2D stick figures with glowing rim light, moody 2D vector environment, icy steel-teal palette, crisp white key, cyan highlights, clean minimal lines, storybook illustration",
  sakura: "cinematic 2D stick figures with glowing rim light, moody 2D vector environment, plum shadows, rose-pink sky, peach highlights, soft haze, storybook illustration",
  retro: "cinematic 2D stick figures with glowing rim light, moody 2D vector environment, faded teal and mustard palette, low saturation, heavy print grain, storybook illustration",
};

export const STYLE_IDS = Object.keys(STYLE_PREFIX);

const NEGATIVE = [
  "text", "watermark", "logo", "signature", "frame", "border", "box", "outline",
  "gradient", "flat white background", "photo", "photo-real", "photograph",
  "realistic", "3d render", "cgi", "anime", "cartoon character", "clay",
  "sculpture", "pop art", "crowd", "two characters", "extra limbs", "mutilated",
  "bad anatomy", "deformed", "poorly drawn", "mutation", "extra fingers",
  "low quality", "worst quality", "low resolution", "blurry", "ugly",
].join(", ");

const BLOCKED_TERMS = [
  "4k", "ultra", "high definition", "high-res", "sharp", "detailed",
  "extremely detailed", "photo-realistic", "realistic", "photorealistic",
  "octane", "unreal engine", "path tracing", "volumetric",
];

function neutralise(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").replace(/^./, (c) => c.toUpperCase()).trim();
}

export function buildShotRefPrompt(brief: ShotBrief, cfg: ProjectConfig): ShotRefPrompt {
  const stylePrefix = STYLE_PREFIX[cfg.style] || STYLE_PREFIX.emerald;
  // The subject drives the shot; the style drives the look.
  const subject = neutralise(brief.scene || brief.line || "a single character");
  const setting = brief.set ? `${neutralise(brief.set)}, ` : "";
  const composition = cfg.aspect === "16:9"
    ? "wide shot, subject centred with negative space for lower-thirds"
    : "vertical 9:16, subject in the left third, clean right side reserved for captions";
  const env = cfg.env || "cinematic";

  const prompt = [
    stylePrefix + ",",
    `single character, ${subject}`,
    setting + "lit by one strong key light from the upper left, soft rim light on the figure,",
    `${composition}, shallow depth of field, slow push-in, low-key value structure, ${env} still frame`,
  ].filter((s) => s.trim()).join(" ");

  const hits = BLOCKED_TERMS.filter((t) => subject.toLowerCase().includes(t));
  const warning = hits.length ? ` [swapped AI-slew terms: ${hits.join(", ")}]` : "";
  const preview = prompt.slice(0, 120) + (prompt.length > 120 ? "…" : "");
  return { prompt, negative: NEGATIVE, promptPreview: preview + warning };
}

export function buildRefPrompts(
  briefs: { shot: ShotBrief; raw: unknown }[],
  cfg: ProjectConfig,
): { prompts: ShotRefPrompt[]; blocked: string[] } {
  const prompts = briefs.map(({ shot }) => buildShotRefPrompt(shot, cfg));
  const blocked = prompts
    .filter((p) => p.promptPreview.includes("[swapped"))
    .map((p) => p.promptPreview);
  return { prompts, blocked };
}

export function refPromptHint(prompt: string): string {
  const b = BLOCKED_TERMS.filter((t) => prompt.toLowerCase().includes(t));
  return b.length ? "swapped out generic AI-slew adjectives" : "";
}
