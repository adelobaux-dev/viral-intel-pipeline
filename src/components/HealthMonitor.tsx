"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useCallStore } from "@/lib/store";

/**
 * Surveille en continu que la transcription ET les conseils IA fonctionnent.
 * Affiche une alerte claire en cas de blocage (micro, clé IA, réseau).
 */
export function HealthMonitor() {
  const isRecording = useCallStore((s) => s.isRecording);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!isRecording) return;
    const id = setInterval(() => tick((n) => n + 1), 4000);
    return () => clearInterval(id);
  }, [isRecording]);

  if (!isRecording) return null;

  const s = useCallStore.getState();
  const now = Date.now();
  const started = s.startedAt ?? now;
  const elapsed = (now - started) / 1000;
  const finals = s.lines.filter((l) => l.isFinal);
  const lastLine = finals.length
    ? Math.max(...finals.map((l) => l.timestamp))
    : 0;
  const lastRec = s.recommendations.length
    ? Math.max(...s.recommendations.map((r) => r.createdAt))
    : 0;

  const transcriptionDown = elapsed > 20 && finals.length === 0;
  const transcriptionStale =
    finals.length > 0 && (now - lastLine) / 1000 > 45;
  const adviceDown =
    finals.length >= 2 &&
    s.recommendations.length === 0 &&
    elapsed > 35;
  const adviceStale =
    s.recommendations.length > 0 && (now - lastRec) / 1000 > 40;

  const problems: string[] = [];
  if (transcriptionDown)
    problems.push(
      "Transcription inactive : vérifie l'autorisation micro et la connexion (le test micro peut aider).",
    );
  else if (transcriptionStale)
    problems.push(
      "Aucune parole transcrite depuis 45 s (silence ou micro coupé ?).",
    );
  if (adviceDown)
    problems.push(
      "Conseils C.A.R.E.S. non reçus : vérifie la clé Anthropic / réessaie.",
    );
  else if (adviceStale)
    problems.push("Conseils en attente de rafraîchissement…");

  if (problems.length === 0) {
    return (
      <div className="flex items-center gap-2 border-b border-emerald-200 bg-emerald-50 px-6 py-1.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Transcription &amp; conseils opérationnels
        <Activity className="ml-1 h-3.5 w-3.5 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="border-b border-red-200 bg-red-50 px-6 py-2 text-xs text-red-700">
      {problems.map((p, i) => (
        <div key={i} className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{p}</span>
        </div>
      ))}
    </div>
  );
}
