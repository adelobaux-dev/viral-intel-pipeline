"use client";

import { useEffect, useRef } from "react";
import { useCallStore } from "@/lib/store";

/**
 * Moteur de transcription de SECOURS via Web Speech API (Chrome/Edge/Safari).
 * - active="test" : démarre IMMÉDIATEMENT (dès le test micro).
 * - active="recording" : démarre après ~6 s si Deepgram n'a rien sorti.
 */
type Active = "off" | "test" | "recording";
type SpeechCtor = new () => SpeechRecognitionLike;
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: unknown) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function WebSpeechFallback({ active }: { active: Active }) {
  const addLine = useCallStore((s) => s.addLine);
  const upsertInterim = useCallStore((s) => s.upsertInterim);
  const recoRef = useRef<SpeechRecognitionLike | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (active === "off") {
      try {
        recoRef.current?.stop();
      } catch {
        /* noop */
      }
      recoRef.current = null;
      startedRef.current = false;
      return;
    }

    const w = window as unknown as {
      SpeechRecognition?: SpeechCtor;
      webkitSpeechRecognition?: SpeechCtor;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;

    const fire = () => {
      if (startedRef.current) return;
      const st = useCallStore.getState();
      if (active === "recording" && st.lines.some((l) => l.isFinal)) return;
      startedRef.current = true;
      const r = new Ctor();
      r.continuous = true;
      r.interimResults = true;
      r.lang = st.transcriptionLang === "en" ? "en-US" : "fr-FR";
      r.onresult = (e: unknown) => {
        const ev = e as {
          results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
          resultIndex: number;
        };
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const res = ev.results[i];
          const text = res[0]?.transcript?.trim();
          if (!text) continue;
          if (res.isFinal) {
            addLine({
              id: crypto.randomUUID(),
              speaker: "patient",
              text,
              timestamp: Date.now(),
              isFinal: true,
            });
          } else {
            upsertInterim({
              id: "interim",
              speaker: "patient",
              text,
              timestamp: Date.now(),
              isFinal: false,
            });
          }
        }
      };
      r.onerror = () => {
        /* on relance via onend */
      };
      r.onend = () => {
        const a = (window as unknown as { __webspeech_active?: Active })
          .__webspeech_active;
        if (a !== "off") {
          try {
            r.start();
          } catch {
            /* noop */
          }
        }
      };
      try {
        r.start();
        recoRef.current = r;
      } catch {
        startedRef.current = false;
      }
    };

    (window as unknown as { __webspeech_active?: Active }).__webspeech_active =
      active;

    const delay = active === "test" ? 0 : 6000;
    const timer = setTimeout(fire, delay);
    return () => {
      clearTimeout(timer);
      (
        window as unknown as { __webspeech_active?: Active }
      ).__webspeech_active = "off";
      try {
        recoRef.current?.stop();
      } catch {
        /* noop */
      }
      recoRef.current = null;
      startedRef.current = false;
    };
  }, [active, addLine, upsertInterim]);

  return null;
}
