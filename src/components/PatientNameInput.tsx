"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { surnameFirst, titleCaseName } from "@/lib/patientMatch";

export function PatientNameInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      fetch(`/api/patient-names?q=${encodeURIComponent(value || "")}`)
        .then((r) => r.json())
        .then((d) => setSuggestions(d.suggestions ?? []))
        .catch(() => {});
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value]);

  // Affichage "NOM Prénom" + dédoublonnage + tri alpha (nom d'abord).
  const formatted = useMemo(() => {
    const seen = new Set<string>();
    return suggestions
      .map((s) => surnameFirst(s))
      .filter((s) => {
        const k = s.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => a.localeCompare(b, "fr"));
  }, [suggestions]);

  return (
    <>
      <input
        className="input w-56"
        placeholder="Nom Prénom du patient"
        value={value}
        onChange={(e) => onChange(titleCaseName(e.target.value))}
        onBlur={(e) => onChange(surnameFirst(e.target.value))}
        disabled={disabled}
        list="patient-suggestions"
        autoComplete="off"
      />
      <datalist id="patient-suggestions">
        {formatted.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  );
}
