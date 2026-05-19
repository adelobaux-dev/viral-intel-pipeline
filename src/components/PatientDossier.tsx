"use client";

import { useEffect, useState } from "react";
import { FolderOpen, Loader2 } from "lucide-react";
import { useCallStore } from "@/lib/store";

interface Entry {
  date: string;
  score: number | null;
  patient_summary: {
    motif: string;
    taille_poids: string;
    budget: string;
    notes: string;
  };
}

export function PatientDossier() {
  const patientName = useCallStore((s) => s.patientName);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [found, setFound] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const name = patientName?.trim() ?? "";
    if (name.length < 2) {
      setFound(null);
      setEntries([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/patient-context?name=${encodeURIComponent(name)}`)
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          setFound(!!d.found);
          setEntries(d.found ? (d.entries ?? []) : []);
        })
        .catch(() => {})
        .finally(() => !cancelled && setLoading(false));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [patientName]);

  if (found === null && !loading) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 font-semibold text-amber-900"
      >
        <FolderOpen className="h-4 w-4" />
        Dossier patient partagé — historique des conversations
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {found && (
          <span className="rounded-full bg-amber-200 px-1.5 text-xs">
            {entries.length}
          </span>
        )}
        <span className="text-xs font-normal text-amber-700">
          {open ? "▼" : "▶"}
        </span>
      </button>

      {open && found && (
        <div className="mt-1 max-h-40 space-y-1 overflow-y-auto pr-1">
          {entries.map((e, i) => (
            <div
              key={i}
              className="rounded-md bg-white/70 px-3 py-1.5 text-xs text-amber-900"
            >
              <div className="font-semibold">
                {new Date(e.date).toLocaleString("fr-FR")} · score{" "}
                {e.score ?? "?"}/10
              </div>
              <div>
                Motif : {e.patient_summary?.motif || "—"} | Taille/Poids :{" "}
                {e.patient_summary?.taille_poids || "—"} | Budget :{" "}
                {e.patient_summary?.budget || "—"}
              </div>
              {e.patient_summary?.notes && (
                <div className="text-amber-800">
                  Notes : {e.patient_summary.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {open && found === false && !loading && (
        <p className="text-xs text-amber-700">
          Aucune conversation précédente trouvée pour ce patient (recherche
          tolérante aux fautes de frappe).
        </p>
      )}
    </div>
  );
}
