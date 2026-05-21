"use client";

import { create } from "zustand";
import type {
  ConsultationMode,
  ConsultationType,
  Recommendation,
  TranscriptLine,
} from "./types";

interface CallState {
  isRecording: boolean;
  patientName: string;
  consultationType: ConsultationType;
  transcriptionLang: "fr" | "en";
  callId: string | null;
  startedAt: number | null;
  mode: ConsultationMode;
  lines: TranscriptLine[];
  recommendations: Recommendation[];

  setMode: (mode: ConsultationMode) => void;
  setConsultationType: (t: ConsultationType) => void;
  setTranscriptionLang: (l: "fr" | "en") => void;
  setPatientName: (name: string) => void;
  startCall: (callId: string) => void;
  stopCall: () => void;
  addLine: (line: TranscriptLine) => void;
  upsertInterim: (line: TranscriptLine) => void;
  addRecommendation: (rec: Recommendation) => void;
  clearConversation: () => void;
  reset: () => void;
}

const MAX_RECOMMENDATIONS = 40;

const MODE_KEY = "cares.lastMode";
export function loadMode(): ConsultationMode {
  if (typeof window === "undefined") return "closeuse";
  const v = window.localStorage.getItem(MODE_KEY) as ConsultationMode | null;
  return v === "secretaire" ||
    v === "chirurgien" ||
    v === "closeuse" ||
    v === "ide"
    ? v
    : "closeuse";
}

export const useCallStore = create<CallState>((set) => ({
  isRecording: false,
  patientName: "",
  callId: null,
  startedAt: null,
  mode: "closeuse",
  consultationType: "primo",
  transcriptionLang: "fr",
  lines: [],
  recommendations: [],

  setConsultationType: (consultationType) => set({ consultationType }),
  setTranscriptionLang: (transcriptionLang) => set({ transcriptionLang }),

  setMode: (mode) => {
    if (typeof window !== "undefined")
      window.localStorage.setItem(MODE_KEY, mode);
    set({ mode });
  },

  setPatientName: (name) => set({ patientName: name }),

  startCall: (callId) =>
    set({ isRecording: true, callId, startedAt: Date.now() }),

  stopCall: () => set({ isRecording: false }),

  clearConversation: () =>
    set({ isRecording: false, lines: [], recommendations: [] }),

  addLine: (line) =>
    set((s) => ({
      lines: [...s.lines.filter((l) => l.isFinal || l.id !== line.id), line],
    })),

  upsertInterim: (line) =>
    set((s) => {
      const withoutInterim = s.lines.filter((l) => l.isFinal);
      return { lines: [...withoutInterim, line] };
    }),

  addRecommendation: (rec) =>
    set((s) => ({
      recommendations: [rec, ...s.recommendations].slice(
        0,
        MAX_RECOMMENDATIONS,
      ),
    })),

  reset: () =>
    set({
      isRecording: false,
      patientName: "",
      callId: null,
      startedAt: null,
      lines: [],
      recommendations: [],
    }),
}));
