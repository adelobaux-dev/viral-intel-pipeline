export type UserRole = "admin" | "closer" | "ide" | "doctor";

export type ConsultationMode =
  | "secretaire"
  | "chirurgien"
  | "closeuse"
  | "ide";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  created_at: string;
}

export interface CallRecord {
  id: string;
  user_id: string;
  patient_name: string | null;
  start_time: string;
  end_time: string | null;
  transcript: string | null;
  score: number | null;
  ai_feedback: AiFeedback | null;
  created_at: string;
}

export interface PerformanceTracking {
  id: string;
  user_id: string;
  total_calls: number;
  average_score: number;
  conversion_rate: number;
  updated_at: string;
}

export interface AiFeedback {
  score: number;
  strengths: string[];
  improvements: string[];
  cares_breakdown: Record<CaresStep, number>;
  patient_summary: PatientSummary;
}

export interface PatientSummary {
  motif: string;
  taille_poids: string;
  budget: string;
  notes: string;
}

export type CaresStep =
  | "connecter"
  | "analyser"
  | "rassurer"
  | "engager"
  | "securiser";

export interface TranscriptLine {
  id: string;
  speaker: "user" | "patient" | "unknown";
  text: string;
  timestamp: number;
  isFinal: boolean;
}

export interface Recommendation {
  id: string;
  step: CaresStep;
  message: string;
  /** Degré d'importance du conseil, 1 → 10. */
  importance: number;
  /** Estimation live de la qualité globale du closing, 0 → 10. */
  closingScore: number;
  createdAt: number;
}
