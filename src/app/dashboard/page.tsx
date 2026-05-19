import Link from "next/link";
import { redirect } from "next/navigation";
import { PhoneCall } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/SignOutButton";
import { StatCard } from "@/components/StatCard";
import { CallsTable } from "@/components/CallsTable";
import { TeamLeaderboard } from "@/components/TeamLeaderboard";
import { ClosingResourcesManager } from "@/components/ClosingResourcesManager";
import { AppRecommendations } from "@/components/AppRecommendations";
import { ErrorLogPanel } from "@/components/ErrorLogPanel";
import { TeamReportPanel } from "@/components/TeamReportPanel";
import { CallsTrash } from "@/components/CallsTrash";
import { ResetRankingsButton } from "@/components/ResetRankingsButton";
import { DashboardAlerts } from "@/components/DashboardAlerts";
import { APP_VERSION } from "@/lib/version";
import type { AppUser, CallRecord, PerformanceTracking } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single<AppUser>();

  const role = profile?.role ?? "closer";
  const isAdmin = role === "admin";

  const { data: perf } = await supabase
    .from("performance_tracking")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<PerformanceTracking>();

  // Admin → tous les appels ; sinon seulement les siens (RLS appliquée).
  const callsQuery = supabase
    .from("calls")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (!isAdmin) callsQuery.eq("user_id", user.id);
  const { data: calls } = await callsQuery.returns<CallRecord[]>();

  // Corbeille : conversations supprimées (récupérables)
  const trashQuery = supabase
    .from("calls")
    .select("*")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .limit(50);
  if (!isAdmin) trashQuery.eq("user_id", user.id);
  const { data: trash } = await trashQuery.returns<CallRecord[]>();

  const isDelobaux = (user.email ?? "").toLowerCase().includes("delobaux");

  let hasProfile = true;
  try {
    const { data: prof } = await supabase
      .from("user_profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    hasProfile = !!prof;
  } catch {
    hasProfile = true; // table absente : ne pas bloquer
  }

  let team: (AppUser & { perf?: PerformanceTracking })[] = [];
  if (isAdmin) {
    const { data: users } = await supabase
      .from("users")
      .select("*")
      .returns<AppUser[]>();
    const { data: perfs } = await supabase
      .from("performance_tracking")
      .select("*")
      .returns<PerformanceTracking[]>();
    team = (users ?? []).map((u) => ({
      ...u,
      perf: perfs?.find((p) => p.user_id === u.id),
    }));
  }

  const userById = new Map(team.map((u) => [u.id, u.name]));

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <DashboardAlerts />
        <header className="overflow-hidden rounded-2xl bg-gradient-to-br from-medical-800 via-medical-700 to-medical-900 px-7 py-6 text-white shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-medical-200">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                Cabinet Dr Alexis Delobaux · Live
              </p>
              <h1 className="mt-1.5 text-3xl font-bold tracking-tight">
                Bonjour {profile?.name ?? user.email}
              </h1>
              <p className="mt-1 text-sm text-medical-100">
                Rôle : <span className="font-semibold capitalize">{role}</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/live-call"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-medical-800 shadow-sm transition hover:bg-medical-50"
              >
                <PhoneCall className="h-4 w-4" />
                Démarrer la conversation
              </Link>
              <SignOutButton />
            </div>
          </div>
        </header>

        {!hasProfile && (
          <Link
            href="/onboarding"
            className="flex items-center justify-between rounded-xl border border-medical-300 bg-medical-50 px-5 py-4 transition hover:bg-medical-100"
          >
            <div>
              <p className="text-sm font-semibold text-medical-800">
                Complète ton profil de personnalité (3 min)
              </p>
              <p className="text-xs text-medical-700">
                Pour des conseils et feedbacks adaptés à TA personnalité
                (Comm Colors / Process Comm).
              </p>
            </div>
            <span className="btn-primary">Commencer</span>
          </Link>
        )}

        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Conversations réalisées"
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

        {isAdmin && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">
                Classement de l&apos;équipe
              </h2>
              {isDelobaux && <ResetRankingsButton />}
            </div>
            <TeamLeaderboard team={team} />
          </section>
        )}

        {isAdmin && (
          <section>
            <ClosingResourcesManager canDelete={isDelobaux} />
          </section>
        )}

        {isAdmin && (
          <section>
            <AppRecommendations />
          </section>
        )}

        {isDelobaux && (
          <section>
            <TeamReportPanel />
          </section>
        )}

        {isDelobaux && (
          <section>
            <ErrorLogPanel />
          </section>
        )}

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-800">
            {isAdmin
              ? "Toutes les conversations"
              : "Mon historique de conversations"}
          </h2>
          <CallsTable
            calls={calls ?? []}
            showOwner={isAdmin}
            userById={userById}
            canDelete={isDelobaux}
          />
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-800">
            Corbeille{" "}
            <span className="text-sm font-normal text-slate-400">
              ({trash?.length ?? 0})
            </span>
          </h2>
          <CallsTrash
            calls={trash ?? []}
            showOwner={isAdmin}
            userById={userById}
            canDelete={isDelobaux}
          />
        </section>

        <p className="pt-2 text-center text-xs text-slate-400">
          Version déployée : {APP_VERSION}
        </p>
      </div>
    </main>
  );
}
