"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2, Loader2 } from "lucide-react";
import type { CallRecord } from "@/lib/types";
import { formatDuration } from "@/lib/format";

export function CallsTrash({
  calls,
  userById,
  showOwner,
  canDelete,
}: {
  calls: CallRecord[];
  userById: Map<string, string>;
  showOwner: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allSelected = calls.length > 0 && selected.size === calls.length;

  function toggle(id: string) {
    setSelected((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(calls.map((c) => c.id)));
  }

  async function run(
    ids: string[],
    action: "restore" | "purge",
    confirmMsg?: string,
  ) {
    if (ids.length === 0) return;
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    setError(null);
    try {
      const results = await Promise.all(
        ids.map((id) =>
          fetch(
            action === "purge" ? `/api/calls/${id}?purge=1` : `/api/calls/${id}`,
            { method: action === "purge" ? "DELETE" : "POST" },
          ).then((r) => r.ok),
        ),
      );
      if (results.some((ok) => !ok)) throw new Error("Certaines ont échoué");
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'opération");
    } finally {
      setBusy(false);
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
      {canDelete && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-4 py-2.5">
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
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                run(
                  Array.from(selected.size ? selected : calls.map((c) => c.id)),
                  "restore",
                )
              }
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              Tout restaurer
            </button>
            <button
              onClick={() =>
                run(
                  Array.from(selected.size ? selected : calls.map((c) => c.id)),
                  "purge",
                  `Supprimer DÉFINITIVEMENT ${
                    selected.size || calls.length
                  } conversation(s) ? Irréversible.`,
                )
              }
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Tout supprimer
            </button>
          </div>
        </div>
      )}

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
            <div className="flex items-center gap-3">
              {canDelete && (
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                  className="h-4 w-4 rounded border-slate-300"
                />
              )}
              <div>
                <p className="text-sm font-medium text-slate-700">{label}</p>
                <p className="text-xs text-slate-500">
                  {new Date(c.created_at).toLocaleString("fr-FR")}
                  {" · ⏱ "}
                  {formatDuration(c.start_time, c.end_time)}
                  {showOwner && <> · {userById.get(c.user_id) ?? "—"}</>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!canDelete && (
                <span className="text-xs text-slate-400">
                  Réservé au Dr Delobaux
                </span>
              )}
              {canDelete && (
                <>
                  <button
                    onClick={() => run([c.id], "restore")}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restaurer
                  </button>
                  <button
                    onClick={() =>
                      run(
                        [c.id],
                        "purge",
                        `Supprimer DÉFINITIVEMENT "${label}" ? Irréversible.`,
                      )
                    }
                    disabled={busy}
                    title="Supprimer définitivement"
                    className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
