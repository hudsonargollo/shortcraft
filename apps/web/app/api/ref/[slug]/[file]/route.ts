// apps/web/app/api/ref/[slug]/[file]/route.ts — serve a generated reference PNG
// from projects/<slug>/ref/<file>. Path components are validated to prevent traversal.
import { NextResponse } from "next/server";
import fs from "node:fs";
import { refImagePath } from "@pkg/pipeline";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; file: string }> },
) {
  const { slug, file } = await params;
  const p = refImagePath(slug, file);
  if (!p || !fs.existsSync(p)) return new NextResponse("Not found", { status: 404 });
  const bytes = fs.readFileSync(p);
  return new NextResponse(new Uint8Array(bytes), {
    headers: { "content-type": "image/png", "cache-control": "no-store" },
  });
}
