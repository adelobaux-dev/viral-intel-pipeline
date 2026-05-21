import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Liste des suggestions / contextes d'amélioration (Dr Delobaux uniquement). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = (user?.email ?? "").toLowerCase();
  if (!email.includes("delobaux")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  try {
    const { data } = await createAdminClient()
      .from("improvement_context")
      .select("id, user_email, content, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    return NextResponse.json({ suggestions: data ?? [] });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
