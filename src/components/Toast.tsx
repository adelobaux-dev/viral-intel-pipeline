"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";

export interface ToastInput {
  /** Clé unique : un toast de même clé n'est montré qu'une fois par session. */
  key: string;
  title: string;
  body?: string;
  href?: string;
  hrefLabel?: string;
  tone?: "info" | "success" | "warn";
}

interface ToastCtx {
  notify: (t: ToastInput) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

const PREF_KEY = "popups.enabled";

export function useToast(): ToastCtx {
  return useContext(Ctx) ?? { notify: () => {} };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<ToastInput[]>([]);
  const [current, setCurrent] = useState<ToastInput | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const enabledRef = useRef(true);

  useEffect(() => {
    enabledRef.current =
      (typeof window !== "undefined" &&
        window.localStorage.getItem(PREF_KEY)) !== "0";
  }, []);

  const notify = useCallback((t: ToastInput) => {
    if (!enabledRef.current) return;
    if (seen.current.has(t.key)) return;
    seen.current.add(t.key);
    setQueue((q) => [...q, t]);
  }, []);

  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0]);
      setQueue((q) => q.slice(1));
    }
  }, [queue, current]);

  useEffect(() => {
    if (!current) return;
    const id = setTimeout(() => setCurrent(null), 6000);
    return () => clearTimeout(id);
  }, [current]);

  const disableAll = () => {
    window.localStorage.setItem(PREF_KEY, "0");
    enabledRef.current = false;
    setQueue([]);
    setCurrent(null);
  };

  const toneCls =
    current?.tone === "success"
      ? "border-emerald-300"
      : current?.tone === "warn"
        ? "border-amber-300"
        : "border-medical-300";

  return (
    <Ctx.Provider value={{ notify }}>
      {children}
      {current && (
        <div className="fixed bottom-4 right-4 z-[100] w-80 animate-[fadeIn_.2s_ease-out]">
          <div
            className={`rounded-xl border bg-white p-4 shadow-xl ${toneCls}`}
          >
            <div className="flex items-start gap-2">
              <Bell className="mt-0.5 h-4 w-4 shrink-0 text-medical-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">
                  {current.title}
                </p>
                {current.body && (
                  <p className="mt-0.5 text-xs text-slate-600">
                    {current.body}
                  </p>
                )}
                {current.href && (
                  <Link
                    href={current.href}
                    onClick={() => setCurrent(null)}
                    className="mt-2 inline-block text-xs font-semibold text-medical-700 hover:underline"
                  >
                    {current.hrefLabel ?? "Ouvrir"} →
                  </Link>
                )}
              </div>
              <button
                onClick={() => setCurrent(null)}
                className="shrink-0 text-slate-300 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={disableAll}
              className="mt-2 text-[10px] text-slate-400 hover:text-slate-600"
            >
              Désactiver les pop-ups
            </button>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
