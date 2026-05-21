"use client";

import { useEffect, useState } from "react";
import { BarChart3, Loader2, Trash2 } from "lucide-react";
import { formatDuration } from "@/lib/format";

interface Row {
  id: string;
  date: string;
  user: string;
  patient: string;
  durationSec: number;
  score: number;
}
interface Stats {
  count: number;
  avgScore: number;
  conversion: number;
  converted: number;
  correlation: number;
  correlationPairs: number;
}
interface Verbatim {
  label: string;
  count: number;
  avgPresent: number;
  avgAbsent: number;
  convPresent: number;
}
interface Data {
  rows: Row[];
  stats: Stats;
  buckets: { label: string; count: number }[];
  timeline: { day: string; avg: number }[];
  scatter: { x: number; y: number }[];
  verbatims: Verbatim[];
}

function Donut({ pct }: { pct: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 90 90" className="h-28 w-28">
      <circle cx="45" cy="45" r={r} fill="none" stroke="#e2e8f0" strokeWidth="11" />
      <circle
        cx="45"
        cy="45"
        r={r}
        fill="none"
        stroke="#3a76ad"
        strokeWidth="11"
        strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * c} ${c}`}
        transform="rotate(-90 45 45)"
      />
      <text
        x="45"
        y="50"
        textAnchor="middle"
        className="fill-slate-800 text-[16px] font-bold"
      >
        {pct}%
      </text>
    </svg>
  );
}

function corrText(c: number): string {
  const a = Math.abs(c);
  const s =
    a < 0.2 ? "négligeable" : a < 0.4 ? "faible" : a < 0.6 ? "modérée" : "forte";
  return `${c} — corrélation ${s} ${c >= 0 ? "positive" : "négative"}`;
}

export function PerformanceTable() {
  const [d, setD] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canDelete, setCanDelete] = useState(false);

  function toggle(id: string) {
    setSelected((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function toggleAll() {
    const ids = (d?.rows ?? []).map((r) => r.id);
    setSelected(
      ids.length > 0 && selected.size === ids.length ? new Set() : new Set(ids),
    );
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/performance");
      const x = await res.json();
      setD(x);
    } finally {
      setLoading(false);
    }
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (
      !window.confirm(
        `Supprimer ${selected.size} conversation(s) ? Le calcul de performance et la corrélation se feront sur les conversations restantes.`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const ids = Array.from(selected);
      const results = await Promise.all(
        ids.map((id) =>
          fetch(`/api/calls/${id}`, { method: "DELETE" }).then((r) => r.ok),
        ),
      );
      if (results.some((ok) => !ok))
        throw new Error("Certaines suppressions ont échoué (réservé à Dr Delobaux).");
      setSelected(new Set());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de la suppression");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    fetch("/api/me")
      .then((r) => r.json())
      .then((x) =>
        setCanDelete(
          ((x?.email as string | undefined) ?? "").toLowerCase().includes(
            "delobaux",
          ),
        ),
      )
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxBucket = Math.max(1, ...(d?.buckets.map((b) => b.count) ?? [1]));
  const tl = d?.timeline ?? [];
  const tlMax = 10;

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-medical-600" />
        <h2 className="text-lg font-semibold text-slate-800">
          Performance &amp; corrélation — analyse experte
        </h2>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      </div>

      {d?.stats && (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Camembert conversion */}
            <div className="flex items-center gap-4 rounded-xl border border-slate-200 p-4">
              <Donut pct={d.stats.conversion} />
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Taux de conversion
                </p>
                <p className="text-xs text-slate-500">
                  {d.stats.converted}/{d.stats.count} conversations ≥ 6/10
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Score moyen{" "}
                  <span className="font-bold text-medical-700">
                    {d.stats.avgScore}/10
                  </span>
                </p>
              </div>
            </div>

            {/* Histogramme scores */}
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="mb-2 text-sm font-semibold text-slate-700">
                Distribution des scores
              </p>
              <div className="flex h-24 items-end gap-2">
                {d.buckets.map((b) => (
                  <div key={b.label} className="flex flex-1 flex-col items-center">
                    <div
                      className="w-full rounded-t bg-medical-500"
                      style={{
                        height: `${(b.count / maxBucket) * 80}px`,
                        minHeight: b.count ? "4px" : "0",
                      }}
                    />
                    <span className="mt-1 text-[10px] text-slate-500">
                      {b.label}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-700">
                      {b.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Courbe temporelle */}
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="mb-2 text-sm font-semibold text-slate-700">
                Score moyen dans le temps
              </p>
              {tl.length >= 2 ? (
                <svg viewBox="0 0 100 40" className="h-24 w-full">
                  <polyline
                    fill="none"
                    stroke="#3a76ad"
                    strokeWidth="2"
                    points={tl
                      .map(
                        (p, i) =>
                          `${(i / (tl.length - 1)) * 100},${
                            40 - (p.avg / tlMax) * 38
                          }`,
                      )
                      .join(" ")}
                  />
                </svg>
              ) : (
                <p className="text-xs text-slate-400">
                  Pas assez d&apos;historique.
                </p>
              )}
              <p className="text-[10px] text-slate-500">
                {tl[0]?.day} → {tl[tl.length - 1]?.day}
              </p>
            </div>
          </div>

          {/* Nuage durée ↔ score */}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="mb-1 text-sm font-semibold text-slate-700">
                Corrélation durée ↔ score
              </p>
              <p className="mb-2 text-xs text-slate-500">
                {d.stats.correlationPairs >= 3
                  ? corrText(d.stats.correlation)
                  : "Pas assez de données chronométrées."}
              </p>
              <svg
                viewBox="0 0 100 60"
                className="h-32 w-full rounded bg-slate-50"
              >
                {d.scatter.map((p, i) => {
                  const maxX = Math.max(...d.scatter.map((s) => s.x), 1);
                  return (
                    <circle
                      key={i}
                      cx={(p.x / maxX) * 96 + 2}
                      cy={58 - (p.y / 10) * 56}
                      r="1.6"
                      className="fill-medical-500"
                      opacity="0.6"
                    />
                  );
                })}
              </svg>
              <p className="text-[10px] text-slate-400">
                axe X = durée (min) · axe Y = score /10
              </p>
            </div>

            {/* Impact des verbatims */}
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="mb-2 text-sm font-semibold text-slate-700">
                Impact des verbatims sur le score
              </p>
              <div className="space-y-1.5">
                {d.verbatims.slice(0, 8).map((v) => {
                  const delta = v.avgPresent - v.avgAbsent;
                  return (
                    <div key={v.label} className="text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-700">
                          {v.label}{" "}
                          <span className="text-slate-400">({v.count})</span>
                        </span>
                        <span
                          className={
                            delta >= 0
                              ? "font-semibold text-emerald-600"
                              : "font-semibold text-red-600"
                          }
                        >
                          {delta >= 0 ? "+" : ""}
                          {delta.toFixed(1)} pt · {v.avgPresent}/10
                        </span>
                      </div>
                      <div className="mt-0.5 h-1.5 w-full rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full ${
                            delta >= 0 ? "bg-emerald-500" : "bg-red-500"
                          }`}
                          style={{
                            width: `${Math.min(100, (v.avgPresent / 10) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
                {d.verbatims.length === 0 && (
                  <p className="text-xs text-slate-400">
                    Pas encore de transcriptions analysables.
                  </p>
                )}
              </div>
            </div>
          </div>

          <p className="mt-3 text-[11px] text-slate-400">
            Lecture experte : un verbatim avec un fort « + pt » est un signal
            favorable à exploiter ; un « − pt » signale une objection à
            désamorcer plus tôt dans la conversation.
          </p>
        </>
      )}

      {canDelete && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={
                (d?.rows.length ?? 0) > 0 &&
                selected.size === (d?.rows.length ?? 0)
              }
              onChange={toggleAll}
              className="h-4 w-4 rounded border-slate-300"
            />
            Tout cocher
            {selected.size > 0 && (
              <span className="text-slate-400">({selected.size})</span>
            )}
          </label>
          <button
            onClick={deleteSelected}
            disabled={selected.size === 0 || busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Supprimer les conversations sélectionnées
          </button>
        </div>
      )}
      {error && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="mt-4 max-h-80 overflow-y-scroll rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              {canDelete && <th className="px-3 py-2"></th>}
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Membre</th>
              <th className="px-3 py-2">Patient</th>
              <th className="px-3 py-2">Durée</th>
              <th className="px-3 py-2">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(d?.rows ?? []).map((r, i) => (
              <tr key={r.id ?? i} className="hover:bg-slate-50">
                {canDelete && (
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </td>
                )}
                <td className="px-3 py-2 text-slate-600">
                  {new Date(r.date).toLocaleString("fr-FR")}
                </td>
                <td className="px-3 py-2 text-slate-700">{r.user}</td>
                <td className="px-3 py-2 text-slate-600">{r.patient}</td>
                <td className="px-3 py-2 text-slate-600">
                  {r.durationSec > 0
                    ? formatDuration(
                        new Date(0).toISOString(),
                        new Date(r.durationSec * 1000).toISOString(),
                      )
                    : "—"}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.score >= 6
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {r.score.toFixed(1)}/10
                  </span>
                </td>
              </tr>
            ))}
            {!loading && (d?.rows.length ?? 0) === 0 && (
              <tr>
                <td
                  colSpan={canDelete ? 6 : 5}
                  className="px-3 py-6 text-center text-slate-400"
                >
                  Aucune conversation scorée.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
