"use client";

import { Fragment, useEffect, useState } from "react";
import { Activity, Loader2 } from "lucide-react";

interface Row {
  name: string;
  role: string;
  email: string;
  accountCreated: string;
  lastSignIn: string | null;
  conversations: number;
  lastConversation: string | null;
  sessions: number;
  usageMinutes: number;
  recentConnections: string[];
}

function usage(min: number): string {
  if (!min) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleString("fr-FR") : "—";

export function UserActivityPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/user-activity")
      .then((r) => r.json())
      .then((d) => setRows(d.users ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="h-5 w-5 text-medical-600" />
        <h2 className="text-lg font-semibold text-slate-800">
          Activité des utilisateurs
        </h2>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Réservé au Dr Delobaux. Dates de connexion et usage par membre.
      </p>
      <div className="max-h-80 overflow-y-scroll rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Membre</th>
              <th className="px-3 py-2">Rôle</th>
              <th className="px-3 py-2">Dernière connexion</th>
              <th className="px-3 py-2">Sessions</th>
              <th className="px-3 py-2">Temps d&apos;utilisation</th>
              <th className="px-3 py-2">Conv.</th>
              <th className="px-3 py-2">Dernière conv.</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <Fragment key={r.email}>
                <tr className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-800">
                    {r.name}
                  </td>
                  <td className="px-3 py-2 capitalize text-slate-600">
                    {r.role}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {fmt(r.lastSignIn)}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{r.sessions}</td>
                  <td className="px-3 py-2 font-medium text-medical-700">
                    {usage(r.usageMinutes)}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {r.conversations}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {fmt(r.lastConversation)}
                  </td>
                  <td className="px-3 py-2">
                    {r.recentConnections.length > 0 && (
                      <button
                        onClick={() =>
                          setOpen(open === r.email ? null : r.email)
                        }
                        className="text-xs font-semibold text-medical-600 hover:underline"
                      >
                        {open === r.email ? "Masquer" : "Historique"}
                      </button>
                    )}
                  </td>
                </tr>
                {open === r.email && (
                  <tr className="bg-slate-50">
                    <td colSpan={8} className="px-6 py-2">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Connexions récentes · compte créé {fmt(r.accountCreated)}
                      </p>
                      <ul className="grid grid-cols-2 gap-x-6 text-xs text-slate-600 sm:grid-cols-3">
                        {r.recentConnections.map((c, i) => (
                          <li key={i}>• {fmt(c)}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
                  Aucun utilisateur.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        Sessions &amp; temps d&apos;utilisation reconstitués depuis l&apos;activité
        réelle (battements toutes les 60 s, regroupés par session). Historique
        90 jours. Visible uniquement par le Dr Delobaux.
      </p>
    </div>
  );
}
