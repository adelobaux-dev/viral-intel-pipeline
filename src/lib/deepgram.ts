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
export async function createEphemeralToken(ttlSeconds = 60): Promise<{
  token: string;
  expiresIn: number;
}> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey || apiKey === "your_deepgram_api_key") {
    throw new Error(
      "DEEPGRAM_API_KEY manquante ou non configurée dans .env.local",
    );
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
    throw new Error(
      `Impossible de créer une clé temporaire Deepgram : ${
        error?.message ??
        "la clé API doit avoir la permission de créer des clés (rôle Owner/Admin)."
      }`,
    );
  }

  return { token: result.key, expiresIn: ttlSeconds };
}
