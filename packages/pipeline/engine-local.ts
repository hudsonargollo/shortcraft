// packages/pipeline/engine-local.ts — local offline SD image engine client.
//
// Generates reference images from a local ComfyUI / SwarmUI node instead of a
// remote commercial engine. This is the offline/private path the user asked for.
//
// How the local node is exposed:
//   - SwarmUI / ComfyUI expose a local HTTP API. The engine-agnostic endpoint
//     is the Automatic1111-style /sdapi/v1/txt2img route:
//       POST /sdapi/v1/txt2img
//       { prompt, negative_prompt, steps, cfg_scale, width, height }
//       -> { images: ["data:image/png;base64,<bytes>", …] }
//   - ComfyUI also serves /sdapi/v1/txt2img, so one client covers both.
//
// The web app (server action) calls this from a server with network access to
// the host. The refs page already passes host + apiKey, and "local" means host
// is set to the machine's SwarmUI/ComfyUI node and apiKey is empty.
//
// A pure offline fallback (in-process torch/diffusers, no network) is a
// separate consideration: it requires torch, which is not installed in the
// studio host. The studio below therefore targets a reachable local node over
// HTTP, which is what SwarmUI actually exposes.

export interface LocalConfig {
  host: string;
}

export function localHost(): string {
  return (process.env.SHORTCRAFT_LOCAL_HOST || "http://localhost:8188").replace(/\/$/, "");
}

export function localApiKey(): string {
  return process.env.SHORTCRAFT_LOCAL_API_KEY || "";
}

const SDAPI = "/sdapi/v1/txt2img";
const SDAPI_TIMEOUT = 120_000;
const IMAGE_TIMEOUT = 60_000;

export interface LocalGenerationResult {
  ok: boolean;
  bytes?: Uint8Array;
  error?: string;
}

export async function generateLocal(
  prompt: string,
  negative: string,
  opts: {
    host?: string;
    apiKey?: string;
    steps?: number;
    cfgScale?: number;
    width?: number;
    height?: number;
    seed?: number;
    aspect: "9:16" | "16:9";
  },
): Promise<LocalGenerationResult> {
  const host = opts.host || localHost();
  const apiKey = opts.apiKey || localApiKey();
  const url = `${host.replace(/\/$/, "")}${SDAPI}`;
  const size = opts.aspect === "9:16" ? 1080 : 768;

  try {
    const body = {
      prompt,
      negative_prompt: negative,
      steps: opts.steps ?? 8,
      cfg_scale: opts.cfgScale ?? 1,
      width: opts.width ?? size,
      height: opts.height ?? size,
      seed: opts.seed ?? Math.floor(Math.random() * 0xffffffff),
      override_settings: {},
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SDAPI_TIMEOUT),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        error: `local engine ${url} returned HTTP ${res.status}${text ? " " + text.slice(0, 120) : ""}`,
      };
    }

    const j = await res.json().catch(() => null);
    const rawImages = Array.isArray(j?.images) ? j.images : [];

    if (!rawImages.length) {
      return { ok: false, error: "local engine returned no images" };
    }

    const dataUris: string[] = [];
    for (const it of rawImages) {
      if (typeof it === "string") {
        dataUris.push(it);
      } else if (typeof it === "object" && it?.url) {
        dataUris.push(String(it.url));
      }
    }

    if (!dataUris.length) {
      return { ok: false, error: "local engine returned no decodable images" };
    }

    // Prefer PNG; fall back to the first token the node returned.
    const uri = dataUris.find((u) => u.startsWith("data:image/png")) || dataUris[0];

    const bytes = await fetch(uri, {
      signal: AbortSignal.timeout(IMAGE_TIMEOUT),
    }).then((r) => {
      if (!r.ok) throw new Error(`image fetch HTTP ${r.status}`);
      return r.arrayBuffer();
    }).then((ab) => new Uint8Array(ab));

    if (!bytes.length) {
      return { ok: false, error: "local engine returned an empty image" };
    }

    return { ok: true, bytes };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const network = /Failed to fetch|network|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN/i.test(msg);
    return {
      ok: false,
      error: network
        ? `local engine unreachable at ${host} — start SwarmUI/ComfyUI on this machine and set SHORTCRAFT_LOCAL_HOST (default: http://localhost:8188)`
        : msg,
    };
  }
}

export function localConfig(overrides: Partial<LocalConfig> = {}): LocalConfig {
  return { host: localHost(), ...overrides };
}

/** Placeholder for parity with the Evo client; no cookies are needed for the SD-API. */
export function localJar(): { host: string } {
  return { host: localHost() };
}
