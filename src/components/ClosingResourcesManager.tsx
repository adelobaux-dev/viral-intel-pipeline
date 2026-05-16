"use client";

import { useEffect, useState } from "react";
import { BookPlus, Loader2, Trash2 } from "lucide-react";

interface Resource {
  id: string;
  title: string;
  content: string;
  kind: string;
  created_at: string;
}

export function ClosingResourcesManager() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/resources");
      const data = await res.json();
      if (res.ok) setResources(data.resources ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addResource(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec de l'ajout");
      setResources((r) => [data.resource, ...r]);
      setTitle("");
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'ajout");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Supprimer cette ressource ?")) return;
    const res = await fetch(`/api/resources/${id}`, { method: "DELETE" });
    if (res.ok) setResources((r) => r.filter((x) => x.id !== id));
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-2">
        <BookPlus className="h-5 w-5 text-medical-600" />
        <h2 className="text-lg font-semibold text-slate-800">
          Ressources d&apos;aide au closing
        </h2>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Ces ressources (scripts, réponses aux objections, arguments…) sont
        utilisées par l&apos;IA pendant les conversations, en plus de la méthode
        C.A.R.E.S. Réservé au Dr Delobaux / Prescillia.
      </p>

      <form onSubmit={addResource} className="mb-5 space-y-3">
        <input
          className="input"
          placeholder="Titre (ex : Réponse à l'objection prix)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <textarea
          className="input min-h-[120px]"
          placeholder="Contenu de la ressource (texte, script, argumentaire…)"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
        />
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <BookPlus className="h-4 w-4" />
          )}
          Ajouter la ressource
        </button>
      </form>

      <div className="divide-y divide-slate-100 border-t border-slate-100">
        {loading && (
          <p className="py-3 text-sm text-slate-400">Chargement…</p>
        )}
        {!loading && resources.length === 0 && (
          <p className="py-3 text-sm text-slate-400">
            Aucune ressource pour l&apos;instant.
          </p>
        )}
        {resources.map((r) => (
          <div
            key={r.id}
            className="flex items-start justify-between gap-3 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800">{r.title}</p>
              <p className="line-clamp-2 text-xs text-slate-500">
                {r.content}
              </p>
            </div>
            <button
              onClick={() => remove(r.id)}
              title="Supprimer"
              className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
