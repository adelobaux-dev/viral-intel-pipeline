import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-medical-900 via-medical-800 to-slate-900 px-6 text-center text-white">
      <div className="max-w-2xl">
        <p className="mb-3 text-sm font-medium uppercase tracking-widest text-medical-200">
          Cabinet Dr Alexis Delobaux
        </p>
        <h1 className="text-4xl font-bold sm:text-5xl">
          Assistant de closing en temps réel
        </h1>
        <p className="mt-5 text-lg text-medical-100">
          Transcription live, recommandations IA selon la méthode C.A.R.E.S.,
          scoring et suivi des performances de l&apos;équipe.
        </p>
        <div className="mt-10">
          <Link
            href="/login"
            className="rounded-lg bg-white px-6 py-3 text-base font-semibold text-medical-800 transition hover:bg-medical-50"
          >
            Se connecter
          </Link>
        </div>
      </div>
    </main>
  );
}
