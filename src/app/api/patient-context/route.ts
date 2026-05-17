import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { looseNameMatch } from "@/lib/patientMatch";
import type { AiFeedback } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Dossier patient partagé entre les rôles du cabinet.
 * Agrège les informations collectées lors des conversations PRÉCÉDENTES
 * avec ce patient (secrétaire, chirurgien…) pour aider le rôle suivant.
 * Accès : tout membre authentifié (clé service, cross-user volontaire).
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const name = (new URL(request.url).searchParams.get("name") || "").trim();
  if (name.length < 2) {
    return NextResponse.json({ found: false, summary: "", entries: [] });
  }

  const { data } = await createAdminClient()
    .from("calls")
    .select("patient_name, score, ai_feedback, created_at, user_id")
    .not("patient_name", "is", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(400);

  // Correspondance tolérante aux fautes de frappe (nom/prénom).
  const entries = (data ?? [])
    .filter((c) => c.ai_feedback)
    .filter((c) => looseNameMatch(name, (c.patient_name as string) ?? ""))
    .slice(0, 10);
  if (entries.length === 0) {
    return NextResponse.json({ found: false, summary: "", entries: [] });
  }

  const summary = entries
    .map((c) => {
      const fb = c.ai_feedback as AiFeedback;
      const ps = fb.patient_summary;
      return `• ${new Date(c.created_at).toLocaleDateString("fr-FR")} (score ${
        c.score ?? "?"
      }/10) — Motif: ${ps?.motif ?? "?"} | Taille/Poids: ${
        ps?.taille_poids ?? "?"
      } | Budget: ${ps?.budget ?? "?"} | Notes: ${ps?.notes ?? "?"}`;
    })
    .join("\n")
    .slice(0, 4000);

  return NextResponse.json({
    found: true,
    summary,
    entries: entries.map((c) => ({
      date: c.created_at,
      score: c.score,
      patient_summary: (c.ai_feedback as AiFeedback).patient_summary,
    })),
  });
}
