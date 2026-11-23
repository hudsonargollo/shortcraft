// packages/pipeline/engine-evolution.ts — local Evolution/Evo image engine client.
//
// Two hard rules from references/evo-engine-integration.md:
//   1. CSRF cookie-host rule — the _csrf cookie is bound to the host used for the
//      GET warmup, and the POST is rejected when the host differs. Always use the
//      SAME real host for warmup and generation (set SHORTCRAFT_EVO_HOST on a
//      deployed app). Never mix localhost with a mapped host.
//   2. Endpoint-surface probe — a live Evo 2.2.3 SvelteKit build may not serve the
//      historical SD-API routes. Probe the candidate endpoints and use the first
//      that responds; do not assume a fixed path.
//
// Secrets are env-provided and never logged or persisted.

import type { ShotRefPrompt } from "./prompts";

export interface EvoConfig {
  host: string;
  apiKey?: string;
  endpoint?: string;
}

export function evoUrl(): string {
  return (process.env.SHORTCRAFT_EVO_HOST || "http://localhost:9740").replace(/\/$/, "");
}

export function evoApiKey(): string {
  return process.env.SHORTCRAFT_EVO_API_KEY || "";
}

export function evoConfig(overrides: Partial<EvoConfig> = {}): EvoConfig {
  return { host: evoUrl(), apiKey: evoApiKey(), ...overrides };
}

const CANDIDATE_ENDPOINTS = [
  "/images/generations",
  "/api/images/generations",
  "/sdapi/v1/txt2img",
];

/** Probe the route surface once per host; cache the working endpoint. */
const endpointCache = new Map<string, string>();

export async function detectEndpoint(cfg: EvoConfig): Promise<string> {
  if (cfg.endpoint) return cfg.endpoint;
  const cached = endpointCache.get(cfg.host);
  if (cached) return cached;
  for (const ep of CANDIDATE_ENDPOINTS) {
    try {
      const res = await fetch(`${cfg.host}${ep}`, {
        method: "OPTIONS",
        headers: cfg.apiKey ? { "x-api-key": cfg.apiKey } : {},
        signal: AbortSignal.timeout(4000),
      });
      if (res.status !== 404) {
        endpointCache.set(cfg.host, ep);
        return ep;
      }
    } catch {
      // endpoint unreachable — try the next candidate
    }
  }
  // Default to the historical path; generation will fail cleanly if absent.
  return CANDIDATE_ENDPOINTS[0];
}

function extractCookie(res: Response): string {
  const raw = res.headers.get("set-cookie") || "";
  // Keep every cookie pair (csrf + session) but strip attributes.
  return raw.split(/,(?=\s*[^;,=]+=)/).map((c) => c.split(";")[0].trim()).join("; ");
}

function csrfToken(cookie: string): string {
  for (const pair of cookie.split(";")) {
    const [k, ...v] = pair.trim().split("=");
    if (k.toLowerCase().includes("csrf")) return decodeURIComponent(v.join("="));
  }
  return "";
}

function firstUrl(j: unknown): string {
  if (!j || typeof j !== "object") return "";
  const o = j as Record<string, unknown>;
  if (typeof o.url === "string") return o.url;
  if (Array.isArray(o.data)) {
    for (const d of o.data) {
      if (d && typeof d === "object" && typeof (d as Record<string, unknown>).url === "string") {
        return (d as Record<string, unknown>).url as string;
      }
    }
  }
  if (typeof o.image === "string" && o.image.startsWith("http")) return o.image;
  return "";
}

export interface EvoGeneration {
  ok: boolean;
  bytes?: Uint8Array;
  error?: string;
}

/** Warm the CSRF cookie, probe the endpoint, generate, and download the image. */
export async function generate(
  prompt: ShotRefPrompt,
  opts: { aspect: "9:16" | "16:9"; seed: number; config?: Partial<EvoConfig> },
): Promise<EvoGeneration> {
  const cfg = evoConfig(opts.config);
  try {
    const endpoint = await detectEndpoint(cfg);
    const url = `${cfg.host}${endpoint}`;

    // Step 1 — warmup GET. SAME host as the POST below (cookie-host rule).
    let cookie = "";
    try {
      const warm = await fetch(url, {
        headers: cfg.apiKey ? { "x-api-key": cfg.apiKey } : {},
        signal: AbortSignal.timeout(8000),
      });
      cookie = extractCookie(warm);
    } catch {
      // some engines only implement POST; continue without a cookie
    }

    // Step 2 — generation POST with api key + CSRF header/cookie.
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (cfg.apiKey) headers["x-api-key"] = cfg.apiKey;
    if (cookie) {
      headers["cookie"] = cookie;
      const token = csrfToken(cookie);
      if (token) headers["x-csrf-token"] = token;
    }
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        prompt: prompt.prompt,
        negative_prompt: prompt.negative,
        n: 1,
        size: opts.aspect === "9:16" ? "1080x1920" : "1280x720",
        seed: opts.seed,
      }),
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) return { ok: false, error: `Evo ${endpoint} returned HTTP ${res.status}` };

    const j = await res.json().catch(() => null);
    const imageUrl = firstUrl(j);
    if (!imageUrl) return { ok: false, error: "Evo returned no image URL" };

    // Step 3 — Evo returns a presigned URL, not a local file. Fetch the bytes.
    const img = await fetch(imageUrl, { signal: AbortSignal.timeout(60000) });
    if (!img.ok) return { ok: false, error: `image fetch returned HTTP ${img.status}` };
    const bytes = new Uint8Array(await img.arrayBuffer());
    if (!bytes.length) return { ok: false, error: "empty image" };
    return { ok: true, bytes };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Expose the jar/cookie helper for diagnostics without leaking values. */
export function evoJar(): { host: string; endpoint: string | null } {
  return { host: evoUrl(), endpoint: endpointCache.get(evoUrl()) || null };
}
