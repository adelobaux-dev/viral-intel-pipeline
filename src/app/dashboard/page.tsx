import Link from "next/link";
import { redirect } from "next/navigation";
import { PhoneCall } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/SignOutButton";
import { StatCard } from "@/components/StatCard";
import { CallsTable } from "@/components/CallsTable";
import { TeamLeaderboard } from "@/components/TeamLeaderboard";
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
    .order("created_at", { ascending: false })
    .limit(50);
  if (!isAdmin) callsQuery.eq("user_id", user.id);
  const { data: calls } = await callsQuery.returns<CallRecord[]>();

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
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-medical-600">
              Cabinet Dr Alexis Delobaux
            </p>
            <h1 className="text-xl font-bold text-slate-800">
              Bonjour {profile?.name ?? user.email}
            </h1>
            <p className="text-sm text-slate-500">
              Rôle :{" "}
              <span className="font-medium capitalize">{role}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/live-call" className="btn-primary">
              <PhoneCall className="h-4 w-4" />
              Démarrer la conversation
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Appels réalisés"
            value={String(perf?.total_calls ?? 0)}
          />
          <StatCard
            label="Score moyen"
            value={`${Number(perf?.average_score ?? 0).toFixed(1)} / 10`}
          />
          <StatCard
            label="Taux de conversion"
            value={`${Number(perf?.conversion_rate ?? 0).toFixed(0)} %`}
          />
        </section>

        {isAdmin && (
          <section>
            <h2 className="mb-3 text-lg font-semibold text-slate-800">
              Classement de l&apos;équipe
            </h2>
            <TeamLeaderboard team={team} />
          </section>
        )}

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-800">
            {isAdmin ? "Tous les appels" : "Mon historique d'appels"}
          </h2>
          <CallsTable
            calls={calls ?? []}
            showOwner={isAdmin}
            userById={userById}
          />
        </section>
      </div>
    </main>
  );
}
