import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { durationSeconds } from "@/lib/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Verbatims clés (objections & signaux) analysés dans les transcriptions.
const VERBATIMS: { label: string; re: RegExp }[] = [
  { label: "Prix / budget", re: /\b(prix|cher|co[uû]te|budget|tarif)\b/i },
  { label: "Douleur", re: /\b(douleur|mal|souffr|anesth)\b/i },
  { label: "Délai / attente", re: /\b(d[ée]lai|attente|quand|disponib|planning)\b/i },
  { label: "Peur / sécurité", re: /\b(peur|risqu|s[ée]curit|danger|complicat)\b/i },
  { label: "Résultat", re: /\b(r[ée]sultat|naturel|cicatric|rendu)\b/i },
  { label: "Hésitation", re: /\b(r[ée]fl[ée]ch|h[ée]sit|pas s[uû]r|je sais pas)\b/i },
  { label: "Entourage", re: /\b(mari|conjoint|famille|enfants|mon copain)\b/i },
  { label: "Engagement", re: /\b(devis|rendez-?vous|rdv|pr[ée]paiement|acompte|on fait|je veux)\b/i },
];

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
    .select(
      "id, user_id, patient_name, start_time, end_time, score, created_at, transcript",
    )
    .is("deleted_at", null)
    .not("score", "is", null)
    .order("created_at", { ascending: false })
    .limit(500);

  const all = (calls ?? []).map((c) => ({
    id: c.id as string,
    date: c.created_at,
    user: nameById.get(c.user_id) ?? "—",
    patient: c.patient_name ?? "—",
    durationSec: durationSeconds(c.start_time, c.end_time),
    score: Number(c.score),
    transcript: (c.transcript ?? "").toString(),
  }));

  const n = all.length;
  const avg = (xs: number[]) =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  const avgScore = avg(all.map((r) => r.score));
  const converted = all.filter((r) => r.score >= 6).length;
  const conversion = n ? (converted / n) * 100 : 0;

  // Histogramme des scores
  const buckets = [
    { label: "0-2", min: 0, max: 2 },
    { label: "3-4", min: 3, max: 4 },
    { label: "5-6", min: 5, max: 6 },
    { label: "7-8", min: 7, max: 8 },
    { label: "9-10", min: 9, max: 10 },
  ].map((b) => ({
    label: b.label,
    count: all.filter((r) => r.score >= b.min && r.score <= b.max).length,
  }));

  // Série temporelle : score moyen par jour (14 derniers jours présents)
  const byDay = new Map<string, number[]>();
  for (const r of all) {
    const d = new Date(r.date).toISOString().slice(0, 10);
    byDay.set(d, [...(byDay.get(d) ?? []), r.score]);
  }
  const timeline = Array.from(byDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14)
    .map(([d, xs]) => ({
      day: d.slice(5),
      avg: Number(avg(xs).toFixed(2)),
    }));

  // Nuage durée ↔ score + corrélation Pearson
  const pairs = all
    .filter((r) => r.durationSec > 0 && r.score > 0)
    .map((r) => ({ x: r.durationSec / 60, y: r.score }));
  let correlation = 0;
  if (pairs.length >= 3) {
    const mx = avg(pairs.map((p) => p.x));
    const my = avg(pairs.map((p) => p.y));
    let num = 0;
    let dx = 0;
    let dy = 0;
    for (const p of pairs) {
      num += (p.x - mx) * (p.y - my);
      dx += (p.x - mx) ** 2;
      dy += (p.y - my) ** 2;
    }
    correlation = dx && dy ? num / Math.sqrt(dx * dy) : 0;
  }

  // Impact des verbatims : score moyen quand le verbatim est présent
  const verbatims = VERBATIMS.map((v) => {
    const present = all.filter((r) => v.re.test(r.transcript));
    const absent = all.filter((r) => !v.re.test(r.transcript));
    return {
      label: v.label,
      count: present.length,
      avgPresent: Number(avg(present.map((r) => r.score)).toFixed(2)),
      avgAbsent: Number(avg(absent.map((r) => r.score)).toFixed(2)),
      convPresent: present.length
        ? Number(
            (
              (present.filter((r) => r.score >= 6).length / present.length) *
              100
            ).toFixed(0),
          )
        : 0,
    };
  })
    .filter((v) => v.count > 0)
    .sort((a, b) => b.avgPresent - b.avgAbsent - (a.avgPresent - a.avgAbsent));

  return NextResponse.json({
    rows: all
      .map((r) => ({
        id: r.id,
        date: r.date,
        user: r.user,
        patient: r.patient,
        durationSec: r.durationSec,
        score: r.score,
      }))
      .slice(0, 200),
    stats: {
      count: n,
      avgScore: Number(avgScore.toFixed(2)),
      conversion: Number(conversion.toFixed(0)),
      converted,
      correlation: Number(correlation.toFixed(2)),
      correlationPairs: pairs.length,
    },
    buckets,
    timeline,
    scatter: pairs.map((p) => ({
      x: Number(p.x.toFixed(1)),
      y: p.y,
    })),
    verbatims,
  });
}
