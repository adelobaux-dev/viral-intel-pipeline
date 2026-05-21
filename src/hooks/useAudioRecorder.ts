"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("");
  /** Niveau sonore du micro, 0 → 100, pour la barre de visualisation. */
  const [audioLevel, setAudioLevel] = useState(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const refreshDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const audios = all.filter((d) => d.kind === "audioinput");
      setDevices(audios);

      // Auto-sélection : si aucun micro choisi, prendre celui le plus utilisé
      // par cet utilisateur (≥ 3 utilisations).
      setSelectedDeviceId((cur) => {
        if (cur) return cur;
        try {
          const usage = JSON.parse(
            window.localStorage.getItem("mic.usage") || "{}",
          ) as Record<string, number>;
          const ranked = Object.entries(usage)
            .filter(([id, c]) => c >= 3 && audios.some((d) => d.deviceId === id))
            .sort((a, b) => b[1] - a[1]);
          return ranked[0]?.[0] ?? "";
        } catch {
          return "";
        }
      });
    } catch {
      /* permissions non accordées : labels vides, on réessaiera */
    }
  }, []);

  const recordSelection = useCallback((id: string) => {
    if (!id || typeof window === "undefined") return;
    try {
      const usage = JSON.parse(
        window.localStorage.getItem("mic.usage") || "{}",
      ) as Record<string, number>;
      usage[id] = (usage[id] ?? 0) + 1;
      window.localStorage.setItem("mic.usage", JSON.stringify(usage));
    } catch {
      /* ignore */
    }
  }, []);

  const selectDevice = useCallback(
    (id: string) => {
      setSelectedDeviceId(id);
      recordSelection(id);
    },
    [recordSelection],
  );

  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  const stopMeter = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stop = useCallback(() => {
    stopMeter();
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    releaseStream();
    setAudioLevel(0);
    setIsRecording(false);
    setIsTesting(false);
  }, [stopMeter, releaseStream]);

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
      setAudioLevel(Math.min(100, Math.round(rms * 280)));
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const getStream = useCallback(async () => {
    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        channelCount: 1,
        ...(selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId } }
          : {}),
      },
    };
    return navigator.mediaDevices.getUserMedia(constraints);
  }, [selectedDeviceId]);

  const handleError = useCallback(
    (err: unknown) => {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError(
          "Accès au micro refusé. Cliquez sur le cadenas dans la barre d'adresse → autoriser le micro, et vérifiez Réglages Système → Confidentialité → Microphone.",
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
    },
    [],
  );

  /** Active le micro et n'affiche QUE le niveau (pas de transcription). */
  const testMic = useCallback(async () => {
    setError(null);
    try {
      const stream = await getStream();
      streamRef.current = stream;
      startMeter(stream);
      setIsTesting(true);
      await refreshDevices(); // labels disponibles après autorisation
    } catch (err) {
      handleError(err);
      stop();
    }
  }, [getStream, startMeter, refreshDevices, handleError, stop]);

  const stopTest = useCallback(() => {
    stopMeter();
    releaseStream();
    setAudioLevel(0);
    setIsTesting(false);
  }, [stopMeter, releaseStream]);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await getStream();
      streamRef.current = stream;

      try {
        startMeter(stream);
        await refreshDevices();
      } catch {
        // visualisation non critique
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
      setIsTesting(false);
      setIsRecording(true);
    } catch (err) {
      handleError(err);
      stop();
    }
  }, [
    getStream,
    startMeter,
    refreshDevices,
    onChunk,
    timeslice,
    stop,
    handleError,
  ]);

  return {
    isRecording,
    isTesting,
    error,
    mimeType,
    audioLevel,
    devices,
    selectedDeviceId,
    setSelectedDeviceId: selectDevice,
    refreshDevices,
    testMic,
    stopTest,
    start,
    stop,
  };
}
