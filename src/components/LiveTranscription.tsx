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
      const connection = deepgram.listen.live({
        model: "nova-2",
        language: "fr",
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

  // Démarre / arrête la capture en fonction de l'état d'appel global.
  useEffect(() => {
    if (isRecording) {
      connect().then(() => recorder.start());
    } else {
      recorder.stop();
      teardown();
      setStatus("idle");
    }
    return () => {
      recorder.stop();
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording]);

  const lines = useCallStore((s) => s.lines);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <div className="card flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-700">
          Transcription en direct
        </h2>
        <StatusBadge status={status} error={recorder.error} />
      </div>

      {(errorMsg || recorder.error) && (
        <div className="flex items-start gap-2 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMsg || recorder.error}</span>
        </div>
      )}

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {lines.length === 0 && (
          <p className="text-sm text-slate-400">
            La transcription apparaîtra ici dès le début de l&apos;appel…
          </p>
        )}
        {lines.map((l) => (
          <div
            key={l.id}
            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              l.speaker === "user"
                ? "ml-auto bg-medical-600 text-white"
                : "bg-slate-100 text-slate-800"
            } ${l.isFinal ? "" : "opacity-60"}`}
          >
            {l.text}
          </div>
        ))}
        <div ref={bottomRef} />
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
