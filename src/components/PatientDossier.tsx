"use client";

import { useEffect, useState } from "react";
import { FolderOpen, Loader2 } from "lucide-react";
import { useCallStore } from "@/lib/store";

export function PatientDossier() {
  const isRecording = useCallStore((s) => s.isRecording);
  const patientName = useCallStore((s) => s.patientName);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!isRecording || !patientName || patientName.trim().length < 2) {
      setSummary(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/patient-context?name=${encodeURIComponent(patientName)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setSummary(d.found ? d.summary : null);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [isRecording, patientName]);

  if (!isRecording || (!summary && !loading)) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 font-semibold text-amber-900"
      >
        <FolderOpen className="h-4 w-4" />
        Dossier patient partagé (équipe)
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        <span className="text-xs font-normal text-amber-700">
          {open ? "▼" : "▶"}
        </span>
      </button>
      {open && summary && (
        <pre className="mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap text-xs text-amber-900">
          {summary}
        </pre>
      )}
      {open && !summary && !loading && (
        <p className="text-xs text-amber-700">
          Aucun historique pour ce patient.
        </p>
      )}
    </div>
  );
}
