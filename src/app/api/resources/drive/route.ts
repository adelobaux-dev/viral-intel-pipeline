import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clearDriveCache, getDriveKnowledge } from "@/lib/google";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Rafraîchit et renvoie l'état du dossier Google Drive (admin).
 * Force un re-scan immédiat (sans attendre le cache de 5 min).
 */
export async function GET() {
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

  clearDriveCache();
  const drive = await getDriveKnowledge(true);
  return NextResponse.json({
    connected: !drive.error,
    error: drive.error ?? null,
    count: drive.docs.length,
    docs: drive.docs.map((d) => d.title),
  });
}
