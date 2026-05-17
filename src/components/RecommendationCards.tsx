"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lightbulb } from "lucide-react";
import { useCallStore, loadMode } from "@/lib/store";
import { CARES_LABELS, CONSULTATION_MODES } from "@/lib/cares";

const POLL_MS = 10000;

// Importance 1-10 : rouge 8-10, orange 5-7, jaune 1-4
function importanceStyle(n: number): {
  bar: string;
  text: string;
  card: string;
} {
  if (n >= 8)
    return {
      bar: "bg-red-500",
      text: "text-red-700",
      card: "border-red-300 bg-red-50",
    };
  if (n >= 5)
    return {
      bar: "bg-orange-500",
      text: "text-orange-700",
      card: "border-orange-200 bg-orange-50",
    };
  return {
    bar: "bg-yellow-400",
    text: "text-yellow-700",
    card: "border-yellow-200 bg-yellow-50",
  };
}

// Score closing 0-10 : 9-10 bleu clair, 7-8 vert, 5-6 jaune, 3-4 orange, 1-2 rouge
function scoreStyle(s: number): { bar: string; label: string } {
  if (s >= 9) return { bar: "bg-sky-400", label: "Excellent" };
  if (s >= 7) return { bar: "bg-green-500", label: "Bon" };
  if (s >= 5) return { bar: "bg-yellow-400", label: "Moyen" };
  if (s >= 3) return { bar: "bg-orange-500", label: "Fragile" };
  return { bar: "bg-red-500", label: "Critique" };
}

export function RecommendationCards() {
  const isRecording = useCallStore((s) => s.isRecording);
  const recommendations = useCallStore((s) => s.recommendations);
  const addRecommendation = useCallStore((s) => s.addRecommendation);
  const mode = useCallStore((s) => s.mode);
  const setMode = useCallStore((s) => s.setMode);
  const esRef = useRef<EventSource | null>(null);

  // Restaure le profil (mode) de la dernière connexion de l'utilisateur.
  useEffect(() => {
    setMode(loadMode());
  }, [setMode]);

  useEffect(() => {
    if (!isRecording) return;

    const poll = () => {
      const lines = useCallStore
        .getState()
        .lines.filter((l) => l.isFinal)
        .slice(-10)
        .map((l) => l.text);
      if (lines.length === 0) return;

      esRef.current?.close();
      const st = useCallStore.getState();
      const url = `/api/recommendations?mode=${st.mode}&patient=${encodeURIComponent(
        st.patientName || "",
      )}&lines=${encodeURIComponent(lines.join("\n"))}`;
      const es = new EventSource(url);
      esRef.current = es;

      es.addEventListener("recommendation", (e) => {
        try {
          addRecommendation(JSON.parse((e as MessageEvent).data));
        } catch {
          /* ignore */
        }
        es.close();
      });
      es.addEventListener("idle", () => es.close());
      es.addEventListener("error", () => es.close());
    };

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      clearInterval(id);
      esRef.current?.close();
    };
  }, [isRecording, addRecommendation]);

  return (
    <div className="card flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
        <Lightbulb className="h-4 w-4 text-medical-600" />
        <h2 className="text-sm font-semibold text-slate-700">
          Recommandations C.A.R.E.S.
        </h2>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-3 py-2">
        {CONSULTATION_MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            title={m.objective}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
              mode === m.key
                ? "bg-medical-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {recommendations.length > 0 &&
        (() => {
          const s = recommendations[0].closingScore;
          const st = scoreStyle(s);
          return (
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600">
                <span>Score de closing</span>
                <span>
                  {s}/10 · {st.label}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${st.bar}`}
                  style={{ width: `${s * 10}%` }}
                />
              </div>
            </div>
          );
        })()}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-scroll p-4">
        {recommendations.length === 0 && (
          <p className="text-sm text-slate-400">
            Les conseils de closing s&apos;afficheront ici toutes les 10
            secondes.
          </p>
        )}
        <AnimatePresence initial={false}>
          {recommendations.map((r) => {
            const imp = importanceStyle(r.importance);
            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.2 }}
                className={`rounded-lg border px-4 py-3 ${imp.card}`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-medical-700">
                    {CARES_LABELS[r.step] ?? r.step}
                  </p>
                  <span className={`text-[11px] font-bold ${imp.text}`}>
                    Importance {r.importance}/10
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/70">
                  <div
                    className={`h-full rounded-full ${imp.bar}`}
                    style={{ width: `${r.importance * 10}%` }}
                  />
                </div>
                <p className="mt-2 text-sm font-medium text-slate-800">
                  {r.message}
                </p>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
