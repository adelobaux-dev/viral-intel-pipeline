"use client";

import { useEffect } from "react";
import { useToast } from "@/components/Toast";

/** Pop-ups dashboard : onboarding, rappel J+1, nouvelles recos. */
export function DashboardAlerts() {
  const { notify } = useToast();

  useEffect(() => {
    fetch("/api/dashboard-alerts")
      .then((r) => r.json())
      .then((d) => {
        if (d?.hasProfile === false) {
          notify({
            key: "onboarding",
            title: "Personnalise ton coaching (3 min)",
            body: "Fais ton profil de personnalité pour des conseils sur-mesure.",
            href: "/onboarding",
            hrefLabel: "Faire le test",
          });
        }
        if (d?.fragileYesterday > 0) {
          notify({
            key: "j1",
            tone: "warn",
            title: `${d.fragileYesterday} conversation(s) fragile(s) hier`,
            body: "Relance recommandée aujourd'hui pour récupérer ces dossiers.",
          });
        }
        if (d?.newReco) {
          notify({
            key: "newreco",
            title: "Nouvelles recommandations d'évolution",
            body: "L'IA a généré de nouvelles pistes d'amélioration.",
          });
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
