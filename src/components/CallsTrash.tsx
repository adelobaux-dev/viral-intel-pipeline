"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2, Loader2 } from "lucide-react";
import type { CallRecord } from "@/lib/types";

export function CallsTrash({
  calls,
  userById,
  showOwner,
}: {
  calls: CallRecord[];
  userById: Map<string, string>;
  showOwner: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function restore(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/calls/${id}`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error || "Échec");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de la restauration");
    } finally {
      setBusyId(null);
    }
  }

  async function purge(id: string, label: string) {
    if (
      !window.confirm(
        `Supprimer DÉFINITIVEMENT "${label}" ? Impossible à récupérer.`,
      )
    )
      return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/calls/${id}?purge=1`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json()).error || "Échec");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de la suppression");
    } finally {
      setBusyId(null);
    }
  }

  if (calls.length === 0) {
    return (
      <div className="card p-6 text-center text-sm text-slate-400">
        La corbeille est vide.
      </div>
    );
  }

  return (
    <div className="card divide-y divide-slate-100">
      {error && (
        <div className="bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}
      {calls.map((c) => {
        const label = c.patient_name || "Conversation sans nom";
        return (
          <div
            key={c.id}
            className="flex items-center justify-between px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-slate-700">{label}</p>
              <p className="text-xs text-slate-500">
                {new Date(c.created_at).toLocaleString("fr-FR")}
                {showOwner && <> · {userById.get(c.user_id) ?? "—"}</>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => restore(c.id)}
                disabled={busyId === c.id}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {busyId === c.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
                Restaurer
              </button>
              <button
                onClick={() => purge(c.id, label)}
                disabled={busyId === c.id}
                title="Supprimer définitivement"
                className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
