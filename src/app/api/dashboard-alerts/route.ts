import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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
  const isAdmin = profile?.role === "admin";
  const admin = createAdminClient();

  let hasProfile = true;
  try {
    const { data } = await admin
      .from("user_profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    hasProfile = !!data;
  } catch {
    hasProfile = true;
  }

  // Conversations "fragiles" d'hier (score 3 → 6)
  const start = new Date();
  start.setDate(start.getDate() - 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(0, 0, 0, 0);

  let fragileYesterday = 0;
  try {
    let q = admin
      .from("calls")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .gte("score", 3)
      .lte("score", 6);
    if (!isAdmin) q = q.eq("user_id", user.id);
    const { count } = await q;
    fragileYesterday = count ?? 0;
  } catch {
    fragileYesterday = 0;
  }

  // Nouvelle reco d'évolution (<48 h) — admin uniquement
  let newReco = false;
  if (isAdmin) {
    try {
      const { data } = await admin
        .from("app_recommendations")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ created_at: string }>();
      newReco =
        !!data &&
        Date.now() - new Date(data.created_at).getTime() <
          48 * 60 * 60 * 1000;
    } catch {
      newReco = false;
    }
  }

  return NextResponse.json({ hasProfile, fragileYesterday, newReco });
}
