"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, ChevronDown, ChevronRight, Loader2, RotateCcw, Users } from "lucide-react";

interface Row {
  id: string;
  user_email: string | null;
  content: string;
  created_at: string;
}

const ARCHIVE_KEY = "staff.suggestions.archived";

function loadArchived(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(
      JSON.parse(window.localStorage.getItem(ARCHIVE_KEY) || "[]"),
    );
  } catch {
    return new Set();
  }
}
function saveArchived(s: Set<string>) {
  window.localStorage.setItem(ARCHIVE_KEY, JSON.stringify(Array.from(s)));
}

export function StaffSuggestionsPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [archived, setArchived] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setArchived(loadArchived());
    fetch("/api/staff-suggestions")
      .then((r) => r.json())
      .then((d) => setRows(d.suggestions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function archive(id: string) {
    setArchived((p) => {
      const n = new Set(p).add(id);
      saveArchived(n);
      return n;
    });
  }
  function restore(id: string) {
    setArchived((p) => {
      const n = new Set(p);
      n.delete(id);
      saveArchived(n);
      return n;
    });
  }

  const active = useMemo(
    () => rows.filter((r) => !archived.has(r.id)),
    [rows, archived],
  );
  const archivedRows = useMemo(
    () => rows.filter((r) => archived.has(r.id)),
    [rows, archived],
  );

  return (
    <div className="card p-5">
      <div className="mb-2 flex items-center gap-2">
        <Users className="h-5 w-5 text-medical-600" />
        <h2 className="text-lg font-semibold text-slate-800">
          Recommandations d&apos;évolution (Staff)
        </h2>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          {active.length} actives · {archivedRows.length} traitées
        </span>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Suggestions envoyées par l&apos;équipe. Marque-les comme traitées une
        fois prises en compte ; elles passent dans l&apos;historique.
      </p>
      <div className="h-72 divide-y divide-slate-100 overflow-y-scroll rounded-lg border border-slate-200 bg-slate-50">
        {!loading && active.length === 0 && (
          <p className="px-3 py-3 text-sm text-slate-400">
            Aucune suggestion active.
          </p>
        )}
        {active.map((r) => (
          <div key={r.id} className="px-3 py-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>{r.user_email ?? "anonyme"}</span>
              <span>{new Date(r.created_at).toLocaleString("fr-FR")}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
              {r.content}
            </p>
            <div className="mt-1">
              <button
                onClick={() => archive(r.id)}
                className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                <Archive className="h-3 w-3" />
                Marquer comme traité
              </button>
            </div>
          </div>
        ))}
      </div>

      {archivedRows.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowHistory((s) => !s)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
          >
            {showHistory ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            Historique des suggestions traitées ({archivedRows.length})
          </button>
          {showHistory && (
            <div className="mt-2 max-h-60 divide-y divide-slate-100 overflow-y-scroll rounded-lg border border-slate-200 bg-white">
              {archivedRows.map((r) => (
                <div key={r.id} className="px-3 py-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{r.user_email ?? "anonyme"}</span>
                    <span>
                      {new Date(r.created_at).toLocaleString("fr-FR")}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-500 line-through">
                    {r.content}
                  </p>
                  <div className="mt-1">
                    <button
                      onClick={() => restore(r.id)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-medical-600 hover:text-medical-800"
                    >
                      <RotateCcw className="h-3 w-3" /> Réactiver
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
