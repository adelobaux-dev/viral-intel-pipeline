"use client";

import { useEffect } from "react";

const IGNORE = [
  "Script error.",
  "ResizeObserver loop",
  "Non-Error promise rejection captured",
];

export function ErrorReporter() {
  useEffect(() => {
    const sent = new Set<string>();

    const report = (message: string, detail?: string) => {
      const msg = (message || "").trim();
      if (!msg || IGNORE.some((x) => msg.includes(x))) return;
      const key = msg.slice(0, 120);
      if (sent.has(key)) return; // anti-spam : 1 fois par message
      sent.add(key);
      try {
        fetch("/api/errors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: msg,
            detail,
            path:
              typeof window !== "undefined"
                ? window.location.pathname
                : undefined,
          }),
          keepalive: true,
        }).catch(() => {});
      } catch {
        /* ne jamais casser l'app à cause du reporting */
      }
    };

    const onError = (e: ErrorEvent) => {
      report(e.message, e.error?.stack || `${e.filename}:${e.lineno}`);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      report(
        r?.message || String(r) || "Promesse rejetée",
        r?.stack || undefined,
      );
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
