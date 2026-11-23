// apps/web/app/api/status/[slug]/route.ts — poll render state + log tail.
import { NextResponse } from "next/server";
import { renderStatus } from "@pkg/pipeline";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return NextResponse.json(renderStatus(slug), { headers: { "cache-control": "no-store" } });
}
