"use client";

import { useEffect, useRef, useState } from "react";
import {
  BookPlus,
  FolderSync,
  FolderUp,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";

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
  const [drive, setDrive] = useState<{
    connected: boolean;
    count: number;
    docs: string[];
    error: string | null;
  } | null>(null);
  const [driveLoading, setDriveLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // webkitdirectory n'est pas typé : on l'ajoute manuellement.
    folderInputRef.current?.setAttribute("webkitdirectory", "");
    folderInputRef.current?.setAttribute("directory", "");
  }, []);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      const fd = new FormData();
      Array.from(fileList).forEach((f) => fd.append("files", f));
      const res = await fetch("/api/resources/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec de l'import");
      setUploadMsg(
        `${data.importedCount} fichier(s) importé(s)` +
          (data.skippedCount
            ? `, ${data.skippedCount} ignoré(s) (type non lu : PDF illisible, Word, audio, vidéo…)`
            : ""),
      );
      load();
    } catch (e) {
      setUploadMsg(e instanceof Error ? e.message : "Échec de l'import");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (folderInputRef.current) folderInputRef.current.value = "";
    }
  }

  async function refreshDrive() {
    setDriveLoading(true);
    try {
      const res = await fetch("/api/resources/drive");
      const data = await res.json();
      if (res.ok) setDrive(data);
      else setDrive({ connected: false, count: 0, docs: [], error: data.error });
    } catch {
      setDrive({
        connected: false,
        count: 0,
        docs: [],
        error: "Erreur réseau",
      });
    } finally {
      setDriveLoading(false);
    }
  }

  useEffect(() => {
    refreshDrive();
  }, []);

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

      <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FolderSync className="h-4 w-4 text-medical-600" />
            <span className="text-sm font-semibold text-slate-700">
              Dossier Google Drive
            </span>
            {drive &&
              (drive.connected ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  connecté · {drive.count} document(s)
                </span>
              ) : (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  non connecté
                </span>
              ))}
          </div>
          <button
            type="button"
            onClick={refreshDrive}
            disabled={driveLoading}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {driveLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Rafraîchir le Drive
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Les documents Google Docs et fichiers texte de ton dossier Drive (et
          ses sous-dossiers) sont lus automatiquement et mis à jour ~toutes les
          5 min. Tu peux ajouter des documents/sous-dossiers quand tu veux.
        </p>
        {drive?.error && (
          <p className="mt-2 text-xs text-amber-700">{drive.error}</p>
        )}
        {drive && drive.docs.length > 0 && (
          <ul className="mt-2 h-20 space-y-0.5 overflow-y-scroll rounded border border-slate-200 bg-white p-2 text-xs text-slate-600">
            {drive.docs.map((d, i) => (
              <li key={i}>• {d}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Upload className="h-4 w-4 text-medical-600" />
          <span className="text-sm font-semibold text-slate-700">
            Importer depuis mon ordinateur
          </span>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Fichiers <strong>.txt, .md, .csv, .pdf</strong> (ou un dossier
          entier). Le texte est lu et ajouté aux connaissances de l&apos;IA.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.md,.csv,.json,.pdf,text/plain,application/pdf"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-md bg-medical-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-medical-700 disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" /> Choisir des fichiers
          </button>
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <FolderUp className="h-3.5 w-3.5" /> Choisir un dossier
          </button>
          {uploading && (
            <Loader2 className="h-4 w-4 animate-spin text-medical-600" />
          )}
        </div>
        {uploadMsg && (
          <p className="mt-2 text-xs text-slate-600">{uploadMsg}</p>
        )}
      </div>

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

      <p className="mb-1 text-sm font-semibold text-slate-700">
        Ressources enregistrées
      </p>
      <div className="h-28 divide-y divide-slate-100 overflow-y-scroll rounded-lg border border-slate-200 bg-slate-50 text-sm">
        {loading && (
          <p className="px-3 py-3 text-sm text-slate-400">Chargement…</p>
        )}
        {!loading && resources.length === 0 && (
          <p className="px-3 py-3 text-sm text-slate-400">
            Aucune ressource pour l&apos;instant.
          </p>
        )}
        {resources.map((r) => (
          <div
            key={r.id}
            className="flex items-start justify-between gap-3 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800">
                {r.title}
              </p>
              <p className="line-clamp-1 text-xs text-slate-500">
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
