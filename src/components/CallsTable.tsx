"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Loader2, Trash2 } from "lucide-react";
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
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allSelected = calls.length > 0 && selected.size === calls.length;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(calls.map((c) => c.id)));
  }

  async function deleteIds(ids: string[], confirmLabel: string) {
    if (
      !window.confirm(
        `Supprimer définitivement ${confirmLabel} ? Cette action est irréversible.`,
      )
    ) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const results = await Promise.all(
        ids.map((id) =>
          fetch(`/api/calls/${id}`, { method: "DELETE" }).then((r) => r.ok),
        ),
      );
      if (results.some((ok) => !ok)) {
        throw new Error("Certaines conversations n'ont pas pu être supprimées");
      }
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la suppression");
    } finally {
      setBusy(false);
    }
  }

  if (calls.length === 0) {
    return (
      <div className="card p-6 text-center text-sm text-slate-400">
        Aucune conversation enregistrée.
      </div>
    );
  }

  return (
    <div className="card divide-y divide-slate-100">
      <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-2.5">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="h-4 w-4 rounded border-slate-300"
          />
          Tout cocher
          {selected.size > 0 && (
            <span className="text-slate-400">({selected.size})</span>
          )}
        </label>
        <button
          onClick={() =>
            deleteIds(
              Array.from(selected),
              `${selected.size} conversation(s) sélectionnée(s)`,
            )
          }
          disabled={selected.size === 0 || busy}
          className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          Supprimer la sélection
        </button>
      </div>

      {error && (
        <div className="bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      {calls.map((c) => {
        const open = openId === c.id;
        const label = c.patient_name || "Conversation sans nom";
        return (
          <div key={c.id}>
            <div className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
              <div className="flex flex-1 items-center gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggleOne(c.id)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <button
                  onClick={() => setOpenId(open ? null : c.id)}
                  className="flex flex-1 items-center gap-3 text-left"
                >
                  {open ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {label}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(c.created_at).toLocaleString("fr-FR")}
                      {showOwner && <> · {userById.get(c.user_id) ?? "—"}</>}
                    </p>
                  </div>
                </button>
              </div>

              <div className="flex items-center gap-3">
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
                <button
                  onClick={() => deleteIds([c.id], `la conversation "${label}"`)}
                  disabled={busy}
                  title="Supprimer cette conversation"
                  className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

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
                Pas d&apos;analyse IA disponible pour cette conversation.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
