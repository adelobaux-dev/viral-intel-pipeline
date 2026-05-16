"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lightbulb } from "lucide-react";
import { useCallStore } from "@/lib/store";
import { CARES_LABELS } from "@/lib/cares";
import type { Recommendation } from "@/lib/types";

const POLL_MS = 10000;

const urgencyStyles: Record<Recommendation["urgency"], string> = {
  low: "border-medical-200 bg-medical-50",
  medium: "border-amber-200 bg-amber-50",
  high: "border-red-300 bg-red-50",
};

export function RecommendationCards() {
  const isRecording = useCallStore((s) => s.isRecording);
  const recommendations = useCallStore((s) => s.recommendations);
  const addRecommendation = useCallStore((s) => s.addRecommendation);
  const esRef = useRef<EventSource | null>(null);

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
      const url = `/api/recommendations?lines=${encodeURIComponent(
        lines.join("\n"),
      )}`;
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
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {recommendations.length === 0 && (
          <p className="text-sm text-slate-400">
            Les conseils de closing s&apos;afficheront ici toutes les 10
            secondes.
          </p>
        )}
        <AnimatePresence initial={false}>
          {recommendations.map((r) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.2 }}
              className={`rounded-lg border px-4 py-3 ${urgencyStyles[r.urgency]}`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-medical-700">
                {CARES_LABELS[r.step] ?? r.step}
              </p>
              <p className="mt-1 text-sm font-medium text-slate-800">
                {r.message}
              </p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
