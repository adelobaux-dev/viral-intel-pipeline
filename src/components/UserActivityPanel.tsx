"use client";

import { useEffect, useState } from "react";
import { Activity, Loader2 } from "lucide-react";

interface Row {
  name: string;
  role: string;
  email: string;
  accountCreated: string;
  lastSignIn: string | null;
  conversations: number;
  lastConversation: string | null;
}

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleString("fr-FR") : "—";

export function UserActivityPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

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
              <th className="px-3 py-2">Conv.</th>
              <th className="px-3 py-2">Dernière conv.</th>
              <th className="px-3 py-2">Compte créé</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.email} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-800">
                  {r.name}
                </td>
                <td className="px-3 py-2 capitalize text-slate-600">
                  {r.role}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {fmt(r.lastSignIn)}
                </td>
                <td className="px-3 py-2 text-slate-600">{r.conversations}</td>
                <td className="px-3 py-2 text-slate-600">
                  {fmt(r.lastConversation)}
                </td>
                <td className="px-3 py-2 text-slate-500">
                  {fmt(r.accountCreated)}
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                  Aucun utilisateur.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        « Dernière connexion » = dernière authentification. La durée précise
        des sessions nécessite un suivi dédié (peut être ajouté).
      </p>
    </div>
  );
}
