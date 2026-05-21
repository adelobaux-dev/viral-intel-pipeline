"use client";

import { useEffect, useState } from "react";
import { Loader2, Users } from "lucide-react";

interface Row {
  id: string;
  user_email: string | null;
  content: string;
  created_at: string;
}

export function StaffSuggestionsPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/staff-suggestions")
      .then((r) => r.json())
      .then((d) => setRows(d.suggestions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="card p-5">
      <div className="mb-2 flex items-center gap-2">
        <Users className="h-5 w-5 text-medical-600" />
        <h2 className="text-lg font-semibold text-slate-800">
          Recommandations d&apos;évolution (Staff)
        </h2>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          {rows.length}
        </span>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Suggestions envoyées par l&apos;équipe (champ libre + contexte de fin
        d&apos;appel). Visible uniquement par le Dr Delobaux.
      </p>
      <div className="h-72 divide-y divide-slate-100 overflow-y-scroll rounded-lg border border-slate-200 bg-slate-50">
        {!loading && rows.length === 0 && (
          <p className="px-3 py-3 text-sm text-slate-400">
            Aucune suggestion pour l&apos;instant.
          </p>
        )}
        {rows.map((r) => (
          <div key={r.id} className="px-3 py-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>{r.user_email ?? "anonyme"}</span>
              <span>{new Date(r.created_at).toLocaleString("fr-FR")}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
              {r.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
