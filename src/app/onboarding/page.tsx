"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";
import { PERSONALITY_QUESTIONS } from "@/lib/personality";

export default function OnboardingPage() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const total = PERSONALITY_QUESTIONS.length;
  // Une réponse est valide si non vide et si elle respecte la longueur minimum
  // requise (questions ouvertes). MCQ : juste non vide.
  const validCount = PERSONALITY_QUESTIONS.filter((q) => {
    const a = (answers[q.id] ?? "").trim();
    if (!a) return false;
    if (q.kind === "open") return a.length >= (q.minLength ?? 30);
    return true;
  }).length;
  const allValid = validCount === total;

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec");
      setAnalysis(data.analysis);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec");
    } finally {
      setLoading(false);
    }
  }

  if (analysis) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-10">
        <div className="mx-auto max-w-2xl">
          <div className="card p-6">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-medical-600" />
              <h1 className="text-xl font-bold text-slate-800">
                Ton profil de communication
              </h1>
            </div>
            <div className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
              {analysis}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Ce profil personnalise désormais tes conseils en direct et tes
              feedbacks de fin de conversation.
            </p>
            <Link href="/dashboard" className="btn-primary mt-4">
              Aller au dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-medical-600">
            Cabinet Dr Alexis Delobaux
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-800">
            Profil de communication approfondi
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Inspiré de Kahler (Process Comm), Kahneman (biais),
            Joule &amp; Beauvois (engagement), Comm Colors / DISC.
            <br />
            ~7-10 minutes — les questions ouvertes sont
            <strong> obligatoires</strong> et confidentielles.
          </p>
        </div>

        <div className="space-y-4">
          {PERSONALITY_QUESTIONS.map((q, i) => {
            const a = (answers[q.id] ?? "").trim();
            const minLen = q.minLength ?? 30;
            const tooShort = q.kind === "open" && a.length > 0 && a.length < minLen;
            return (
              <div key={q.id} className="card p-4">
                <p className="mb-1 text-sm font-semibold text-slate-800">
                  {i + 1}. {q.question}
                </p>
                {q.helper && (
                  <p className="mb-3 text-xs text-slate-500">{q.helper}</p>
                )}
                {q.kind === "mc" ? (
                  <div className="space-y-2">
                    {(q.options ?? []).map((opt) => (
                      <label
                        key={opt}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                          answers[q.id] === opt
                            ? "border-medical-500 bg-medical-50"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name={q.id}
                          checked={answers[q.id] === opt}
                          onChange={() =>
                            setAnswers((x) => ({ ...x, [q.id]: opt }))
                          }
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                ) : (
                  <>
                    <textarea
                      className="input min-h-[100px]"
                      placeholder={`Réponse obligatoire (${minLen} caractères minimum)`}
                      value={answers[q.id] ?? ""}
                      onChange={(e) =>
                        setAnswers((x) => ({ ...x, [q.id]: e.target.value }))
                      }
                    />
                    <p
                      className={`mt-1 text-xs ${
                        tooShort
                          ? "text-amber-600"
                          : a.length >= minLen
                            ? "text-emerald-600"
                            : "text-slate-400"
                      }`}
                    >
                      {a.length}/{minLen} caractères
                      {tooShort && " — un peu plus de détail aide l'analyse"}
                    </p>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="sticky bottom-4 mt-6 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
          <span className="text-sm text-slate-500">
            {validCount}/{total} validé(s)
          </span>
          <button
            onClick={submit}
            disabled={loading || !allValid}
            className="btn-primary"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Générer mon profil
          </button>
        </div>
      </div>
    </main>
  );
}
