"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, PhoneCall, PhoneOff, Loader2 } from "lucide-react";
import { LiveTranscription } from "@/components/LiveTranscription";
import { RecommendationCards } from "@/components/RecommendationCards";
import { CallFeedbackModal } from "@/components/CallFeedbackModal";
import { useCallStore } from "@/lib/store";
import type { AiFeedback } from "@/lib/types";

export default function LiveCallPage() {
  const {
    isRecording,
    patientName,
    callId,
    setPatientName,
    startCall,
    stopCall,
    lines,
    reset,
  } = useCallStore();

  const [patientEmail, setPatientEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<AiFeedback | null>(null);
  const [integrations, setIntegrations] = useState<Record<
    string,
    string
  > | null>(null);

  async function handleStart() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/calls/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossible de démarrer");
      startCall(data.callId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur démarrage appel");
    } finally {
      setBusy(false);
    }
  }

  async function handleEnd() {
    stopCall();
    setBusy(true);
    setError(null);
    try {
      const transcript = lines
        .filter((l) => l.isFinal)
        .map((l) => `${l.speaker === "user" ? "Closer" : "Patient"}: ${l.text}`)
        .join("\n");

      const res = await fetch("/api/calls/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callId,
          patientName,
          transcript,
          patientEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec finalisation");
      setFeedback(data.feedback);
      setIntegrations(data.integrations ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur finalisation");
    } finally {
      setBusy(false);
    }
  }

  function closeModal() {
    setFeedback(null);
    setIntegrations(null);
    reset();
    setPatientEmail("");
  }

  return (
    <main className="flex h-screen flex-col bg-slate-100">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="text-xs uppercase tracking-widest text-medical-600">
              Cabinet Dr Alexis Delobaux
            </p>
            <h1 className="text-lg font-semibold text-slate-800">
              Conversation en direct
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isRecording ? (
            <>
              <input
                className="input w-44"
                placeholder="Nom du patient"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                disabled={busy}
              />
              <input
                className="input w-52"
                placeholder="Email patient (optionnel)"
                value={patientEmail}
                onChange={(e) => setPatientEmail(e.target.value)}
                disabled={busy}
              />
              <button
                className="btn-primary"
                onClick={handleStart}
                disabled={busy}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PhoneCall className="h-4 w-4" />
                )}
                Démarrer la conversation
              </button>
            </>
          ) : (
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
              onClick={handleEnd}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PhoneOff className="h-4 w-4" />
              )}
              Terminer l&apos;appel
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="bg-red-50 px-6 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LiveTranscription />
        </div>
        <div className="lg:col-span-1">
          <RecommendationCards />
        </div>
      </div>

      {feedback && (
        <CallFeedbackModal
          feedback={feedback}
          integrations={integrations}
          onClose={closeModal}
        />
      )}
    </main>
  );
}
