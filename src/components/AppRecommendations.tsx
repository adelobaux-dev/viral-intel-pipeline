"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Sparkles, RefreshCw, X } from "lucide-react";

const DONE_KEY = "appreco.done";
const HIDE_KEY = "appreco.hidden";
function loadSet(k: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(window.localStorage.getItem(k) || "[]"));
  } catch {
    return new Set();
  }
}
function saveSet(k: string, s: Set<string>) {
  window.localStorage.setItem(k, JSON.stringify(Array.from(s)));
}

export function AppRecommendations() {
  const [content, setContent] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDone(loadSet(DONE_KEY));
    setHidden(loadSet(HIDE_KEY));
  }, []);

  const items = useMemo(
    () =>
      (content ?? "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    [content],
  );

  function toggleDone(t: string) {
    setDone((prev) => {
      const n = new Set(prev);
      n.has(t) ? n.delete(t) : n.add(t);
      saveSet(DONE_KEY, n);
      return n;
    });
  }
  function hide(t: string) {
    setHidden((prev) => {
      const n = new Set(prev).add(t);
      saveSet(HIDE_KEY, n);
      return n;
    });
  }
  // Une ligne est un "titre de section" seulement si courte et finissant
  // par ":" — sinon c'est une recommandation (avec case à cocher + suppr.).
  const isItem = (l: string) =>
    !(l.length < 60 && /[:：]\s*$/.test(l));

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
        <div className="max-h-96 space-y-1 overflow-y-scroll rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
          {items
            .filter((l) => !hidden.has(l))
            .map((l, i) =>
              isItem(l) ? (
                <div
                  key={i}
                  className="group flex items-start gap-2 rounded-md px-2 py-1 hover:bg-white"
                >
                  <button
                    onClick={() => toggleDone(l)}
                    title="Marquer comme fait"
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      done.has(l)
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-slate-300"
                    }`}
                  >
                    {done.has(l) && <Check className="h-3 w-3" />}
                  </button>
                  <span
                    className={
                      done.has(l) ? "flex-1 text-slate-400 line-through" : "flex-1"
                    }
                  >
                    {l}
                  </span>
                  <button
                    onClick={() => hide(l)}
                    title="Supprimer cette recommandation"
                    className="shrink-0 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <p key={i} className="px-2 pt-2 font-semibold text-slate-800">
                  {l}
                </p>
              ),
            )}
        </div>
      )}
    </div>
  );
}
