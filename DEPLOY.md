# Shortcraft — deployment

Status: **live on the ClubeMKT VPS** at <https://shortcraft.clubemkt.digital> (nginx basic auth).

## Architecture

```
Internet → Cloudflare (TLS, wildcard *.clubemkt.digital)
         → VPS 62.171.137.90 : nginx (exact server_name shortcraft.clubemkt.digital)
         → 127.0.0.1:4320 (Next.js 16 `next start`, systemd unit `shortcraft`)
         → /var/lib/shortcraft/projects/<slug>/  (JSON, refs, renders)
         → render subprocess: kit/render.mjs (Playwright Chromium + ffmpeg)
```

The studio is a **stateful Node app**:

- `packages/pipeline` reads/writes `projects/<slug>/…` with `node:fs`.
- `startRender()` spawns `shortcraft_plugin_unpacked/skills/make-2d-video/kit/render.mjs`,
  which launches Chromium and ffmpeg.

This is why it does **not** run on Cloudflare Workers/Pages. A Cloudflare version would
need R2/D1 storage plus a container/external renderer.

## Host prerequisites

Already installed on the VPS:

- Node ≥ 20 (currently 26.x), Bun 1.4.x
- ffmpeg + ffprobe
- Playwright Chromium **1194** (required by the kit's `playwright@1.56.0`):
  ```bash
  cd shortcraft_plugin_unpacked/skills/make-2d-video/kit
  ./node_modules/.bin/playwright install chromium
  ```
- Evo image engine container on `http://127.0.0.1:9740`
- nginx + systemd

## Build & release

```bash
cd /root/ClubeMkt/shortcraft
bun install
bun run build                    # next build apps/web → apps/web/.next
systemctl restart shortcraft
```

`bun run dev` serves the studio on `:3111`; `bun run dev:demo` still serves the legacy
Dr. Herlon demo from the root `app/` directory.

## Services & config

`/etc/systemd/system/shortcraft.service`

```ini
[Unit]
Description=Shortcraft Studio (Next.js)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/ClubeMkt/shortcraft
EnvironmentFile=/etc/shortcraft.env
Environment=NODE_ENV=production
Environment=HOME=/root
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=/root/ClubeMkt/shortcraft/node_modules/.bin/next start apps/web -p 4320 -H 127.0.0.1
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

`/etc/shortcraft.env` (mode 600)

```dotenv
SHORTCRAFT_ROOT=/root/ClubeMkt/shortcraft
SHORTCRAFT_PROJECTS_DIR=/var/lib/shortcraft/projects
SHORTCRAFT_EVO_HOST=http://127.0.0.1:9740
SHORTCRAFT_EVO_API_KEY=…
```

`/etc/nginx/sites-available/shortcraft` — exact `server_name` beats the
`*.clubemkt.digital` Krikkit wildcard; TLS terminates at Cloudflare (origin is HTTP :80,
same as the other subdomains).

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name shortcraft.clubemkt.digital;

    client_max_body_size 64M;

    auth_basic "Shortcraft";
    auth_basic_user_file /etc/nginx/.htpasswd-shortcraft;

    location / {
        proxy_pass http://127.0.0.1:4320;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Host $host;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        proxy_buffering off;
    }
}
```

Credentials live in `/root/shortcraft-credentials.txt`. To switch to Cloudflare Access,
delete the two `auth_basic*` lines and enable an Access application for the hostname.

## Operations

```bash
systemctl status shortcraft
journalctl -u shortcraft -f
nginx -t && systemctl reload nginx
```

- Project data: `/var/lib/shortcraft/projects` (back this up).
- Render logs: `/var/lib/shortcraft/projects/<slug>/build/render.log`.
- Status API: `GET /api/status/<slug>`.
- Do not run `wrangler deploy` from this repo; the Worker config was removed because the
  app is not Workers-compatible.

## Smoke test

```bash
curl -u shortcraft:<password> -s https://shortcraft.clubemkt.digital/ | grep '<title>'
# <title>Shortcraft Studio</title>
```

Then in the UI: `/script/new` → `/story/<slug>` → `/refs/<slug>` (needs Evo) →
`/storyboard/<slug>` → `/build/<slug>` (renders MP4) → `/api/video?slug=<slug>`.
