// apps/web/app/api/video/route.ts — stream a rendered MP4 from projects/<slug>.
// ?slug=...[&silent=1] — validates the slug and serves out/<title>.mp4 or the silent build.
import { NextResponse } from "next/server";
import fs from "node:fs";
import { videoFilePath } from "@pkg/pipeline";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") || "";
  const silent = url.searchParams.get("silent") === "1";
  const file = videoFilePath(slug, silent);
  if (!file || !/\.mp4$/i.test(file)) return new NextResponse("Not found", { status: 404 });
  const stat = fs.statSync(file);
  const range = req.headers.get("range");
  if (range) {
    const m = /bytes=(\d+)-(\d*)/.exec(range);
    if (m) {
      const start = Number(m[1]);
      const end = m[2] ? Math.min(Number(m[2]), stat.size - 1) : stat.size - 1;
      const chunk = fs.readFileSync(file).subarray(start, end + 1);
      return new NextResponse(new Uint8Array(chunk), {
        status: 206,
        headers: {
          "content-type": "video/mp4",
          "content-range": `bytes ${start}-${end}/${stat.size}`,
          "accept-ranges": "bytes",
          "content-length": String(chunk.length),
        },
      });
    }
  }
  const bytes = fs.readFileSync(file);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": "video/mp4",
      "content-length": String(bytes.length),
      "accept-ranges": "bytes",
    },
  });
}
