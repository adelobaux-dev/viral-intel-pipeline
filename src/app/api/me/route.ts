import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Profil minimal de l'utilisateur connecté (rôle, nom). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { data } = await supabase
    .from("users")
    .select("role, name")
    .eq("id", user.id)
    .single<{ role: string; name: string }>();

  return NextResponse.json({
    role: data?.role ?? "closer",
    name: data?.name ?? user.email,
    email: user.email,
  });
}
