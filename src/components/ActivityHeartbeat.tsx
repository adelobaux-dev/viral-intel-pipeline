"use client";

import { useEffect } from "react";

/**
 * Envoie un "battement" toutes les 60 s tant que l'app est ouverte
 * (et au chargement). Sert à reconstituer connexions & temps d'usage.
 */
export function ActivityHeartbeat() {
  useEffect(() => {
    const ping = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/activity-ping", { method: "POST", keepalive: true }).catch(
        () => {},
      );
    };
    ping();
    const id = setInterval(ping, 60000);
    document.addEventListener("visibilitychange", ping);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", ping);
    };
  }, []);

  return null;
}
