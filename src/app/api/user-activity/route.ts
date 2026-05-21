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

  // Reconstitution des sessions depuis les "battements" d'activité.
  const sessionsByUser = new Map<
    string,
    { sessions: number; totalMin: number; recent: string[] }
  >();
  try {
    const since = new Date(
      Date.now() - 90 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { data: acts } = await admin
      .from("user_activity")
      .select("user_id, ts")
      .gte("ts", since)
      .order("ts", { ascending: true });

    const byUser = new Map<string, number[]>();
    for (const a of acts ?? []) {
      if (!a.user_id) continue;
      const t = new Date(a.ts as string).getTime();
      byUser.set(a.user_id, [...(byUser.get(a.user_id) ?? []), t]);
    }
    const GAP = 5 * 60 * 1000; // > 5 min sans battement = nouvelle session
    for (const [uid, ts] of Array.from(byUser.entries())) {
      let sessions = 0;
      let totalMs = 0;
      const starts: number[] = [];
      let sStart = 0;
      let prev = 0;
      ts.forEach((t, i) => {
        if (i === 0 || t - prev > GAP) {
          if (i > 0) totalMs += prev - sStart;
          sessions++;
          sStart = t;
          starts.push(t);
        }
        prev = t;
      });
      totalMs += prev - sStart;
      sessionsByUser.set(uid, {
        sessions,
        totalMin: Math.round(totalMs / 60000),
        recent: starts
          .slice(-15)
          .reverse()
          .map((t) => new Date(t).toISOString()),
      });
    }
  } catch {
    /* table user_activity absente : ignorer */
  }

  const rows = (profiles ?? []).map((p) => {
    const mine = (calls ?? []).filter((c) => c.user_id === p.id);
    const last = mine
      .map((c) => c.created_at)
      .sort()
      .at(-1);
    const a = authMap.get(p.id);
    const s = sessionsByUser.get(p.id);
    return {
      name: p.name,
      role: p.role,
      email: p.email,
      accountCreated: a?.created_at ?? p.created_at,
      lastSignIn: a?.last_sign_in_at ?? null,
      conversations: mine.length,
      lastConversation: last ?? null,
      sessions: s?.sessions ?? 0,
      usageMinutes: s?.totalMin ?? 0,
      recentConnections: s?.recent ?? [],
    };
  });

  rows.sort((x, y) =>
    (y.lastSignIn ?? "").localeCompare(x.lastSignIn ?? ""),
  );

  return NextResponse.json({ users: rows });
}
