"use client";

import { useState } from "react";
import { Lightbulb, Loader2 } from "lucide-react";

export function StaffSuggestionsForm() {
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/improvement-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Échec");
      setMsg("Merci, suggestion envoyée ✓");
      setContent("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Échec");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-2 flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-medical-600" />
        <h2 className="text-lg font-semibold text-slate-800">
          Suggestions d&apos;amélioration
        </h2>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Une idée, un bug, un manque ? Partage tes suggestions pour améliorer
        l&apos;application — elles sont transmises au Dr Delobaux.
      </p>
      <form onSubmit={submit} className="space-y-2">
        <textarea
          className="input min-h-[100px]"
          placeholder="Décris ton idée d'amélioration (formulation libre)…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div className="flex items-center justify-between gap-2">
          {msg && (
            <p className="text-xs font-medium text-emerald-600">{msg}</p>
          )}
          <button
            type="submit"
            disabled={busy || !content.trim()}
            className="btn-primary text-xs"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lightbulb className="h-4 w-4" />
            )}
            Envoyer
          </button>
        </div>
      </form>
    </div>
  );
}
