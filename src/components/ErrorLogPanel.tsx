"use client";

import { useEffect, useState } from "react";
import { AlertOctagon, Loader2, RefreshCw, Trash2 } from "lucide-react";

interface ErrLog {
  id: string;
  user_email: string | null;
  message: string;
  detail: string | null;
  path: string | null;
  created_at: string;
}

export function ErrorLogPanel() {
  const [errors, setErrors] = useState<ErrLog[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/errors");
      const data = await res.json();
      if (res.ok) setErrors(data.errors ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function clearAll() {
    if (!window.confirm("Vider tout le journal d'erreurs ?")) return;
    await fetch("/api/errors", { method: "DELETE" });
    setErrors([]);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertOctagon className="h-5 w-5 text-red-600" />
          <h2 className="text-lg font-semibold text-slate-800">
            Erreurs des utilisateurs
          </h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {errors.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Actualiser
          </button>
          {errors.length > 0 && (
            <button
              onClick={clearAll}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              <Trash2 className="h-3.5 w-3.5" /> Vider
            </button>
          )}
        </div>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Visible uniquement par le Dr Delobaux. Remontée automatique des erreurs
        rencontrées par toute l&apos;équipe.
      </p>

      <div className="h-64 divide-y divide-slate-100 overflow-y-scroll rounded-lg border border-slate-200 bg-slate-50">
        {loading && (
          <p className="px-3 py-3 text-sm text-slate-400">Chargement…</p>
        )}
        {!loading && errors.length === 0 && (
          <p className="px-3 py-3 text-sm text-slate-400">
            Aucune erreur remontée. 🎉
          </p>
        )}
        {errors.map((e) => (
          <div key={e.id} className="px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium text-slate-800">
                {e.message}
              </p>
              <span className="shrink-0 text-[11px] text-slate-400">
                {new Date(e.created_at).toLocaleString("fr-FR")}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {e.user_email || "anonyme"}
              {e.path ? ` · ${e.path}` : ""}
            </p>
            {e.detail && (
              <pre className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap rounded bg-white p-2 text-[11px] text-slate-500">
                {e.detail}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
