import { createClient } from "@deepgram/sdk";

/**
 * Génère un JWT Deepgram court-vivant via l'endpoint officiel
 * `POST /v1/auth/grant`. Ce JWT s'envoie au navigateur, qui ouvre
 * ensuite la WebSocket avec le sous-protocole `["bearer", <token>]`.
 *
 * Avantages par rapport à la création d'une "project key" :
 *   - PAS le même rate limit (createProjectKey ~50/min sur l'API
 *     management ; grantToken est conçu pour l'auth navigateur).
 *   - Fonctionne avec une clé `Member` (pas besoin d'Owner/Admin).
 *   - Le JWT expire vraiment (30 s par défaut) → pas de fuite durable.
 */

type CachedToken = {
  token: string;
  expiresAt: number; // epoch ms
};
// Cache module-level : on évite de re-frapper l'endpoint grant si on
// a déjà un token valide pour plusieurs secondes (utile en cas de
// reconnect rapide). Le JWT dure ~30 s, on garde 5 s de marge.
let cached: CachedToken | null = null;
const REFRESH_BUFFER_MS = 5_000;

export async function createEphemeralToken(): Promise<{
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
  const { result, error } = await deepgram.auth.grantToken();

  if (error || !result?.access_token) {
    if (cached && cached.expiresAt > now + 1_000) {
      return {
        token: cached.token,
        expiresIn: Math.floor((cached.expiresAt - now) / 1000),
      };
    }
    throw new Error(
      `Impossible d'obtenir un jeton Deepgram : ${
        error?.message ?? "réponse vide de /auth/grant."
      }`,
    );
  }

  cached = {
    token: result.access_token,
    expiresAt: now + result.expires_in * 1000,
  };

  return { token: result.access_token, expiresIn: result.expires_in };
}
