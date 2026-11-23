// packages/pipeline/index.ts — project lifecycle for the Shortcraft studio.
// One project = one short video: config + script + story + refs + scenes + build/out.
// The web app owns the UI; this package owns read/write of the JSON files the kit's
// render.mjs already reads, so the two halves stay in sync.
//
// All I/O is ESM-safe (top-level `import`, no `require`) and every persisted JSON
// document keeps the same shape on read and on write.

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

// Engine clients — imported first so every engine module registers its client
// into the pipeline namespace. The studio's refs generation picks the local
// offline engine by default and falls back to Evo over HTTPS for remote use.
import "./engine-evolution";
import "./engine-sd";
import "./engine-local";

const CONFIG_FILE = "config.json";
const SHOTS_FILE = "story/shots.json";
const REFS_FILE = "story/refs.json";
const BOARDS_FILE = "story/boards.json";
const STATUS_FILE = "build/render-status.json";
const LOG_FILE = "build/render.log";

/** Locate the repo root whether Next was launched from the repo root or apps/web. */
export function repoRoot(): string {
  if (process.env.SHORTCRAFT_ROOT) return path.resolve(process.env.SHORTCRAFT_ROOT);
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (
      fs.existsSync(path.join(dir, "packages", "pipeline", "index.ts")) &&
      fs.existsSync(path.join(dir, "shortcraft_plugin_unpacked"))
    ) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

/** Root that holds projects/<slug>/. Overridable for tests / alternative hosts. */
export function projectsRoot(): string {
  return process.env.SHORTCRAFT_PROJECTS_DIR || path.join(repoRoot(), "projects");
}

/** Root of the render kit (render.mjs, engine/, audio/, tools/). */
export function kitRoot(): string {
  return process.env.SHORTCRAFT_KIT_DIR ||
    path.join(repoRoot(), "shortcraft_plugin_unpacked", "skills", "make-2d-video", "kit");
}

export function projectDir(slug: string): string {
  return path.join(projectsRoot(), slug);
}
export function configPath(slug: string): string {
  return path.join(projectDir(slug), CONFIG_FILE);
}
export function shotsPath(slug: string): string {
  return path.join(projectDir(slug), SHOTS_FILE);
}
export function refsPath(slug: string): string {
  return path.join(projectDir(slug), REFS_FILE);
}
export function boardsPath(slug: string): string {
  return path.join(projectDir(slug), BOARDS_FILE);
}
export function refDir(slug: string): string {
  return path.join(projectDir(slug), "ref");
}
export function scenesDir(slug: string): string {
  return path.join(projectDir(slug), "scenes", "shots");
}
export function outDir(slug: string): string {
  return path.join(projectDir(slug), "out");
}
export function statusPath(slug: string): string {
  return path.join(projectDir(slug), STATUS_FILE);
}
export function logPath(slug: string): string {
  return path.join(projectDir(slug), LOG_FILE);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SDRef {
  id: string;
  shotId: string;
  stage: "draft" | "approved";
  aspect: "9:16" | "16:9";
  prompt: string;
  negative: string;
  seed: number;
  engine: "evolution" | "sd";
  status: "pending" | "processing" | "done" | "failed";
  image?: string;
  error?: string;
  promptPreview?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SDBoardFrame {
  shotId: string;
  image: string;
  caption: string;
  time: number;
  label: string;
}

export interface SDConfig {
  title: string;
  aspect: "9:16" | "16:9";
  resolution: "720p" | "1080p" | "1440p" | "2160p";
  fps: number;
  style: string;
  voiceover?: string | null;
  script?: string | null;
  duration?: number;
  captions?: boolean;
  bars?: string | number | null;
  fadeIn?: number;
  fadeOut?: number;
  music?: { enabled: boolean; gainDb: number; file?: string; seed?: number; key?: string };
  sfx?: { enabled: boolean; gainDb: number };
  loudness?: number;
  engine?: "evolution" | "sd";
  sdApi?: string;
  sdSecret?: string;
  sdModel?: string;
}

export interface Shot {
  id: string;
  start: number;
  end: number;
  line: string;
  scene: string;
  set: string | null;
  bars: string | null;
  in: { type: string; dur?: number };
  sfx: unknown[];
  amb: unknown | null;
  notes: string;
}

export interface SDProject {
  slug: string;
  config: SDConfig;
  shots: Shot[];
  refs: SDRef[];
  boards: SDBoardFrame[];
  music: any[];
  duration: number;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------

export function readJson<T>(p: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as T;
  } catch {
    return null;
  }
}

export function writeJson(p: string, obj: unknown): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

export function now(): number {
  return Math.floor(Date.now() / 1000);
}

// ---------------------------------------------------------------------------
// Slug guard — one project per video, unique directory name with counter suffix.
// ---------------------------------------------------------------------------

export function slugify(title: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "video";
}

export function uniqueSlug(title: string): string {
  const base = slugify(title);
  if (!fs.existsSync(projectDir(base))) return base;
  let n = 2;
  while (fs.existsSync(projectDir(`${base}-${n}`))) n += 1;
  return `${base}-${n}`;
}

// ---------------------------------------------------------------------------
// Script -> timeline -> shot skeleton (TS mirror of the kit's beats.py). Works
// without a voiceover or Python; uploading a real voiceover + running the kit
// tools later gives exact word timings.
// ---------------------------------------------------------------------------

export interface TimelineWord {
  word: string;
  start: number;
  end: number;
}

export interface Beat {
  i: number;
  start: number;
  end: number;
  speechStart: number;
  speechEnd: number;
  text: string;
}

export function scriptToTimeline(script: string, wordsPerSecond = 2.6): {
  words: TimelineWord[];
  beats: Beat[];
  sentences: { i: number; start: number; end: number; text: string }[];
} {
  const sentences: { text: string }[] = [];
  const chunks = script
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const chunk of chunks) {
    // Very long sentences are split on commas so beats stay short and punchy.
    if (chunk.length > 160 && chunk.includes(",")) {
      const parts = chunk.split(/,\s*/);
      parts.forEach((p, i) => sentences.push({ text: (i === parts.length - 1 ? p : p + ",").trim() }));
    } else {
      sentences.push({ text: chunk });
    }
  }
  const words: TimelineWord[] = [];
  const sentencesOut: { i: number; start: number; end: number; text: string }[] = [];
  let cursor = 0;
  for (const s of sentences) {
    const toks = s.text.split(/\s+/).filter(Boolean);
    if (!toks.length) continue;
    const start = cursor;
    const weights = toks.map((w) => Math.max(2, w.length) + 2);
    const totalW = weights.reduce((a, b) => a + b, 0);
    const duration = Math.max(1.2, toks.length / wordsPerSecond);
    for (let k = 0; k < toks.length; k++) {
      const span = duration * (weights[k] / totalW);
      words.push({ word: toks[k], start: round3(cursor), end: round3(cursor + span * 0.94) });
      cursor += span;
    }
    sentencesOut.push({ i: sentencesOut.length, start: round3(start), end: round3(cursor), text: s.text });
    cursor += 0.12; // small pause between sentences
  }
  // Beats are contiguous (no gaps), mirroring beats.py: beat[i].end == beat[i+1].start.
  const starts = sentencesOut.map((s, i) => (i === 0 ? 0 : round3(s.start)));
  const beats: Beat[] = sentencesOut.map((s, i) => ({
    i,
    start: starts[i],
    end: i === sentencesOut.length - 1 ? round3(s.end + 0.8) : starts[i + 1],
    speechStart: s.start,
    speechEnd: s.end,
    text: s.text,
  }));
  return { words, beats, sentences: sentencesOut };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function shotsFromBeats(beats: Beat[]): Shot[] {
  return beats.map((b, i) => ({
    id: `s${String(i + 1).padStart(3, "0")}`,
    start: b.start,
    end: b.end,
    line: b.text,
    scene: "TODO — describe what we see",
    set: null,
    bars: null,
    in: { type: "cut" },
    sfx: [],
    amb: null,
    notes: "",
  }));
}

// ---------------------------------------------------------------------------
// Project CRUD
// ---------------------------------------------------------------------------

export function newRef(shotId: string, aspect: "9:16" | "16:9"): SDRef {
  const stamp = now();
  return {
    id: `${shotId}-${stamp}`,
    shotId,
    stage: "draft",
    aspect,
    prompt: "",
    negative: "",
    seed: Math.floor(Math.random() * 0xffffffff),
    engine: "evolution",
    status: "pending",
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export function createProject(
  title: string,
  opts: Partial<SDConfig> & { script?: string } = {},
): SDProject {
  const { script: scriptOpt, ...configOpts } = opts;
  const slug = uniqueSlug(title);
  const root = projectDir(slug);
  for (const d of ["input", "timeline", "story", "ref", "scenes/sets", "scenes/shots", "build", "out", "audio"]) {
    fs.mkdirSync(path.join(root, d), { recursive: true });
  }
  const script = (scriptOpt || "").trim();
  const timeline = script ? scriptToTimeline(script) : { words: [], beats: [], sentences: [] };
  const shots = shotsFromBeats(timeline.beats);
  const duration = shots.length ? shots[shots.length - 1].end : 12;

  const config: SDConfig = {
    title,
    aspect: "16:9",
    resolution: "1080p",
    fps: 24,
    style: "emerald",
    voiceover: null,
    script: script ? "input/script.txt" : null,
    duration: round3(duration),
    captions: true,
    bars: null,
    fadeIn: 0.5,
    fadeOut: 0.8,
    music: { enabled: true, gainDb: -17 },
    sfx: { enabled: true, gainDb: -6 },
    loudness: -14,
    engine: "evolution",
    sdApi: process.env.SHORTCRAFT_EVO_HOST || "http://localhost:9740",
    sdModel: "sd-xl",
    ...configOpts,
  };

  if (script) {
    fs.writeFileSync(path.join(root, "input", "script.txt"), script + "\n", "utf8");
    writeJson(path.join(root, "timeline", "words.json"), { source: "script", words: timeline.words });
    writeJson(path.join(root, "timeline", "sentences.json"), timeline.sentences);
    writeJson(path.join(root, "timeline", "beats.json"), timeline.beats);
  }
  writeJson(configPath(slug), config);
  writeJson(shotsPath(slug), { title, duration: round3(duration), shots, music: [] });
  writeJson(refsPath(slug), { slug, generatedAt: Date.now(), shots: [] });
  writeJson(boardsPath(slug), { slug, frames: [] });

  return {
    slug,
    config,
    shots,
    refs: [],
    boards: [],
    music: [],
    duration: round3(duration),
    createdAt: now(),
    updatedAt: now(),
  };
}

function documentDuration(slug: string, config: SDConfig): number {
  const story = readJson<{ duration?: number }>(shotsPath(slug));
  return typeof story?.duration === "number" ? story.duration : config.duration || 0;
}

export function getProject(slug: string): SDProject | null {
  if (!slug || slug.includes("/") || slug.includes("..")) return null;
  const config = readJson<SDConfig>(configPath(slug));
  const story = readJson<{ shots?: Shot[]; music?: any[] }>(shotsPath(slug));
  if (!config || !story) return null;
  const refs = readJson<{ shots?: SDRef[] }>(refsPath(slug));
  const boards = readJson<{ frames?: SDBoardFrame[] }>(boardsPath(slug));
  return {
    slug,
    config,
    shots: Array.isArray(story.shots) ? story.shots : [],
    refs: Array.isArray(refs?.shots) ? refs!.shots! : [],
    boards: Array.isArray(boards?.frames) ? boards!.frames! : [],
    music: Array.isArray(story.music) ? story.music : [],
    duration: documentDuration(slug, config),
    createdAt: now(),
    updatedAt: now(),
  };
}

export function listProjects(): SDProject[] {
  const root = projectsRoot();
  if (!fs.existsSync(root)) return [];
  const out: SDProject[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const p = getProject(entry.name);
    if (p) out.push(p);
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

export function saveProject(p: SDProject): void {
  p.updatedAt = now();
  const duration = p.shots.length ? p.shots[p.shots.length - 1].end : p.duration || 0;
  p.duration = round3(duration);
  writeJson(configPath(p.slug), p.config);
  writeJson(shotsPath(p.slug), { title: p.config.title, duration: p.duration, shots: p.shots, music: p.music || [] });
  writeJson(refsPath(p.slug), { slug: p.slug, generatedAt: Date.now(), shots: p.refs });
  writeJson(boardsPath(p.slug), { slug: p.slug, frames: p.boards });
}

export function saveShots(slug: string, shots: Shot[]): void {
  const p = getProject(slug);
  if (!p) return;
  p.shots = shots;
  saveProject(p);
}

export function saveRefs(slug: string, refs: SDRef[]): void {
  const p = getProject(slug);
  if (!p) return;
  p.refs = refs;
  saveProject(p);
}

export function saveBoards(slug: string, frames: SDBoardFrame[]): void {
  const p = getProject(slug);
  if (!p) return;
  p.boards = frames;
  saveProject(p);
}

// ---------------------------------------------------------------------------
// Ref image persistence + safe serving
// ---------------------------------------------------------------------------

export function refImagePath(slug: string, filename: string): string | null {
  if (!/^[\w.-]+\.png$/i.test(filename) || filename.includes("..")) return null;
  if (!slug || slug.includes("/") || slug.includes("..")) return null;
  return path.join(refDir(slug), filename);
}

export function saveRefImage(slug: string, filename: string, bytes: Uint8Array): boolean {
  const dest = refImagePath(slug, filename);
  if (!dest) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(bytes));
  return true;
}

// ---------------------------------------------------------------------------
// Scene stubs — one per shot, matching the kit's registerShot contract.
// ---------------------------------------------------------------------------

function jsString(s: string): string {
  return JSON.stringify(s).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export function sceneStub(shot: Shot, config: SDConfig): string {
  return `// scenes/shots/${shot.id}.js — generated by the Shortcraft studio.
// Ground this scene in the approved reference image (light, palette, character).
import { E, V, registerShot, mood, S, ease, prog, backdrop, text, glow, FONTS } from '/engine/core.js';

registerShot(${jsString(shot.id)}, { draw(g, t, info) {
  const M = mood('dusk');
  backdrop(g, M.sky);
  const a = ease.out(prog(t, 0.2, 0.8));
  text(g, ${jsString(shot.scene || shot.line || shot.id)}, E.W / 2, E.H / 2, {
    size: V(64, 72), color: S().feature, alpha: a,
    glow: 24, glowColor: M.rim, font: FONTS.title,
  });
} });
`;
}

export function generateScenes(slug: string): number {
  const p = getProject(slug);
  if (!p) return 0;
  fs.mkdirSync(scenesDir(slug), { recursive: true });
  let count = 0;
  for (const shot of p.shots) {
    const file = path.join(scenesDir(slug), `${shot.id}.js`);
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, sceneStub(shot, p.config), "utf8");
      count += 1;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Render subprocess — the app calls the kit's render.mjs on the host.
// ---------------------------------------------------------------------------

export interface RenderState {
  status: "idle" | "running" | "done" | "failed";
  pid?: number;
  startedAt?: number;
  finishedAt?: number;
  exitCode?: number | null;
  logTail: string;
  video?: string;
}

const LOG_KEEP = 12000;

function appendLog(slug: string, chunk: string): void {
  const p = logPath(slug);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const prev = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  fs.writeFileSync(p, (prev + chunk).slice(-LOG_KEEP), "utf8");
}

function writeState(slug: string, state: RenderState): void {
  writeJson(statusPath(slug), state);
}

export function renderStatus(slug: string): RenderState {
  const saved = readJson<RenderState>(statusPath(slug));
  const log = fs.existsSync(logPath(slug)) ? fs.readFileSync(logPath(slug), "utf8") : "";
  const base: RenderState = { status: "idle", logTail: log.slice(-4000) };
  if (!saved) return base;
  return { ...base, ...saved, logTail: log.slice(-4000) };
}

export function isRenderRunning(slug: string): boolean {
  return renderStatus(slug).status === "running";
}

/** Start render.mjs as a detached child. Returns immediately; poll renderStatus(). */
export function startRender(slug: string): RenderState {
  const p = getProject(slug);
  if (!p) return { status: "failed", logTail: "Project not found" };
  if (isRenderRunning(slug)) return renderStatus(slug);

  const script = path.join(kitRoot(), "render.mjs");
  if (!fs.existsSync(script)) {
    return { status: "failed", logTail: `render.mjs not found at ${script}` };
  }
  const logFile = logPath(slug);
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  fs.writeFileSync(logFile, "", "utf8");

  const startedAt = Date.now();
  writeState(slug, { status: "running", startedAt, logTail: "", exitCode: null });

  const child = spawn(process.execPath, [script, "--project", projectDir(slug)], {
    cwd: kitRoot(),
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
  child.stdout?.on("data", (d: Buffer) => appendLog(slug, d.toString("utf8")));
  child.stderr?.on("data", (d: Buffer) => appendLog(slug, d.toString("utf8")));
  child.on("error", (e: Error) => {
    appendLog(slug, `\nspawn error: ${e.message}\n`);
    writeState(slug, { status: "failed", startedAt, finishedAt: Date.now(), logTail: "", exitCode: null });
  });
  child.on("close", (code: number | null) => {
    const state = renderStatus(slug);
    appendLog(slug, `\n[render exited ${code}]\n`);
    const finalPath = path.join(outDir(slug), `${slugify(p.config.title)}.mp4`);
    const silentPath = path.join(projectDir(slug), "build", "video_silent.mp4");
    let video: string | undefined;
    if (code === 0 && fs.existsSync(finalPath)) video = `/api/video?slug=${encodeURIComponent(slug)}`;
    else if (code === 0 && fs.existsSync(silentPath)) video = `/api/video?slug=${encodeURIComponent(slug)}&silent=1`;
    writeState(slug, {
      status: code === 0 ? "done" : "failed",
      pid: child.pid,
      startedAt: state.startedAt || startedAt,
      finishedAt: Date.now(),
      exitCode: code,
      logTail: "",
      video,
    });
  });
  child.unref();
  return { status: "running", pid: child.pid, startedAt, logTail: "", exitCode: null };
}

export function videoFilePath(slug: string, silent = false): string | null {
  const p = getProject(slug);
  if (!p) return null;
  const dir = outDir(slug);
  const buildDir = path.join(projectDir(slug), "build");
  const candidates = silent
    ? [path.join(buildDir, "video_silent.mp4"), path.join(buildDir, "preview.mp4")]
    : [path.join(dir, `${slugify(p.config.title)}.mp4`), path.join(dir, "video.mp4"), path.join(buildDir, "video_silent.mp4"), path.join(buildDir, "preview.mp4")];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  // Final fallback: any mp4 in build/ (e.g. a custom --out render).
  if (fs.existsSync(buildDir)) {
    const mp4 = fs.readdirSync(buildDir).find((f) => f.endsWith(".mp4"));
    if (mp4) return path.join(buildDir, mp4);
  }
  return null;
}

// Engine clients — re-exported for the studio's server actions.
export { generateLocal, localHost, localApiKey } from "./engine-local";
export { generate } from "./engine-evolution";
