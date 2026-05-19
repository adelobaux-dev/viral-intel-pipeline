"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { APP_VERSION } from "@/lib/version";

type Phase = "idle" | "checking" | "completed" | "failed";

const PENDING_KEY = "version.pending";

export function VersionUpdater() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string>("");

  // Au retour d'un rechargement forcé : a-t-on bien la version visée ?
  useEffect(() => {
    const pending = window.sessionStorage.getItem(PENDING_KEY);
    if (!pending) return;
    window.sessionStorage.removeItem(PENDING_KEY);
    if (pending === APP_VERSION) {
      setPhase("completed");
      setProgress(100);
      setMessage(`Mise à jour appliquée (${APP_VERSION})`);
    } else {
      setPhase("failed");
      setProgress(100);
      setMessage(
        `Échec : version chargée ${APP_VERSION}, attendue ${pending}. Réessaie dans 1-2 min (build Vercel en cours).`,
      );
    }
  }, []);

  async function refresh() {
    setPhase("checking");
    setProgress(8);
    setMessage("Recherche de la dernière version…");

    const timer = setInterval(
      () => setProgress((p) => (p < 85 ? p + 7 : p)),
      250,
    );

    try {
      const res = await fetch(`/api/version?t=${Date.now()}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as { version: string };
      clearInterval(timer);

      if (data.version === APP_VERSION) {
        setProgress(100);
        setPhase("completed");
        setMessage(`100% — déjà à jour (${APP_VERSION})`);
        return;
      }

      // Une version plus récente est déployée : on force le rechargement.
      setProgress(92);
      setMessage(
        `Nouvelle version ${data.version} détectée — installation…`,
      );
      window.sessionStorage.setItem(PENDING_KEY, data.version);
      try {
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch {
        /* ignore */
      }
      setTimeout(() => {
        const u = new URL(window.location.href);
        u.searchParams.set("v", data.version);
        window.location.replace(u.toString());
      }, 600);
    } catch {
      clearInterval(timer);
      setPhase("failed");
      setProgress(100);
      setMessage("Échec : impossible de contacter le serveur de version.");
    }
  }

  const barColor =
    phase === "failed"
      ? "bg-red-500"
      : phase === "completed"
        ? "bg-emerald-500"
        : "bg-medical-500";

  return (
    <div className="mx-auto mt-2 max-w-sm text-center">
      <button
        onClick={refresh}
        disabled={phase === "checking"}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-medical-300 hover:bg-medical-50 disabled:opacity-50"
      >
        {phase === "checking" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        Actualiser la version
      </button>

      {phase !== "idle" && (
        <div className="mt-3">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full transition-all duration-300 ${barColor}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p
            className={`mt-1.5 text-xs font-medium ${
              phase === "failed"
                ? "text-red-600"
                : phase === "completed"
                  ? "text-emerald-600"
                  : "text-slate-500"
            }`}
          >
            {phase === "completed" && "✅ "}
            {phase === "failed" && "❌ "}
            {message}
          </p>
        </div>
      )}

      <p className="mt-2 text-xs text-slate-400">
        Version déployée : {APP_VERSION}
      </p>
    </div>
  );
}
