import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Renvoie la version réellement déployée (jamais mise en cache). */
export async function GET() {
  return new NextResponse(JSON.stringify({ version: APP_VERSION }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}
