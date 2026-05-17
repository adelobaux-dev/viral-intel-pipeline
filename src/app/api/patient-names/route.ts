import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { looseNameMatch, normalizeName } from "@/lib/patientMatch";

export const dynamic = "force-dynamic";

/** Suggestions de noms de patients (auto-complétion, tolérante aux fautes). */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const q = (new URL(request.url).searchParams.get("q") || "").trim();

  const { data } = await createAdminClient()
    .from("calls")
    .select("patient_name")
    .not("patient_name", "is", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500);

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const row of data ?? []) {
    const n = (row.patient_name as string)?.trim();
    if (!n) continue;
    const key = normalizeName(n);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(n);
  }

  const suggestions = (
    q.length < 1
      ? unique
      : unique.filter(
          (n) =>
            normalizeName(n).includes(normalizeName(q)) ||
            looseNameMatch(q, n),
        )
  ).slice(0, 10);

  return NextResponse.json({ suggestions });
}
