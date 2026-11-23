# Shortcraft — architecture & build plan (v1)

Repo: `/root/ClubeMkt/shortcraft` — Next.js 16 + TypeScript app. Demo site sits at
`app/`, GrowKaz Stickman plugin payload at `shortcraft_plugin_unpacked/`.

## Contract

Two pieces of code. The web app is the **orchestrator + designer surface**;
the kit is the **renderer**. The app never draws frames — it hands the kit
`config.json` + `story/shots.json` + `ref/` images and calls `node render.mjs`.

```
scripts -> story bible/shots -> ref prompts -> ref images -> storyboard
                                                             |
                                                             v
scripts -> shots.json/scene code -> kit render.mjs (Chromium) -> audio/mix.py -> out/<title>.mp4
```

## Directory shape

```
shortcraft/
  packages/
    pipeline/
      index.ts        # project lifecycle (create/get/list/save/read/write Json)
      prompts.ts      # ref prompt engineering
      engine-evolution.ts   # local Evo API client (cookie + CSRF)
  apps/web/
    app/
      (studio)/
        script/new             # paste script -> timeline words.json
        story/[slug]           # editable shot list (reuse beats.py)
        refs/[slug]            # ref grid + generate
        storyboard/[slug]      # frame-by-frame from refs
        build/[slug]           # generate scene stubs + run render + serve mp4
    lib/pipeline.ts            # re-export packages/pipeline
```

## Data model

```ts
// projects/<slug>/config.json  (existing kit reads this)
{
  title, aspect:"9:16"|"16:9", resolution:"720p"|"1080p"|"1440p"|"2160p",
  fps:24, style:"emerald", voiceover, script, duration, captions, bars,
  fadeIn, fadeOut, music:{enabled,gainDb}, sfx:{enabled,gainDb}, loudness
}

// projects/<slug>/story/shots.json  (existing)
{ title, duration, shots:[{id,start,end,line,scene,set,bars,in,sfx,amb,notes,ref?}], music[], sfx[] }

// projects/<slug>/story/refs.json  (NEW)
{
  slug, generatedAt,
  shots: [{ shotId, stage:"draft"|"approved", aspect, prompt, negative, seed,
            engine:"evolution", status:"pending"|"processing"|"done"|"failed",
            image?, error?, promptPreview? }]
}

// projects/<slug>/story/boards.json  (NEW)  storyboards
{ slug, frames:[{shotId, order, image, caption, time, label}] }
```

## Stages

### A — Script intake (`script/new`)
- Paste script; app parses + runs kit's `parse_script.py`/`transcribe.py`, writes
  `input/script.txt` + `timeline/words.json`.
- Live word-level timeline UI. Single source of truth: narration = visuals.

### B — Beat → shot plan (`story/[slug]`)
- Reuse `tools/beats.py` for a contiguous beat skeleton (2–3.5s median).
- Editable shot list: reorder, split/merge, set name, `scene` (concrete picture),
  `line`, transitions, sfx/amb. This is the handoff to the engine.

### C — Reference-image generation (`refs/[slug]`)
- For each shot: `buildReferencePrompt()` from shot.brief + style → Evo prompt.
- Runs `EvoEngine.generate()` (POST /images/generations with CSRF cookie).
- Writes `ref/<shot>_<i>.png` + `refs.json` manifest.
- Grid preview for approval.

### D — Storyboard (`storyboard/[slug]`)
- Auto-sync frames from `refs.json` (one frame per shot, or multi-frame sequences).
- User swaps/ref-shoots; caption field. Artifact for animation reviewers.

### E — Scene-code generation (`build/[slug]`)
- Read `shots.json` + `refs.json` + style; write `scenes/shots/NN_<name>.js`
  stubs per kit's `engine-api.md` (`registerShot(id, { draw(g,t,info) })`).
- User edits code directly; then kit runs.

### F — Render + deliver
- App runs `node render.mjs --project projects/<slug>` backgrounded (poll log,
  show ETA/progress). Then `python audio/mix.py --project <slug>` muxes.
- Serve `out/<title>.mp4` for download.

## Local Evo engine

- Evolution API container `atendai/evolution-api` → `http://localhost:9740` → `:8080`.
- Image gen: POST `/images/generations` with CSRF cookie (GET `/images/generations`
  first) + `X-Api-Key: caixapretastack2626`. Returns a presigned image URL.
- No GPU, so Fooocus is not viable here. Evo is the local engine.

## MVP order

1. `packages/pipeline/index.ts` — project lifecycle.
2. `packages/pipeline/prompts.ts` — ref prompt builder.
3. `packages/pipeline/engine-evolution.ts` — Evo client + CSRF.
4. `apps/web/app/(studio)/script/new` + `lib/pipeline.ts` — script intake + parse.
5. `apps/web/app/(studio)/story/[slug]` — shot planning (use beats.py output).
6. `apps/web/app/(studio)/refs/[slug]` — ref grid + generate.
7. `apps/web/app/(studio)/storyboard/[slug]` — storyboard from refs.
8. `apps/web/app/(studio)/build/[slug]` — scene stubs + render + serve mp4.

## Deferred (v2)

- Multi-model engine pluggable (SDXL, Replicate, etc.).
- Auth + tenant isolation for the SaaS step.
- `qoderhistory.md` and `PIMPOLOGY/` evaluation (optional cleanup).
