import { createClient } from "@deepgram/sdk";

/**
 * Génère un token Deepgram temporaire (à courte durée de vie) afin que le
 * navigateur puisse ouvrir la connexion WebSocket sans exposer la clé maître.
 *
 * Utilise l'endpoint "grant token" de Deepgram (jeton éphémère). En cas
 * d'indisponibilité de cet endpoint, on retombe sur la création d'une clé
 * projet temporaire via l'API de management.
 */
export async function createEphemeralToken(ttlSeconds = 30): Promise<{
  token: string;
  expiresIn: number;
}> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) throw new Error("DEEPGRAM_API_KEY manquante");

  // Voie privilégiée : jeton éphémère court (auth/grant).
  try {
    const res = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl_seconds: ttlSeconds }),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        access_token: string;
        expires_in: number;
      };
      return { token: data.access_token, expiresIn: data.expires_in };
    }
  } catch {
    // bascule sur la création de clé projet
  }

  // Repli : clé projet temporaire scoppée en lecture/usage.
  const deepgram = createClient(apiKey);
  const projectsResp = await deepgram.manage.getProjects();
  const projectId = projectsResp.result?.projects?.[0]?.project_id;
  if (!projectId) throw new Error("Aucun projet Deepgram disponible");

  const { result, error } = await deepgram.manage.createProjectKey(projectId, {
    comment: `closing-app ephemeral ${new Date().toISOString()}`,
    scopes: ["usage:write"],
    time_to_live_in_seconds: ttlSeconds,
  });
  if (error || !result) throw new Error("Échec création clé Deepgram");

  return { token: result.key, expiresIn: ttlSeconds };
}
