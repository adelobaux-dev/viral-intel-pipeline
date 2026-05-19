import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Rapport d'utilisation par utilisateur. Réservé au Dr Delobaux. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = (user?.email ?? "").toLowerCase();
  if (!email.includes("delobaux")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: profiles } = await admin
    .from("users")
    .select("id, name, role, email, created_at");

  // Dernière connexion via Supabase Auth
  const authMap = new Map<
    string,
    { last_sign_in_at: string | null; created_at: string }
  >();
  try {
    const { data: authList } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    for (const u of authList?.users ?? []) {
      authMap.set(u.id, {
        last_sign_in_at: u.last_sign_in_at ?? null,
        created_at: u.created_at,
      });
    }
  } catch {
    /* ignore */
  }

  const { data: calls } = await admin
    .from("calls")
    .select("user_id, created_at")
    .is("deleted_at", null);

  const rows = (profiles ?? []).map((p) => {
    const mine = (calls ?? []).filter((c) => c.user_id === p.id);
    const last = mine
      .map((c) => c.created_at)
      .sort()
      .at(-1);
    const a = authMap.get(p.id);
    return {
      name: p.name,
      role: p.role,
      email: p.email,
      accountCreated: a?.created_at ?? p.created_at,
      lastSignIn: a?.last_sign_in_at ?? null,
      conversations: mine.length,
      lastConversation: last ?? null,
    };
  });

  rows.sort((x, y) =>
    (y.lastSignIn ?? "").localeCompare(x.lastSignIn ?? ""),
  );

  return NextResponse.json({ users: rows });
}
