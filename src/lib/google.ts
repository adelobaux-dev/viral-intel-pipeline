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
