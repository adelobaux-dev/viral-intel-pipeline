import { google } from "googleapis";

function oauthClient() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return client;
}

/**
 * Archive un fichier texte (transcription + analyse) dans le dossier
 * Google Drive du cabinet.
 */
export async function uploadTranscriptToDrive(params: {
  fileName: string;
  content: string;
}): Promise<{ fileId: string; webViewLink: string | null }> {
  const drive = google.drive({ version: "v3", auth: oauthClient() });
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  const res = await drive.files.create({
    requestBody: {
      name: params.fileName,
      mimeType: "text/plain",
      ...(folderId ? { parents: [folderId] } : {}),
    },
    media: { mimeType: "text/plain", body: params.content },
    fields: "id, webViewLink",
  });

  return {
    fileId: res.data.id ?? "",
    webViewLink: res.data.webViewLink ?? null,
  };
}

function buildRawEmail(to: string, subject: string, body: string): string {
  const from = process.env.GMAIL_SENDER_ADDRESS || "cabinet@exemple.com";
  const subjectEncoded = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subjectEncoded}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    body,
  ].join("\r\n");

  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Envoie un email récapitulatif au patient (livrets explicatifs) via Gmail.
 */
export async function sendPatientEmail(params: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ id: string }> {
  const gmail = google.gmail({ version: "v1", auth: oauthClient() });
  const raw = buildRawEmail(params.to, params.subject, params.body);
  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
  return { id: res.data.id ?? "" };
}

// ---------------------------------------------------------------------------
// Lecture des ressources de closing depuis Google Drive
// ---------------------------------------------------------------------------

export interface DriveKnowledge {
  text: string;
  docs: { title: string }[];
  error?: string;
}

let _driveCache: { at: number; data: DriveKnowledge } | null = null;
const DRIVE_TTL_MS = 5 * 60 * 1000; // 5 min : mise à jour automatique

function isConfigured(): boolean {
  const id = process.env.GOOGLE_CLIENT_ID;
  const folder = process.env.GOOGLE_DRIVE_FOLDER_ID;
  return (
    !!id &&
    !id.startsWith("your_") &&
    !!folder &&
    !folder.startsWith("your_")
  );
}

type DriveClient = ReturnType<typeof google.drive>;

async function readFolder(
  drive: DriveClient,
  folderId: string,
  depth: number,
  out: { title: string; content: string }[],
): Promise<void> {
  if (depth > 3) return; // garde-fou anti-boucle
  const list = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType)",
    pageSize: 200,
  });

  for (const f of list.data.files ?? []) {
    if (!f.id || !f.name) continue;
    try {
      if (f.mimeType === "application/vnd.google-apps.folder") {
        // Sous-dossiers lus automatiquement : tu peux en ajouter quand tu veux.
        await readFolder(drive, f.id, depth + 1, out);
      } else if (f.mimeType === "application/vnd.google-apps.document") {
        const r = await drive.files.export({
          fileId: f.id,
          mimeType: "text/plain",
        });
        out.push({ title: f.name, content: String(r.data ?? "") });
      } else if (
        f.mimeType?.startsWith("text/") ||
        f.mimeType === "application/json"
      ) {
        const r = await drive.files.get({
          fileId: f.id,
          alt: "media",
        });
        out.push({ title: f.name, content: String(r.data ?? "") });
      }
      // PDF / Word / audio / vidéo : ignorés ici (phase suivante).
    } catch {
      // un fichier illisible ne doit pas casser toute la synchro
    }
  }
}

/**
 * Récupère le contenu texte du/des dossier(s) Drive du cabinet.
 * Plusieurs dossiers possibles : GOOGLE_DRIVE_FOLDER_ID séparés par virgule.
 * Résultat mis en cache 5 min → l'app se met à jour automatiquement quand
 * tu ajoutes/modifies des documents dans le Drive.
 */
export async function getDriveKnowledge(
  force = false,
): Promise<DriveKnowledge> {
  if (!isConfigured()) {
    return { text: "", docs: [], error: "Google Drive non configuré" };
  }
  if (
    !force &&
    _driveCache &&
    Date.now() - _driveCache.at < DRIVE_TTL_MS
  ) {
    return _driveCache.data;
  }

  try {
    const drive = google.drive({ version: "v3", auth: oauthClient() });
    const folderIds = (process.env.GOOGLE_DRIVE_FOLDER_ID || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const collected: { title: string; content: string }[] = [];
    for (const fid of folderIds) {
      await readFolder(drive, fid, 0, collected);
    }

    const text = collected
      .filter((d) => d.content.trim())
      .map((d) => `### ${d.title}\n${d.content.trim()}`)
      .join("\n\n")
      .slice(0, 12000);

    const data: DriveKnowledge = {
      text,
      docs: collected.map((d) => ({ title: d.title })),
    };
    _driveCache = { at: Date.now(), data };
    return data;
  } catch (err) {
    return {
      text: "",
      docs: [],
      error:
        err instanceof Error ? err.message : "Erreur lecture Google Drive",
    };
  }
}

/** Force la prochaine lecture à re-scanner le Drive (bouton "Rafraîchir"). */
export function clearDriveCache(): void {
  _driveCache = null;
}

