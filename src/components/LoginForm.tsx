"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectedFrom = searchParams.get("redirectedFrom") || "/dashboard";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const supabase = createClient();

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (error) throw error;
        setInfo(
          "Compte créé. Vérifiez votre email si la confirmation est activée, puis connectez-vous.",
        );
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push(redirectedFrom);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d'authentification");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-6">
      {mode === "signup" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Nom complet
          </label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          type="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Mot de passe
        </label>
        <input
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {info && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {info}
        </p>
      )}

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LogIn className="h-4 w-4" />
        )}
        {mode === "signin" ? "Se connecter" : "Créer le compte"}
      </button>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
          setInfo(null);
        }}
        className="w-full text-center text-sm text-medical-600 hover:underline"
      >
        {mode === "signin"
          ? "Pas encore de compte ? Créer un compte"
          : "Déjà un compte ? Se connecter"}
      </button>
    </form>
  );
}
