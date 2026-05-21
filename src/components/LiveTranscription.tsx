"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createClient,
  LiveTranscriptionEvents,
  type LiveClient,
} from "@deepgram/sdk";
import { Mic, MicOff, AlertTriangle } from "lucide-react";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useCallStore } from "@/lib/store";

type Status = "idle" | "connecting" | "live" | "reconnecting" | "error";

export function LiveTranscription() {
  const isRecording = useCallStore((s) => s.isRecording);
  const addLine = useCallStore((s) => s.addLine);
  const upsertInterim = useCallStore((s) => s.upsertInterim);

  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const connectionRef = useRef<LiveClient | null>(null);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retriesRef = useRef(0);
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleChunk = useCallback((chunk: Blob) => {
    const conn = connectionRef.current;
    if (conn && conn.getReadyState() === 1) {
      chunk.arrayBuffer().then((buf) => conn.send(buf));
    }
  }, []);

  const recorder = useAudioRecorder({ onChunk: handleChunk });

  const teardown = useCallback(() => {
    if (keepAliveRef.current) clearInterval(keepAliveRef.current);
    keepAliveRef.current = null;
    try {
      connectionRef.current?.requestClose();
    } catch {
      /* noop */
    }
    connectionRef.current = null;
  }, []);

  const connect = useCallback(async () => {
    setStatus("connecting");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/deepgram/token");
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Token Deepgram indisponible");
      }
      const { token } = (await res.json()) as { token: string };

      const deepgram = createClient(token);
      const lang = useCallStore.getState().transcriptionLang;
      const connection = deepgram.listen.live({
        model: "nova-2",
        language: lang === "en" ? "en" : "fr",
        smart_format: true,
        interim_results: true,
        punctuate: true,
        diarize: true,
      });
      connectionRef.current = connection;

      connection.on(LiveTranscriptionEvents.Open, () => {
        retriesRef.current = 0;
        setStatus("live");
        keepAliveRef.current = setInterval(() => {
          try {
            connection.keepAlive();
          } catch {
            /* noop */
          }
        }, 8000);
      });

      connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        const alt = data?.channel?.alternatives?.[0];
        const text: string = alt?.transcript ?? "";
        if (!text.trim()) return;

        const speakerIdx = alt?.words?.[0]?.speaker;
        const speaker =
          speakerIdx === 0 ? "user" : speakerIdx == null ? "unknown" : "patient";

        if (data.is_final) {
          addLine({
            id: crypto.randomUUID(),
            speaker,
            text,
            timestamp: Date.now(),
            isFinal: true,
          });
        } else {
          upsertInterim({
            id: "interim",
            speaker,
            text,
            timestamp: Date.now(),
            isFinal: false,
          });
        }
      });

      connection.on(LiveTranscriptionEvents.Error, (err) => {
        setErrorMsg(
          typeof err?.message === "string" ? err.message : "Erreur Deepgram",
        );
        setStatus("error");
      });

      connection.on(LiveTranscriptionEvents.Close, () => {
        if (keepAliveRef.current) clearInterval(keepAliveRef.current);
        // Reconnexion automatique tant que l'enregistrement est actif.
        if (useCallStore.getState().isRecording && retriesRef.current < 5) {
          retriesRef.current += 1;
          setStatus("reconnecting");
          setTimeout(connect, Math.min(1000 * retriesRef.current, 5000));
        }
      });
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Échec connexion Deepgram",
      );
      setStatus("error");
    }
  }, [addLine, upsertInterim]);

  // Forçage manuel de la transcription (bouton + watchdog).
  function forceRestart() {
    setStatus("reconnecting");
    setErrorMsg(null);
    retriesRef.current = 0;
    recorder.stop();
    teardown();
    connect().then(() => recorder.start());
  }

  // Auto-activation du micro à l'ouverture, par défaut pour TOUS.
  // L'utilisateur peut désactiver via le bouton ci-dessous (localStorage="0").
  useEffect(() => {
    if (
      !isRecording &&
      typeof window !== "undefined" &&
      window.localStorage.getItem("mic.autostart") !== "0" &&
      !recorder.isTesting
    ) {
      recorder.testMic();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Démarre / arrête la capture en fonction de l'état d'appel global.
  useEffect(() => {
    const clearWatchdog = () => {
      if (watchdogRef.current) clearInterval(watchdogRef.current);
      watchdogRef.current = null;
    };

    if (isRecording) {
      // Démarrage agressif : Deepgram + micro EN PARALLÈLE (gain ~1-2 s).
      connect();
      recorder.start();

      // Watchdog rapide : check toutes les 3 s, force restart si après 5 s
      // la connexion n'est pas ouverte ou aucune phrase n'a été transcrite.
      clearWatchdog();
      watchdogRef.current = setInterval(() => {
        const st = useCallStore.getState();
        if (!st.isRecording) return;
        const elapsed = (Date.now() - (st.startedAt ?? Date.now())) / 1000;
        if (elapsed < 5) return;
        const open = connectionRef.current?.getReadyState() === 1;
        const hasLines = st.lines.some((l) => l.isFinal);
        if (!open || !hasLines) {
          setStatus("reconnecting");
          retriesRef.current = 0;
          recorder.stop();
          teardown();
          connect();
          recorder.start();
        }
      }, 3000);
    } else {
      clearWatchdog();
      recorder.stop();
      teardown();
      setStatus("idle");
    }
    return () => {
      clearWatchdog();
      recorder.stop();
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording]);

  const lines = useCallStore((s) => s.lines);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = distance < 60;
    stickToBottomRef.current = near;
    setAtBottom(near);
  }

  function scrollToBottom() {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    stickToBottomRef.current = true;
    setAtBottom(true);
  }

  useEffect(() => {
    // Auto-défilement SEULEMENT si l'utilisateur est déjà en bas :
    // s'il a remonté pour relire, on ne le ramène pas de force.
    const el = scrollRef.current;
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <div className="card flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-700">
          Transcription en direct
        </h2>
        <div className="flex items-center gap-2">
          {(isRecording || recorder.isTesting) && (
            <button
              type="button"
              onClick={forceRestart}
              title="Forcer le redémarrage de la transcription"
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              <Mic className="h-3 w-3" /> Forcer
            </button>
          )}
          <StatusBadge status={status} error={recorder.error} />
        </div>
      </div>

      {(errorMsg || recorder.error) && (
        <div className="flex items-start gap-2 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMsg || recorder.error}</span>
        </div>
      )}

      {!isRecording && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2">
          <select
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-700"
            value={recorder.selectedDeviceId}
            onChange={(e) => recorder.setSelectedDeviceId(e.target.value)}
          >
            <option value="">Microphone par défaut</option>
            {recorder.devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Microphone ${i + 1}`}
              </option>
            ))}
          </select>
          {!recorder.isTesting ? (
            <button
              type="button"
              onClick={recorder.testMic}
              className="inline-flex items-center gap-1.5 rounded-md bg-medical-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-medical-700"
            >
              <Mic className="h-3.5 w-3.5" /> Activer / tester le micro
            </button>
          ) : (
            <button
              type="button"
              onClick={recorder.stopTest}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <MicOff className="h-3.5 w-3.5" /> Arrêter le test
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const off = window.localStorage.getItem("mic.autostart") === "0";
              window.localStorage.setItem("mic.autostart", off ? "1" : "0");
              if (off && !recorder.isTesting) recorder.testMic();
              else if (!off) recorder.stopTest();
            }}
            title="Active/désactive l'auto-démarrage du micro à chaque session"
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            <Mic className="h-3.5 w-3.5" />
            {typeof window !== "undefined" &&
            window.localStorage.getItem("mic.autostart") === "0"
              ? "Activer l'auto-micro"
              : "Auto-micro ON · cliquer pour désactiver"}
          </button>
        </div>
      )}

      {(isRecording || recorder.isTesting) && (
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-2">
          <Mic
            className={`h-4 w-4 shrink-0 ${
              recorder.audioLevel > 4 ? "text-emerald-600" : "text-slate-400"
            }`}
          />
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full transition-[width] duration-100 ${
                recorder.audioLevel > 4 ? "bg-emerald-500" : "bg-slate-300"
              }`}
              style={{ width: `${recorder.audioLevel}%` }}
            />
          </div>
          <span className="w-28 shrink-0 text-right text-xs font-medium text-slate-500">
            {recorder.audioLevel > 4 ? "Voix captée ✓" : "Parlez…"}
          </span>
        </div>
      )}

      <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="absolute inset-0 space-y-2 overflow-y-scroll px-4 py-4"
      >
        {lines.length === 0 && (
          <p className="text-sm text-slate-400">
            La transcription apparaîtra ici dès le début de l&apos;appel…
          </p>
        )}
        {lines.map((l) => {
          const isUser = l.speaker === "user";
          return (
            <div
              key={l.id}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
            >
              <span className="mb-0.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {isUser ? "Vous (closer)" : "Patient"}
              </span>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  isUser
                    ? "bg-medical-600 text-white"
                    : "bg-amber-100 text-amber-900"
                } ${l.isFinal ? "" : "opacity-60"}`}
              >
                {l.text}
              </div>
            </div>
          );
        })}
      </div>
      {!atBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-3 right-3 rounded-full bg-medical-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg hover:bg-medical-700"
        >
          ↓ Revenir en bas
        </button>
      )}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  error,
}: {
  status: Status;
  error: string | null;
}) {
  if (error) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
        <MicOff className="h-3.5 w-3.5" /> Micro
      </span>
    );
  }
  const map: Record<Status, { label: string; cls: string }> = {
    idle: { label: "Inactif", cls: "text-slate-400" },
    connecting: { label: "Connexion…", cls: "text-amber-600" },
    reconnecting: { label: "Reconnexion…", cls: "text-amber-600" },
    live: { label: "En direct", cls: "text-emerald-600" },
    error: { label: "Erreur", cls: "text-red-600" },
  };
  const { label, cls } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cls}`}>
      <Mic className="h-3.5 w-3.5" /> {label}
    </span>
  );
}
