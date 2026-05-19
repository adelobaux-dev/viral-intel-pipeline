"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/components/Toast";
import { useCallStore } from "@/lib/store";

/** Pop-ups en direct pendant la conversation (coaching temps réel). */
export function LiveCallAlerts() {
  const { notify } = useToast();
  const isRecording = useCallStore((s) => s.isRecording);
  const patientName = useCallStore((s) => s.patientName);
  const firedRef = useRef<Set<string>>(new Set());

  // (2) Micro : suggestion de test avant de démarrer
  useEffect(() => {
    if (!isRecording) {
      notify({
        key: "mic-test",
        tone: "warn",
        title: "Vérifie ton micro avant l'appel",
        body: "Clique « Activer / tester le micro » pour éviter un appel sans transcription.",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (3) Patient déjà connu
  useEffect(() => {
    const name = patientName?.trim() ?? "";
    if (name.length < 2) return;
    const t = setTimeout(() => {
      fetch(`/api/patient-context?name=${encodeURIComponent(name)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d?.found && (d.entries?.length ?? 0) > 0) {
            notify({
              key: `known-${name.toLowerCase()}`,
              title: `${d.entries.length} conversation(s) trouvée(s)`,
              body: "Historique patient disponible — consulte le dossier ci-dessus.",
            });
          }
        })
        .catch(() => {});
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientName]);

  // (4-7) Surveillance en direct pendant l'enregistrement
  useEffect(() => {
    if (!isRecording) return;
    const id = setInterval(() => {
      const s = useCallStore.getState();
      const fired = firedRef.current;

      const patientText = s.lines
        .filter((l) => l.isFinal && l.speaker !== "user")
        .map((l) => l.text.toLowerCase())
        .join(" ");
      const recs = s.recommendations;
      const last = recs[0];

      // (4) Signal d'achat
      if (
        !fired.has("buy") &&
        last &&
        (last.step === "securiser" || last.step === "engager") &&
        last.importance >= 8
      ) {
        fired.add("buy");
        notify({
          key: "buy",
          tone: "success",
          title: "🔥 Signal d'achat détecté",
          body: "Propose le prépaiement de 50 € maintenant (déduit du devis).",
        });
      }

      // (5) Objection prix répétée
      const priceHits = (
        patientText.match(/\b(prix|cher|co[uû]te|budget|tarif)\b/g) || []
      ).length;
      if (!fired.has("price") && priceHits >= 2) {
        fired.add("price");
        notify({
          key: "price",
          tone: "warn",
          title: "Objection prix répétée",
          body: "Bascule sur la preuve et la valeur plutôt que sur le montant.",
        });
      }

      // (6) Étape C.A.R.E.S. sautée
      const steps = recs.map((r) => r.step);
      if (
        !fired.has("skip") &&
        steps.length >= 3 &&
        (steps.includes("engager") || steps.includes("securiser")) &&
        !steps.includes("connecter")
      ) {
        fired.add("skip");
        notify({
          key: "skip",
          tone: "warn",
          title: 'Étape "Connecter" manquante',
          body: "Crée le lien avant de pousser — risque de perte.",
        });
      }

      // (7) Score de closing en chute
      if (!fired.has("score") && last && last.closingScore > 0 && last.closingScore < 4) {
        fired.add("score");
        notify({
          key: "score",
          tone: "warn",
          title: "Closing fragile",
          body: "Ralentis, ré-écoute le besoin du patient avant d'avancer.",
        });
      }
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording]);

  return null;
}
