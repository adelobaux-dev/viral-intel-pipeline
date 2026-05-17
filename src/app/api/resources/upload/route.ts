import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_CHARS_PER_FILE = 20000;

async function extractText(
  name: string,
  type: string,
  buf: Buffer,
): Promise<string> {
  const lower = name.toLowerCase();
  if (
    type.startsWith("text/") ||
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    lower.endsWith(".csv") ||
    lower.endsWith(".json")
  ) {
    return buf.toString("utf-8");
  }
  if (type === "application/pdf" || lower.endsWith(".pdf")) {
    const pdf = (await import("pdf-parse/lib/pdf-parse.js")).default;
    const res = await pdf(buf);
    return res.text;
  }
  return ""; // type non supporté (docx, audio, vidéo… → phase suivante)
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();
  if (profile?.role !== "admin") {
    return NextResponse.json(
      { error: "Réservé aux administrateurs" },
      { status: 403 },
    );
  }

  const form = await request.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "Aucun fichier reçu" }, { status: 400 });
  }

  const imported: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    try {
      const buf = Buffer.from(await file.arrayBuffer());
      const text = (await extractText(file.name, file.type, buf)).trim();
      if (!text) {
        skipped.push(file.name);
        continue;
      }
      const { error } = await supabase.from("closing_resources").insert({
        title: `📄 ${file.name}`,
        content: text.slice(0, MAX_CHARS_PER_FILE),
        kind: "upload",
        created_by: user.id,
      });
      if (error) skipped.push(file.name);
      else imported.push(file.name);
    } catch {
      skipped.push(file.name);
    }
  }

  return NextResponse.json({
    importedCount: imported.length,
    skippedCount: skipped.length,
    imported,
    skipped,
  });
}
