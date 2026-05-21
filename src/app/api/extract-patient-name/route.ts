import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    transcript?: string;
  } | null;
  const t = (body?.transcript ?? "").slice(-4000).trim();
  if (t.length < 60) return NextResponse.json({ name: null });

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 80,
      system: `Extrait UNIQUEMENT le nom (et prénom si disponible) du PATIENT à partir de l'extrait de conversation. Ne renvoie PAS le nom du soignant ni du closer.
Réponds STRICTEMENT en JSON : {"name":"Nom Prénom"} OU {"name":null} si tu n'es pas sûr.`,
      messages: [{ role: "user", content: t }],
    });
    const text =
      res.content[0]?.type === "text" ? res.content[0].text : "{}";
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = m ? (JSON.parse(m[0]) as { name?: string | null }) : {};
    const name = (parsed.name ?? "").trim();
    return NextResponse.json({ name: name || null });
  } catch {
    return NextResponse.json({ name: null });
  }
}
