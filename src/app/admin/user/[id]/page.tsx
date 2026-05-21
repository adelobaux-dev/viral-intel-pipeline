import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { CallsTable } from "@/components/CallsTable";
import { StatCard } from "@/components/StatCard";
import type { AppUser, CallRecord, PerformanceTracking } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminUserPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(user.email ?? "").toLowerCase().includes("delobaux")) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("*")
    .eq("id", params.id)
    .single<AppUser>();
  if (!profile) redirect("/dashboard");

  const { data: perf } = await admin
    .from("performance_tracking")
    .select("*")
    .eq("user_id", params.id)
    .maybeSingle<PerformanceTracking>();

  let commProfile: string | null = null;
  let commPatterns: string | null = null;
  try {
    const { data } = await admin
      .from("user_profiles")
      .select("analysis")
      .eq("user_id", params.id)
      .maybeSingle<{ analysis: string }>();
    commProfile = data?.analysis ?? null;
  } catch {
    /* table absente */
  }
  try {
    const { data } = await admin
      .from("user_comm_patterns")
      .select("patterns")
      .eq("user_id", params.id)
      .maybeSingle<{ patterns: string }>();
    commPatterns = data?.patterns ?? null;
  } catch {
    /* table absente */
  }

  const { data: calls } = await admin
    .from("calls")
    .select("*")
    .eq("user_id", params.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<CallRecord[]>();

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" /> Retour au dashboard
        </Link>

        <header className="rounded-2xl bg-gradient-to-br from-medical-800 to-medical-900 px-7 py-5 text-white shadow-lg">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-medical-200">
            Vue administrateur · écran utilisateur
          </p>
          <h1 className="mt-1 text-2xl font-bold">{profile.name}</h1>
          <p className="text-sm text-medical-100">
            {profile.email} · rôle{" "}
            <span className="font-semibold capitalize">{profile.role}</span>
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Conversations"
            value={String(perf?.total_calls ?? 0)}
          />
          <StatCard
            label="Score moyen"
            value={`${Number(perf?.average_score ?? 0).toFixed(1)} / 10`}
            accent="emerald"
          />
          <StatCard
            label="Taux de conversion"
            value={`${Number(perf?.conversion_rate ?? 0).toFixed(0)} %`}
            accent="amber"
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">
              Profil de communication
            </h2>
            <pre className="max-h-72 overflow-y-scroll whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              {commProfile || "Non renseigné (test non passé)."}
            </pre>
          </div>
          <div className="card p-5">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">
              Patterns de communication appris
            </h2>
            <pre className="max-h-72 overflow-y-scroll whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              {commPatterns || "Pas encore d'apprentissage automatique."}
            </pre>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-800">
            Conversations de {profile.name}
          </h2>
          <CallsTable
            calls={calls ?? []}
            showOwner={false}
            userById={new Map()}
            canDelete
          />
        </section>
      </div>
    </main>
  );
}
