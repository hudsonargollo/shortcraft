# shortcraft — state and next steps

Repo: `/root/ClubeMkt/shortcraft` — the GrowKaz Stickman Studio Claude plugin, adapted for
Hermes. Demo Next.js app sits at the root (`app/`, `page.tsx`, `layout.tsx`); the plugin payload
is at `shortcraft_plugin_unpacked/` (`.claude-plugin/plugin.json`, `skills/`, `kit/`).

## Verified

- **Playwright e2e green**: `bun run test:e2e` → `1 passed` for
  `tests/e2e/home-page.spec.ts`.
- **Browsers installed**: Chromium 1248 and 1255, `chromium_headless_shell` under
  `~/.cache/ms-playwright/` (no re-install required).
- **Playwright config**: `playwright.config.ts` — `testDir: ./tests/e2e`, `baseURL: http://localhost:3111`,
  one `chromium` project, dev-vs-CI reporters, `trace: on-first-retry`,
  `screenshot: only-on-failure`.
- **Plugin payload**: `GrowKaz_Stickman.plugin` (zip) + extracted
  `shortcraft_plugin_unpacked/` hold the full skill set
  (`make-2d-video`, `new-video`, `render-video`, `video-sound`, `video-styles`) plus
  `kit/` (engine, audio, examples, tools).
- **Demo app server**: Next.js `next-server (v1)` reachable on port `3111` (HTTP 200);
  title `Dr. Herlon Moura — Angiologist`, hero `<canvas>` renders, `<section id="contato">` present.

## Package scripts (current)

| Script | What it runs |
| --- | --- |
| `dev` | `next dev` (turbopack, **default port 3000**) |
| `build` | `next build` |
| `start` | `next start` |
| `test` / `test:watch` | `vitest run` / `vitest` |
| `test:e2e` / `test:e2e:ui` | `playwright test` / `--ui` |
| `playwright:install` | `playwright install chromium` |

## Next steps

### 1. Align the dev port with the e2e `baseURL`
Playwright asserts against `http://localhost:3111`, but the `dev` script runs `next dev` on the
Next.js default port **3000**. For e2e to work cleanly (and for CI), make the dev server bind to
`3111`. Proposed change — `package.json`:

```json
"dev": "next dev -p 3111",
```

(or start with `PORT=3111`). Alternatively point `playwright.config.ts` `baseURL` at `http://localhost:3000`.
Document which you prefer so all future runs agree.

### 2. Add a CI workflow
A `.github/workflows/e2e.yml` would gate on this. It needs to (a) install, (b) start the dev
server on the aligned port, (c) run `bun run test:e2e`, (d) upload Playwright report artifacts.
It should **not** rely on a pre-started server (CI has none), and should install the
`playwright` browsers as a step (`npx playwright install --with-deps chromium`) or rely on the
devcontainer/CI image already bundling them.

### 3. Expand e2e coverage
The suite is a single spec (`home-page.spec.ts`). As the demo app and plugin grow, add specs for:
- other routes/pages (404, metadata, `<title>` assertion on each),
- the `VascularHero` canvas (renderer ready, frame renders, `resize` works),
- contact form / mailto link behavior,
- plugin-stage pages if the Next.js side exposes any (e.g. a video stage UI).

### 4. Add unit tests for the non-Three.js logic
`tests/e2e` is browser-driven. The hero component's pure helpers (`lerp`, `rand`, `growth`) can be
covered with `vitest` (the `test` script already points at vitest, which currently finds no tests).
A lightweight `tests/unit/growtree.spec.ts` would lock those in.

### 5. Verify the built artifact
Run `bun run build` and confirm `.next/` is produced (server entry `.next/server/next-minimal-server.js.nft.json`
already exists) so the app can be `start`-ed for smoke-testing or deployed. Confirm the test OCR is
unrelated to this repo — `PIMPOLOGY/` (a 60-episode pimp-animation blueprint + reference jpeg) is
stray content and should be removed or moved elsewhere if it isn't a deliberate part of the project.

### 6. Document the plugin pipeline runbooks
If the plugin is being used end-to-end in Hermes, add a short runbook to
`shortcraft_plugin_unpacked/README.md`, or a sibling `RUNBOOK.md`, covering:
- the stage commands (`/new-video`, `/video-styles`, `/render-video`, `/video-sound`),
- the kit's `render.mjs --project ...` flow and expected frame rates/render times,
- how `config.json`, `story/shots.json`, `scenes/shots/*.js` map to one another.

## Commands reference

```bash
cd /root/ClubeMkt/shortcraft

# e2e (dev server must be up — currently on port 3111)
bun run test:e2e              # run once
bun run test:e2e:ui           # headed UI runner
npx playwright test --reporter=line

# install a missing browser
bun run playwright:install

# unit tests (currently none exist for vitest)
bun test                      # if vitest shim is wired; otherwise npx vitest run

# build / start for smoke
bun run build && bun run start

# start a dev server on the e2e port
PORT=3111 bun run dev
```

## Open questions / unknowns

- **Port mismatch**: e2e `baseURL` is `3111` but `dev` defaults to `3000`. Resolve before CI.
- **Other pages**: the app currently only has `page.tsx` + `layout.tsx` + `VascularHero`. Nothing
  else to cover until more routes are added.
- **`shortcraft_plugin_unpacked/`** is a raw unpacked plugin — confirm it is the canonical source
  of truth for the Hermes skill, or whether the zip `GrowKaz_Stickman.plugin` should be the single
  source and the folder a build artifact.
- **`PIMPOLOGY/` dir**: stray content vs. intentional — needs a decision.
- **`bun run test` (vitest)**: currently finds zero tests — intentional (only e2e exists) or a gap?
