"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { RenderState } from "@pkg/pipeline";

export default function BuildPoller({ slug, initial }: { slug: string; initial: RenderState }) {
  const [state, setState] = useState<RenderState>(initial);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const res = await fetch(`/api/status/${slug}`, { cache: "no-store" });
        if (res.ok && active) {
          const next = (await res.json()) as RenderState;
          setState(next);
          if (next.status === "running") timer = setTimeout(poll, 1500);
        }
      } catch {
        if (active) timer = setTimeout(poll, 3000);
      }
    }
    if (state.status === "running") timer = setTimeout(poll, 1500);
    return () => { active = false; clearTimeout(timer); };
  }, [slug, state.status]);

  const label = state.status === "running" ? "Rendering…" :
    state.status === "done" ? "Render complete" :
    state.status === "failed" ? "Render failed" : "Not started";

  return (
    <div>
      <div className="flex-between">
        <span className={`status status-${state.status}`}>{label}</span>
        {state.status === "done" && (
          <Link href={`/video/${slug}`} className="accent small">Watch →</Link>
        )}
      </div>
      {state.startedAt && (
        <p className="small muted">Started {new Date(state.startedAt).toLocaleString()}</p>
      )}
      {state.status === "failed" && state.logTail && (
        <p className="small error mono">{state.logTail.slice(-500)}</p>
      )}
      <pre className="log mono small">{state.logTail || "No output yet."}</pre>
    </div>
  );
}
