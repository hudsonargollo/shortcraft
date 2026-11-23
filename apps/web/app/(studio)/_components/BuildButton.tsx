import { useState } from "react";

export function BuildButton({ project }: { project: any }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    const r = await fetch(`/studio/${project.slug}/build`);
    const j = await r.json();
    setBusy(false);
    alert(j.message || "Build triggered");
  };
  return <button disabled={busy} onClick={run} className="px-4 py-2 rounded-xl bg-accent text-bg font-semibold disabled:opacity-50">{busy ? "Rendering…" : "Render video"}</button>;
}
