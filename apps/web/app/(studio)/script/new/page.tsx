import { StageNav } from "@/app/(studio)/_components/StageNav";
import { createProjectAction } from "@/lib/actions";
import { STYLE_IDS } from "@pkg/pipeline/prompts";

export default function NewScriptPage() {
  return (
    <main className="page">
      <StageNav />
      <section className="section narrow">
        <p className="eyebrow">Step 01 — the words</p>
        <h1>Start with what you want to say.</h1>
        <p className="lede">
          Paste your script below. Shortcraft splits it into sentences and builds
          a shot plan you can edit before any image is generated.
        </p>
        <form action={createProjectAction} className="card form-stack">
          <label>
            <span className="label">Project title</span>
            <input name="title" required placeholder="e.g. Why reaction time matters" className="input" />
          </label>
          <label>
            <span className="label">Script / voiceover text</span>
            <textarea
              name="script"
              required
              rows={12}
              placeholder={"Paste one sentence per line, or a paragraph. Each sentence becomes a shot."}
              className="input textarea"
            />
          </label>
          <div className="form-row">
            <label>
              <span className="label">Aspect</span>
              <select name="aspect" className="input" defaultValue="16:9">
                <option value="16:9">16:9 — landscape</option>
                <option value="9:16">9:16 — vertical short</option>
              </select>
            </label>
            <label>
              <span className="label">Visual style</span>
              <select name="style" className="input" defaultValue="emerald">
                {STYLE_IDS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <button type="submit" className="btn-primary">Create project & plan shots →</button>
        </form>
      </section>
    </main>
  );
}
