"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  RotateCcw,
  Sparkles,
  RefreshCw,
  X,
} from "lucide-react";

const COUNT_KEY = "appreco.counts";
const HIDE_KEY = "appreco.hidden";
const ARCHIVE_THRESHOLD = 3; // coché 3 fois → archivé

function loadCounts(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(COUNT_KEY) || "{}");
  } catch {
    return {};
  }
}
function loadHidden(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(window.localStorage.getItem(HIDE_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

export function AppRecommendations() {
  const [content, setContent] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setCounts(loadCounts());
    setHidden(loadHidden());
  }, []);

  const items = useMemo(
    () =>
      (content ?? "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    [content],
  );

  function setCount(t: string, value: number) {
    setCounts((prev) => {
      const n = { ...prev, [t]: value };
      window.localStorage.setItem(COUNT_KEY, JSON.stringify(n));
      return n;
    });
  }
  function check(t: string) {
    setCount(t, (counts[t] ?? 0) + 1);
  }
  function reactivate(t: string) {
    setCount(t, 0);
  }
  function hide(t: string) {
    setHidden((prev) => {
      const n = new Set(prev).add(t);
      window.localStorage.setItem(HIDE_KEY, JSON.stringify(Array.from(n)));
      return n;
    });
  }

  const isItem = (l: string) => !(l.length < 60 && /[:：]\s*$/.test(l));

  function checkAll() {
    setCounts((prev) => {
      const n = { ...prev };
      items
        .filter((l) => isItem(l) && !hidden.has(l))
        .forEach((l) => {
          n[l] = ARCHIVE_THRESHOLD;
        });
      window.localStorage.setItem(COUNT_KEY, JSON.stringify(n));
      return n;
    });
  }
  function hideAll() {
    if (!window.confirm("Supprimer toutes les recommandations affichées ?"))
      return;
    setHidden((prev) => {
      const n = new Set(prev);
      items.filter((l) => isItem(l)).forEach((l) => n.add(l));
      window.localStorage.setItem(HIDE_KEY, JSON.stringify(Array.from(n)));
      return n;
    });
  }
  function toggleSelect(t: string) {
    setSelected((p) => {
      const n = new Set(p);
      n.has(t) ? n.delete(t) : n.add(t);
      return n;
    });
  }
  function deleteSelection() {
    if (selected.size === 0) return;
    if (!window.confirm(`Supprimer ${selected.size} recommandation(s) ?`))
      return;
    setHidden((prev) => {
      const n = new Set(prev);
      selected.forEach((t) => n.add(t));
      window.localStorage.setItem(HIDE_KEY, JSON.stringify(Array.from(n)));
      return n;
    });
    setSelected(new Set());
  }

  async function load(force = false) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/app-recommendations${force ? "?force=1" : ""}`,
      );
      const data = await res.json();
      if (!res.ok && !data.content) throw new Error(data.error || "Échec");
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

  const visible = items.filter((l) => !hidden.has(l));
  const archived = visible.filter(
    (l) => isItem(l) && (counts[l] ?? 0) >= ARCHIVE_THRESHOLD,
  );

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

      {visible.some((l) => isItem(l)) && (
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            onClick={checkAll}
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            <Check className="h-3.5 w-3.5" /> Tout cocher
          </button>
          <button
            onClick={hideAll}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            <X className="h-3.5 w-3.5" /> Tout supprimer
          </button>
          <button
            onClick={deleteSelection}
            disabled={selected.size === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40"
          >
            <X className="h-3.5 w-3.5" /> Supprimer la sélection
            {selected.size > 0 && ` (${selected.size})`}
          </button>
        </div>
      )}
      <p className="mb-3 text-xs text-slate-500">
        Coche une recommandation à chaque avancée : après{" "}
        {ARCHIVE_THRESHOLD} validations elle passe en historique.
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
        <p className="py-4 text-sm text-slate-400">Génération en cours…</p>
      )}

      {content && (
        <div className="max-h-96 space-y-1 overflow-y-scroll rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
          {visible.map((l, i) => {
            if (!isItem(l))
              return (
                <p key={i} className="px-2 pt-2 font-semibold text-slate-800">
                  {l}
                </p>
              );
            const c = counts[l] ?? 0;
            if (c >= ARCHIVE_THRESHOLD) return null; // → historique
            return (
              <div
                key={i}
                className="group flex items-start gap-2 rounded-md px-2 py-1 hover:bg-white"
              >
                <input
                  type="checkbox"
                  checked={selected.has(l)}
                  onChange={() => toggleSelect(l)}
                  title="Sélectionner pour suppression"
                  className="mt-1 h-3.5 w-3.5 rounded border-slate-300"
                />
                <button
                  onClick={() => check(l)}
                  title={`Valider (${c}/${ARCHIVE_THRESHOLD})`}
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    c > 0
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-slate-300"
                  }`}
                >
                  {c > 0 && <Check className="h-3 w-3" />}
                </button>
                <span className="flex-1">{l}</span>
                {c > 0 && (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 text-[10px] font-semibold text-emerald-700">
                    {c}/{ARCHIVE_THRESHOLD}
                  </span>
                )}
                <button
                  onClick={() => hide(l)}
                  title="Supprimer définitivement"
                  className="shrink-0 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {archived.length > 0 && (
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
            Historique des recommandations validées ({archived.length})
          </button>
          {showHistory && (
            <div className="mt-2 max-h-56 space-y-1 overflow-y-scroll rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-500">
              {archived.map((l, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-md px-2 py-1"
                >
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  <span className="flex-1 line-through">{l}</span>
                  <button
                    onClick={() => reactivate(l)}
                    title="Réactiver"
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-medical-600 hover:text-medical-800"
                  >
                    <RotateCcw className="h-3 w-3" /> Réactiver
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
