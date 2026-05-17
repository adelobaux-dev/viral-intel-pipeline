"use client";

import { useEffect, useRef, useState } from "react";

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

  return (
    <>
      <input
        className="input w-52"
        placeholder="Nom du patient (recherche)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        list="patient-suggestions"
        autoComplete="off"
      />
      <datalist id="patient-suggestions">
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  );
}
