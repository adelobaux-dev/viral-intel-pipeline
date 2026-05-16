import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scoreCall } from "@/lib/anthropic";
import { sendPatientEmail, uploadTranscriptToDrive } from "@/lib/google";
import { CARES_LABELS } from "@/lib/cares";
import type { AiFeedback } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function formatArchive(
  patientName: string,
  transcript: string,
  feedback: AiFeedback,
): string {
  const breakdown = Object.entries(feedback.cares_breakdown)
    .map(
      ([k, v]) => `  - ${CARES_LABELS[k as keyof typeof CARES_LABELS]}: ${v}/10`,
    )
    .join("\n");

  return `CABINET DR ALEXIS DELOBAUX — Analyse d'appel
Patient : ${patientName || "—"}
Date : ${new Date().toLocaleString("fr-FR")}

SCORE GLOBAL : ${feedback.score}/10

Détail C.A.R.E.S. :
${breakdown}

Points forts :
${feedback.strengths.map((s) => `  • ${s}`).join("\n")}

Axes d'amélioration :
${feedback.improvements.map((s) => `  • ${s}`).join("\n")}

Résumé patient (à copier dans Doctolib) :
  Motif        : ${feedback.patient_summary.motif}
  Taille/Poids : ${feedback.patient_summary.taille_poids}
  Budget       : ${feedback.patient_summary.budget}
  Notes        : ${feedback.patient_summary.notes}

----- TRANSCRIPTION COMPLÈTE -----
${transcript}
`;
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
    callId?: string;
    patientName?: string;
    transcript?: string;
    patientEmail?: string;
  } | null;

  if (!body?.callId || !body.transcript?.trim()) {
    return NextResponse.json(
      { error: "callId et transcript requis" },
      { status: 400 },
    );
  }

  const patientName = body.patientName?.trim() || "";

  // 1. Scoring IA
  let feedback: AiFeedback;
  try {
    feedback = await scoreCall(body.transcript);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Échec scoring IA" },
      { status: 502 },
    );
  }

  // 2. Persistance Supabase
  const { error: updateError } = await supabase
    .from("calls")
    .update({
      patient_name: patientName || null,
      end_time: new Date().toISOString(),
      transcript: body.transcript,
      score: feedback.score,
      ai_feedback: feedback,
    })
    .eq("id", body.callId)
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await supabase.rpc("refresh_performance", { target_user: user.id });

  // 3. Intégrations Google (best-effort, non bloquantes)
  const integrations: Record<string, string> = {};

  try {
    const archive = formatArchive(patientName, body.transcript, feedback);
    const fileName = `closing_${patientName || "patient"}_${Date.now()}.txt`;
    const drive = await uploadTranscriptToDrive({
      fileName,
      content: archive,
    });
    integrations.drive = drive.webViewLink ?? drive.fileId;
  } catch (err) {
    integrations.driveError =
      err instanceof Error ? err.message : "Drive indisponible";
  }

  if (body.patientEmail?.trim()) {
    try {
      const emailBody = `Bonjour,

Suite à notre échange, vous trouverez ci-joint les informations et livrets explicatifs concernant votre projet (${feedback.patient_summary.motif || "intervention"}).

Notre équipe reste à votre disposition pour toute question.

Bien à vous,
Cabinet du Dr Alexis Delobaux`;
      const mail = await sendPatientEmail({
        to: body.patientEmail.trim(),
        subject: "Votre récapitulatif — Cabinet Dr Alexis Delobaux",
        body: emailBody,
      });
      integrations.email = mail.id;
    } catch (err) {
      integrations.emailError =
        err instanceof Error ? err.message : "Gmail indisponible";
    }
  }

  return NextResponse.json({ feedback, integrations });
}
