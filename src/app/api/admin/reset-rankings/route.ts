import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Remet à zéro le classement de toute l'équipe.
 * Réservé EXCLUSIVEMENT au compte du Dr Delobaux.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const email = (user.email ?? "").toLowerCase();
  if (!email.includes("delobaux")) {
    return NextResponse.json(
      { error: "Action réservée au Dr Delobaux" },
      { status: 403 },
    );
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("performance_tracking")
    .update({
      total_calls: 0,
      average_score: 0,
      conversion_rate: 0,
      updated_at: new Date().toISOString(),
    })
    .neq("user_id", "00000000-0000-0000-0000-000000000000");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
