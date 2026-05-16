"use client";

import { create } from "zustand";
import type { Recommendation, TranscriptLine } from "./types";

interface CallState {
  isRecording: boolean;
  patientName: string;
  callId: string | null;
  startedAt: number | null;
  lines: TranscriptLine[];
  recommendations: Recommendation[];

  setPatientName: (name: string) => void;
  startCall: (callId: string) => void;
  stopCall: () => void;
  addLine: (line: TranscriptLine) => void;
  upsertInterim: (line: TranscriptLine) => void;
  addRecommendation: (rec: Recommendation) => void;
  reset: () => void;
}

const MAX_RECOMMENDATIONS = 6;

export const useCallStore = create<CallState>((set) => ({
  isRecording: false,
  patientName: "",
  callId: null,
  startedAt: null,
  lines: [],
  recommendations: [],

  setPatientName: (name) => set({ patientName: name }),

  startCall: (callId) =>
    set({ isRecording: true, callId, startedAt: Date.now() }),

  stopCall: () => set({ isRecording: false }),

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
