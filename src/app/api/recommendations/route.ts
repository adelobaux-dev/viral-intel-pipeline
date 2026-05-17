import { createClient } from "@/lib/supabase/server";
import { getLiveRecommendation } from "@/lib/anthropic";
import { getDriveKnowledge } from "@/lib/google";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Server-Sent Events : émet une recommandation C.A.R.E.S. toutes les ~10s
 * à partir des 10 dernières phrases transcrites passées en query (?lines=).
 *
 * Le client reconnecte avec une transcription rafraîchie ; chaque connexion
 * vit le temps d'un cycle de polling SSE.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Non authentifié", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const linesParam = searchParams.get("lines") ?? "";
  const mode = (searchParams.get("mode") ?? undefined) as
    | import("@/lib/types").ConsultationMode
    | undefined;
  const patientName = (searchParams.get("patient") ?? "").trim();
  const recentLines = linesParam
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-10);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      if (recentLines.length === 0) {
        send("idle", { message: "En attente de transcription…" });
        controller.close();
        return;
      }

      try {
        const { data: resources } = await supabase
          .from("closing_resources")
          .select("title, content")
          .order("created_at", { ascending: false })
          .limit(20);
        const manualKnowledge = (resources ?? [])
          .map((r) => `### ${r.title}\n${r.content}`)
          .join("\n\n")
          .slice(0, 6000);

        // Ressources du Google Drive (mises à jour automatiquement, cache 5 min)
        const drive = await getDriveKnowledge();

        // Dossier patient partagé : ce que la secrétaire / le chirurgien
        // ont déjà recueilli sur ce patient lors d'échanges précédents.
        let patientBlock = "";
        if (patientName.length >= 2) {
          try {
            const { createAdminClient } = await import("@/lib/supabase/server");
            const { data: prior } = await createAdminClient()
              .from("calls")
              .select("score, ai_feedback, created_at")
              .ilike("patient_name", patientName)
              .is("deleted_at", null)
              .order("created_at", { ascending: false })
              .limit(8);
            const lines2 = (prior ?? [])
              .filter((c) => c.ai_feedback)
              .map((c) => {
                const ps = (c.ai_feedback as { patient_summary?: Record<string, string> })
                  .patient_summary;
                return `- ${new Date(c.created_at).toLocaleDateString("fr-FR")}: motif ${ps?.motif ?? "?"}, budget ${ps?.budget ?? "?"}, notes ${ps?.notes ?? "?"}`;
              })
              .join("\n");
            if (lines2)
              patientBlock = `\n\nHISTORIQUE PATIENT (recueilli par l'équipe lors d'échanges précédents — utilise-le pour orienter ce closing) :\n${lines2}`;
          } catch {
            /* pas d'historique : ignorer */
          }
        }

        const knowledge =
          [manualKnowledge, drive.text].filter(Boolean).join("\n\n") +
          patientBlock;

        let userProfile: string | undefined;
        try {
          const { data: prof } = await supabase
            .from("user_profiles")
            .select("analysis")
            .eq("user_id", user.id)
            .maybeSingle<{ analysis: string }>();
          userProfile = prof?.analysis ?? undefined;
        } catch {
          /* table user_profiles absente : ignorer */
        }

        const rec = await getLiveRecommendation(
          recentLines,
          knowledge,
          mode,
          userProfile,
        );
        send("recommendation", rec);
      } catch (err) {
        send("error", {
          message:
            err instanceof Error ? err.message : "Erreur recommandation IA",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
