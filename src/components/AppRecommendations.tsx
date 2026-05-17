"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles, RefreshCw } from "lucide-react";

export function AppRecommendations() {
  const [content, setContent] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(force = false) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/app-recommendations${force ? "?force=1" : ""}`,
      );
      const data = await res.json();
      if (!res.ok && !data.content) {
        throw new Error(data.error || "Échec");
      }
      setContent(data.content ?? null);
      setDate(data.created_at ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(false);
  }, []);

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-medical-600" />
          <h2 className="text-lg font-semibold text-slate-800">
            Recommandations d&apos;évolution (IA)
          </h2>
        </div>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Régénérer
        </button>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Analyse automatique des conversations (~toutes les 48 h), vue par des
        experts business / closing / négociation (Chris Voss, Hormozi, Dan
        Kennedy…).
        {date && (
          <>
            {" "}
            Dernière analyse :{" "}
            <strong>{new Date(date).toLocaleString("fr-FR")}</strong>
          </>
        )}
      </p>

      {error && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {error}
        </p>
      )}

      {loading && !content && (
        <p className="py-4 text-sm text-slate-400">
          Génération en cours… (cela peut prendre quelques secondes)
        </p>
      )}

      {content && (
        <div className="max-h-96 overflow-y-scroll whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
          {content}
        </div>
      )}
    </div>
  );
}
