import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { generateTeamReport } from "@/lib/anthropic";
import type { AiFeedback } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Cache mémoire (par instance serveur) pour limiter le coût IA.
let cache: { at: number; content: string } | null = null;
const TTL_MS = 6 * 60 * 60 * 1000; // 6 h

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = (user?.email ?? "").toLowerCase();
  if (!email.includes("delobaux")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const force = new URL(request.url).searchParams.get("force") === "1";
  if (cache && !force && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json({
      content: cache.content,
      created_at: new Date(cache.at).toISOString(),
      cached: true,
    });
  }

  const admin = createAdminClient();

  const { data: users } = await admin
    .from("users")
    .select("id, name, role");
  const { data: perfs } = await admin
    .from("performance_tracking")
    .select("user_id, total_calls, average_score, conversion_rate");
  const { data: calls } = await admin
    .from("calls")
    .select("user_id, score, ai_feedback, transcript, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(30);

  let errorsBlock = "";
  try {
    const { data: errs } = await admin
      .from("error_logs")
      .select("user_email, message, path, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    if (errs && errs.length) {
      errorsBlock =
        "\n\nERREURS TECHNIQUES RÉCENTES :\n" +
        errs
          .map((e) => `- ${e.user_email ?? "?"}: ${e.message} (${e.path ?? ""})`)
          .join("\n");
    }
  } catch {
    /* table error_logs absente : on ignore */
  }

  const nameById = new Map((users ?? []).map((u) => [u.id, u.name]));
  const perfBlock = (perfs ?? [])
    .map(
      (p) =>
        `- ${nameById.get(p.user_id) ?? "?"} : ${p.total_calls} conv., score moy ${Number(
          p.average_score,
        ).toFixed(1)}/10, conversion ${Number(p.conversion_rate).toFixed(0)}%`,
    )
    .join("\n");

  const callsBlock = (calls ?? [])
    .map((c) => {
      const fb = c.ai_feedback as AiFeedback | null;
      const who = nameById.get(c.user_id) ?? "?";
      const extract = (c.transcript ?? "").slice(0, 600);
      return `• ${who} | score ${c.score ?? "?"}/10 | axes: ${
        fb?.improvements?.join("; ") ?? "—"
      }\n  extrait: ${extract}`;
    })
    .join("\n")
    .slice(0, 9000);

  const summary = `PERFORMANCES PAR MEMBRE :\n${perfBlock}\n\nCONVERSATIONS RÉCENTES :\n${callsBlock}${errorsBlock}`;

  try {
    const content = await generateTeamReport(summary);
    cache = { at: Date.now(), content };
    return NextResponse.json({
      content,
      created_at: new Date().toISOString(),
      cached: false,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Échec génération du rapport",
        content: cache?.content ?? null,
      },
      { status: 502 },
    );
  }
}
