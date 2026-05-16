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

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const stop = useCallback(() => {
    recorderRef.current?.state !== "inactive" && recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    recorderRef.current = null;
    streamRef.current = null;
    setIsRecording(false);
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
  }, [onChunk, timeslice, stop]);

  return { isRecording, error, mimeType, start, stop };
}
