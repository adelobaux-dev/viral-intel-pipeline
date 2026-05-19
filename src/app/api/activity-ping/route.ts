import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Battement d'activité (l'app est ouverte). Discret, non bloquant. */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false });
    await createAdminClient()
      .from("user_activity")
      .insert({ user_id: user.id });
  } catch {
    /* ne jamais bloquer l'app pour un ping */
  }
  return NextResponse.json({ ok: true });
}
