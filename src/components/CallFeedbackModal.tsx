"use client";

import Link from "next/link";
import { Check, Copy, X } from "lucide-react";
import { useState } from "react";
import { CARES_LABELS } from "@/lib/cares";
import type { AiFeedback, CaresStep } from "@/lib/types";

export function CallFeedbackModal({
  feedback,
  integrations,
  onClose,
}: {
  feedback: AiFeedback;
  integrations: Record<string, string> | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const s = feedback.patient_summary;

  const summaryText = `Motif: ${s.motif}\nTaille/Poids: ${s.taille_poids}\nBudget: ${s.budget}\nNotes: ${s.notes}`;

  async function copySummary() {
    await navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-800">
            Bilan de l&apos;appel
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-medical-600 text-white">
              <span className="text-2xl font-bold">{feedback.score}</span>
              <span className="text-[10px] uppercase">/ 10</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-500">
                Respect du script C.A.R.E.S.
              </p>
              <div className="mt-2 grid grid-cols-5 gap-2">
                {(Object.keys(feedback.cares_breakdown) as CaresStep[]).map(
                  (k) => (
                    <div key={k} className="text-center">
                      <div className="text-sm font-bold text-medical-700">
                        {feedback.cares_breakdown[k]}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {CARES_LABELS[k]}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-emerald-700">
                Points forts
              </h3>
              <ul className="space-y-1 text-sm text-slate-700">
                {feedback.strengths.map((x, i) => (
                  <li key={i}>• {x}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-amber-700">
                Axes d&apos;amélioration
              </h3>
              <ul className="space-y-1 text-sm text-slate-700">
                {feedback.improvements.map((x, i) => (
                  <li key={i}>• {x}</li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">
                Résumé patient (Doctolib)
              </h3>
              <button
                onClick={copySummary}
                className="btn-secondary px-3 py-1.5 text-xs"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copié" : "Copier"}
              </button>
            </div>
            <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              {summaryText}
            </pre>
          </div>

          {integrations && (
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              <p className="mb-1 font-semibold text-slate-700">Intégrations</p>
              <p>
                Drive :{" "}
                {integrations.drive
                  ? "archivé ✓"
                  : integrations.driveError || "—"}
              </p>
              <p>
                Email patient :{" "}
                {integrations.email
                  ? "envoyé ✓"
                  : integrations.emailError || "non envoyé"}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <Link href="/dashboard" className="btn-secondary">
            Retour au dashboard
          </Link>
          <button onClick={onClose} className="btn-primary">
            Nouvel appel
          </button>
        </div>
      </div>
    </div>
  );
}
