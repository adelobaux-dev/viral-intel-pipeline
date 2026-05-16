"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { CARES_LABELS } from "@/lib/cares";
import type { CallRecord, CaresStep } from "@/lib/types";

export function CallsTable({
  calls,
  showOwner,
  userById,
}: {
  calls: CallRecord[];
  showOwner: boolean;
  userById: Map<string, string>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (calls.length === 0) {
    return (
      <div className="card p-6 text-center text-sm text-slate-400">
        Aucun appel enregistré.
      </div>
    );
  }

  return (
    <div className="card divide-y divide-slate-100">
      {calls.map((c) => {
        const open = openId === c.id;
        return (
          <div key={c.id}>
            <button
              onClick={() => setOpenId(open ? null : c.id)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
            >
              <div className="flex items-center gap-3">
                {open ? (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                )}
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {c.patient_name || "Patient sans nom"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(c.created_at).toLocaleString("fr-FR")}
                    {showOwner && (
                      <> · {userById.get(c.user_id) ?? "—"}</>
                    )}
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  (c.score ?? 0) >= 6
                    ? "bg-emerald-100 text-emerald-700"
                    : c.score == null
                      ? "bg-slate-100 text-slate-500"
                      : "bg-amber-100 text-amber-700"
                }`}
              >
                {c.score != null ? `${Number(c.score).toFixed(1)}/10` : "—"}
              </span>
            </button>

            {open && c.ai_feedback && (
              <div className="space-y-4 bg-slate-50 px-6 py-4 text-sm">
                <div className="grid grid-cols-5 gap-2">
                  {(
                    Object.keys(c.ai_feedback.cares_breakdown) as CaresStep[]
                  ).map((k) => (
                    <div key={k} className="text-center">
                      <div className="font-bold text-medical-700">
                        {c.ai_feedback!.cares_breakdown[k]}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {CARES_LABELS[k]}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 font-semibold text-emerald-700">
                      Points forts
                    </p>
                    <ul className="space-y-1 text-slate-700">
                      {c.ai_feedback.strengths.map((s, i) => (
                        <li key={i}>• {s}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1 font-semibold text-amber-700">
                      Axes d&apos;amélioration
                    </p>
                    <ul className="space-y-1 text-slate-700">
                      {c.ai_feedback.improvements.map((s, i) => (
                        <li key={i}>• {s}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div>
                  <p className="mb-1 font-semibold text-slate-700">
                    Résumé patient
                  </p>
                  <pre className="whitespace-pre-wrap rounded-md bg-white p-3 text-slate-700">
                    {`Motif: ${c.ai_feedback.patient_summary.motif}
Taille/Poids: ${c.ai_feedback.patient_summary.taille_poids}
Budget: ${c.ai_feedback.patient_summary.budget}
Notes: ${c.ai_feedback.patient_summary.notes}`}
                  </pre>
                </div>
              </div>
            )}
            {open && !c.ai_feedback && (
              <div className="bg-slate-50 px-6 py-4 text-sm text-slate-500">
                Pas d&apos;analyse IA disponible pour cet appel.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
