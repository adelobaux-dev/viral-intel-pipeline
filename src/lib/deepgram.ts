import { createClient } from "@deepgram/sdk";

/**
 * Génère une clé Deepgram temporaire (courte durée de vie) afin que le
 * navigateur puisse ouvrir la connexion WebSocket sans exposer la clé
 * maître.
 *
 * Le SDK Deepgram côté navigateur (`createClient(token)`) s'authentifie en
 * mode "API key". On crée donc une **clé projet temporaire** scoppée sur
 * l'usage, et non un jeton Bearer (non supporté par cette version du SDK).
 */

// Cache module-level : Deepgram limite la création de clés à ~50/min ;
// les reconnexions WebSocket + watchdog côté client appellent cet endpoint
// très fréquemment. On réutilise donc la même clé tant qu'elle n'expire
// pas dans les 2 prochaines minutes.
type CachedToken = {
  token: string;
  expiresAt: number; // epoch ms
};
let cached: CachedToken | null = null;
const REFRESH_BUFFER_MS = 120_000;

export async function createEphemeralToken(ttlSeconds = 3600): Promise<{
  token: string;
  expiresIn: number;
}> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey || apiKey === "your_deepgram_api_key") {
    throw new Error(
      "DEEPGRAM_API_KEY manquante ou non configurée dans .env.local",
    );
  }

  const now = Date.now();
  if (cached && cached.expiresAt - REFRESH_BUFFER_MS > now) {
    return {
      token: cached.token,
      expiresIn: Math.floor((cached.expiresAt - now) / 1000),
    };
  }

  const deepgram = createClient(apiKey);

  const projectsResp = await deepgram.manage.getProjects();
  if (projectsResp.error) {
    throw new Error(
      `Clé Deepgram invalide ou sans accès projet : ${projectsResp.error.message}`,
    );
  }
  const projectId = projectsResp.result?.projects?.[0]?.project_id;
  if (!projectId) {
    throw new Error("Aucun projet Deepgram associé à cette clé.");
  }

  const { result, error } = await deepgram.manage.createProjectKey(projectId, {
    comment: `closing-app ephemeral ${new Date().toISOString()}`,
    scopes: ["usage:write"],
    time_to_live_in_seconds: ttlSeconds,
  });

  if (error || !result?.key) {
    // Si on a une clé encore valide en cache (même hors fenêtre de buffer),
    // on la renvoie plutôt que de remonter le rate-limit à l'utilisateur.
    if (cached && cached.expiresAt > now + 30_000) {
      return {
        token: cached.token,
        expiresIn: Math.floor((cached.expiresAt - now) / 1000),
      };
    }
    throw new Error(
      `Impossible de créer une clé temporaire Deepgram : ${
        error?.message ??
        "la clé API doit avoir la permission de créer des clés (rôle Owner/Admin)."
      }`,
    );
  }

  cached = {
    token: result.key,
    expiresAt: now + ttlSeconds * 1000,
  };

  return { token: result.key, expiresIn: ttlSeconds };
}
