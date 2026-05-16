"use client";

import { useCallback, useRef, useState } from "react";

interface UseAudioRecorderOptions {
  /** Appelé à chaque chunk audio capturé (à streamer vers Deepgram). */
  onChunk: (chunk: Blob) => void;
  /** Intervalle de découpe du flux en ms (défaut 250). */
  timeslice?: number;
}

/**
 * Capture le micro via MediaRecorder. Choisit un mimeType supporté
 * (Chrome → audio/webm;codecs=opus, Safari → audio/mp4).
 */
function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export function useAudioRecorder({
  onChunk,
  timeslice = 250,
}: UseAudioRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("");
  /** Niveau sonore du micro, 0 → 100, pour la barre de visualisation. */
  const [audioLevel, setAudioLevel] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    recorderRef.current = null;
    streamRef.current = null;
    setAudioLevel(0);
    setIsRecording(false);
  }, []);

  const startMeter = useCallback((stream: MediaStream) => {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    audioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const buffer = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteTimeDomainData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) {
        const v = (buffer[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buffer.length);
      // Amplifié et plafonné pour une barre lisible.
      setAudioLevel(Math.min(100, Math.round(rms * 280)));
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      });
      streamRef.current = stream;

      try {
        startMeter(stream);
      } catch {
        // La visualisation n'est pas critique : on continue sans.
      }

      const type = pickMimeType();
      setMimeType(type);
      const recorder = new MediaRecorder(
        stream,
        type ? { mimeType: type } : undefined,
      );

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) onChunk(e.data);
      };
      recorder.onerror = () => {
        setError("Erreur d'enregistrement audio.");
        stop();
      };

      recorder.start(timeslice);
      recorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError(
          "Accès au micro refusé. Autorisez le microphone dans les réglages du navigateur.",
        );
      } else if (
        err instanceof DOMException &&
        err.name === "NotFoundError"
      ) {
        setError("Aucun microphone détecté.");
      } else {
        setError(
          err instanceof Error ? err.message : "Impossible d'accéder au micro.",
        );
      }
      stop();
    }
  }, [onChunk, timeslice, stop, startMeter]);

  return { isRecording, error, mimeType, audioLevel, start, stop };
}
