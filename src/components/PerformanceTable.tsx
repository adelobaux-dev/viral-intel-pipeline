"use client";

import { useEffect, useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import { formatDuration } from "@/lib/format";

interface Row {
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
  correlation: number;
  correlationPairs: number;
}

function corrText(c: number): string {
  const a = Math.abs(c);
  const strength =
    a < 0.2 ? "négligeable" : a < 0.4 ? "faible" : a < 0.6 ? "modérée" : "forte";
  const dir = c > 0 ? "positive" : "négative";
  return `${c} — corrélation ${strength} ${dir} (durée ↔ score)`;
}

export function PerformanceTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/performance")
      .then((r) => r.json())
      .then((d) => {
        setRows(d.rows ?? []);
        setStats(d.stats ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-medical-600" />
        <h2 className="text-lg font-semibold text-slate-800">
          Performance &amp; corrélation
        </h2>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      </div>

      {stats && (
        <div className="mb-3 grid gap-3 sm:grid-cols-4">
          {[
            ["Conversations", String(stats.count)],
            ["Score moyen", `${stats.avgScore}/10`],
            ["Conversion", `${stats.conversion}%`],
            ["Corrélation", String(stats.correlation)],
          ].map(([l, v]) => (
            <div key={l} className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">
                {l}
              </p>
              <p className="text-lg font-bold text-slate-800">{v}</p>
            </div>
          ))}
        </div>
      )}
      {stats && stats.correlationPairs >= 3 && (
        <p className="mb-3 text-xs text-slate-500">
          {corrText(stats.correlation)} · sur {stats.correlationPairs}{" "}
          conversations chronométrées.
        </p>
      )}

      <div className="max-h-96 overflow-y-scroll rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Membre</th>
              <th className="px-3 py-2">Patient</th>
              <th className="px-3 py-2">Durée</th>
              <th className="px-3 py-2">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-slate-50">
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
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
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
