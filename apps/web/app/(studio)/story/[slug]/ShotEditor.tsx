"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Shot } from "@pkg/pipeline";
import { saveShotsAction } from "@/lib/actions";

export default function ShotEditor({ slug, shots }: { slug: string; shots: Shot[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Shot[]>(shots);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  function patch(i: number, key: keyof Shot, value: unknown) {
    setRows((prev) => prev.map((s, idx) => (idx === i ? { ...s, [key]: value } : s)));
  }

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      await saveShotsAction(slug, JSON.stringify(rows));
      setMsg("Saved");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack">
      <div className="list-head mono">
        <span>ID / time</span><span>Scene — what we see</span><span>Line — what is said</span>
      </div>
      {rows.map((s, i) => (
        <div className="card shot-row" key={s.id}>
          <div className="shot-meta">
            <span className="mono accent">{s.id}</span>
            <input
              className="input time-input"
              value={`${s.start.toFixed(1)}–${s.end.toFixed(1)}s`}
              readOnly
              aria-label={`${s.id} timing`}
            />
          </div>
          <input
            className="input"
            value={s.scene}
            onChange={(e) => patch(i, "scene", e.target.value)}
            placeholder="Describe what the camera sees"
          />
          <textarea
            className="input textarea compact"
            rows={2}
            value={s.line}
            onChange={(e) => patch(i, "line", e.target.value)}
            placeholder="Spoken words (leave blank for a silent beat)"
          />
        </div>
      ))}
      <div className="flex-between sticky-actions">
        <span className="small muted">{msg || `${rows.length} shots ready for reference images`}</span>
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save shot plan"}
        </button>
      </div>
    </div>
  );
}
