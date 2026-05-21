"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { useCallStore } from "@/lib/store";
import { surnameFirst, titleCaseName } from "@/lib/patientMatch";

/**
 * Détecte automatiquement le nom du patient dans la conversation en cours
 * et remplit le champ "Nom". Affiche le nom + bouton "éditer le nom".
 */
export function AutoPatientName() {
  const isRecording = useCallStore((s) => s.isRecording);
  const patientName = useCallStore((s) => s.patientName);
  const setPatientName = useCallStore((s) => s.setPatientName);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(patientName);
  const triedRef = useRef(false);

  // Tente la détection ~ toutes les 30 s tant que le champ est vide.
  useEffect(() => {
    if (!isRecording) {
      triedRef.current = false;
      return;
    }
    const id = setInterval(async () => {
      const st = useCallStore.getState();
      if (st.patientName && st.patientName.trim().length > 1) return;
      const text = st.lines
        .filter((l) => l.isFinal)
        .map((l) => l.text)
        .join(" ");
      if (text.length < 80) return;
      try {
        const r = await fetch("/api/extract-patient-name", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: text }),
        });
        const data = (await r.json()) as { name?: string | null };
        if (data?.name) {
          const cleaned = surnameFirst(titleCaseName(data.name));
          if (cleaned) {
            setPatientName(cleaned);
            triedRef.current = true;
          }
        }
      } catch {
        /* ignore */
      }
    }, 30000);
    return () => clearInterval(id);
  }, [isRecording, setPatientName]);

  if (!isRecording) return null;

  return (
    <div className="flex items-center gap-2 border-b border-slate-100 bg-white/80 px-6 py-1.5 text-xs">
      <span className="text-slate-500">Patient :</span>
      {!editing ? (
        <>
          <span className="font-semibold text-slate-800">
            {patientName || "détection en cours…"}
          </span>
          <button
            onClick={() => {
              setDraft(patientName);
              setEditing(true);
            }}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Pencil className="h-3 w-3" /> Éditer le nom
          </button>
        </>
      ) : (
        <>
          <input
            className="input w-52 py-1 text-xs"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
          />
          <button
            onClick={() => {
              setPatientName(surnameFirst(titleCaseName(draft.trim())));
              setEditing(false);
            }}
            className="rounded-md bg-medical-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-medical-700"
          >
            OK
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded-md border border-slate-300 px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            Annuler
          </button>
        </>
      )}
    </div>
  );
}
