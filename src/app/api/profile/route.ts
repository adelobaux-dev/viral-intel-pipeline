import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { analyzePersonality } from "@/lib/anthropic";
import { PERSONALITY_QUESTIONS } from "@/lib/personality";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { data } = await supabase
    .from("user_profiles")
    .select("analysis, created_at")
    .eq("user_id", user.id)
    .maybeSingle<{ analysis: string; created_at: string }>();

  return NextResponse.json({
    hasProfile: !!data,
    analysis: data?.analysis ?? null,
    created_at: data?.created_at ?? null,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    answers?: Record<string, string>;
  } | null;
  if (!body?.answers || Object.keys(body.answers).length === 0) {
    return NextResponse.json({ error: "Réponses manquantes" }, { status: 400 });
  }

  const answersText = PERSONALITY_QUESTIONS.map((q) => {
    const a = body.answers?.[q.id]?.trim();
    return a ? `${q.question}\n→ ${a}` : null;
  })
    .filter(Boolean)
    .join("\n\n");

  let analysis: string;
  try {
    analysis = await analyzePersonality(answersText);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Échec de l'analyse" },
      { status: 502 },
    );
  }

  const { error } = await createAdminClient()
    .from("user_profiles")
    .upsert(
      {
        user_id: user.id,
        answers: body.answers,
        analysis,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, analysis });
}
