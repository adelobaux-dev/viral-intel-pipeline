import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { generateAppRecommendations } from "@/lib/anthropic";
import type { AiFeedback } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const REFRESH_MS = 48 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();
  if (profile?.role !== "admin") {
    return NextResponse.json(
      { error: "Réservé aux administrateurs" },
      { status: 403 },
    );
  }

  const force = new URL(request.url).searchParams.get("force") === "1";
  const admin = createAdminClient();

  const { data: last } = await admin
    .from("app_recommendations")
    .select("content, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ content: string; created_at: string }>();

  const fresh =
    last && Date.now() - new Date(last.created_at).getTime() < REFRESH_MS;

  if (last && fresh && !force) {
    return NextResponse.json({
      content: last.content,
      created_at: last.created_at,
      generated: false,
    });
  }

  // Agrège les données récentes de conversations pour nourrir l'analyse.
  const { data: calls } = await admin
    .from("calls")
    .select("patient_name, score, ai_feedback, created_at")
    .is("deleted_at", null)
    .not("ai_feedback", "is", null)
    .order("created_at", { ascending: false })
    .limit(40);

  if (!calls || calls.length === 0) {
    return NextResponse.json({
      content:
        last?.content ??
        "Pas encore assez de conversations analysées pour générer des recommandations. Reviens après quelques appels.",
      created_at: last?.created_at ?? new Date().toISOString(),
      generated: false,
    });
  }

  const summary = calls
    .map((c) => {
      const fb = c.ai_feedback as AiFeedback | null;
      return [
        `- Score ${c.score ?? "?"}/10`,
        fb?.improvements?.length
          ? `Axes: ${fb.improvements.join("; ")}`
          : "",
        fb?.strengths?.length ? `Forces: ${fb.strengths.join("; ")}` : "",
      ]
        .filter(Boolean)
        .join(" | ");
    })
    .join("\n")
    .slice(0, 9000);

  try {
    const content = await generateAppRecommendations(summary);
    await admin.from("app_recommendations").insert({ content });
    return NextResponse.json({
      content,
      created_at: new Date().toISOString(),
      generated: true,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Échec de génération des recommandations",
        content: last?.content ?? null,
        created_at: last?.created_at ?? null,
      },
      { status: 502 },
    );
  }
}
