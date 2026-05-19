import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { durationSeconds } from "@/lib/format";

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
  if (profile?.role !== "admin") {
    return NextResponse.json(
      { error: "Réservé aux administrateurs" },
      { status: 403 },
    );
  }

  const admin = createAdminClient();
  const { data: users } = await admin.from("users").select("id, name");
  const nameById = new Map((users ?? []).map((u) => [u.id, u.name]));

  const { data: calls } = await admin
    .from("calls")
    .select("user_id, patient_name, start_time, end_time, score, created_at")
    .is("deleted_at", null)
    .not("score", "is", null)
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = (calls ?? []).map((c) => ({
    date: c.created_at,
    user: nameById.get(c.user_id) ?? "—",
    patient: c.patient_name ?? "—",
    durationSec: durationSeconds(c.start_time, c.end_time),
    score: Number(c.score),
  }));

  const n = rows.length;
  const scored = rows.filter((r) => r.score > 0);
  const avgScore =
    scored.length > 0
      ? scored.reduce((s, r) => s + r.score, 0) / scored.length
      : 0;
  const conversion =
    n > 0 ? (rows.filter((r) => r.score >= 6).length / n) * 100 : 0;

  // Corrélation de Pearson durée(min) ↔ score
  const pairs = rows.filter((r) => r.durationSec > 0 && r.score > 0);
  let correlation = 0;
  if (pairs.length >= 3) {
    const xs = pairs.map((p) => p.durationSec / 60);
    const ys = pairs.map((p) => p.score);
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let num = 0;
    let dx = 0;
    let dy = 0;
    for (let i = 0; i < xs.length; i++) {
      num += (xs[i] - mx) * (ys[i] - my);
      dx += (xs[i] - mx) ** 2;
      dy += (ys[i] - my) ** 2;
    }
    correlation = dx && dy ? num / Math.sqrt(dx * dy) : 0;
  }

  return NextResponse.json({
    rows: rows.slice(0, 200),
    stats: {
      count: n,
      avgScore: Number(avgScore.toFixed(2)),
      conversion: Number(conversion.toFixed(0)),
      correlation: Number(correlation.toFixed(2)),
      correlationPairs: pairs.length,
    },
  });
}
