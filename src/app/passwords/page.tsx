"use client";

import { useEffect, useState } from "react";
import {
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/types";
import type { PasswordEntryPayload, PasswordEntrySummary } from "@/lib/types";

const emptyEntry = (): PasswordEntryPayload => ({
  title: "",
  username: "",
  password: "",
  website: "",
  notes: "",
});

async function writeClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Use the legacy copy command when clipboard permissions or secure context block the API.
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) {
    throw new Error("Le navigateur a refusé l’accès au presse-papiers.");
  }
}

export default function PasswordsPage() {
  const [entries, setEntries] = useState<PasswordEntrySummary[] | null>(null);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PasswordEntryPayload>(emptyEntry);
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingEdit, setIsLoadingEdit] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadEntries() {
    try {
      setEntries(await api.getPasswordEntries());
      setError(null);
    } catch (caught) {
      setEntries([]);
      setError(caught instanceof ApiError ? caught.message : "Impossible de charger le coffre-fort.");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement initial des données depuis l'API
    void loadEntries();
  }, []);

  function openNewEntry() {
    setError(null);
    setNotice(null);
    setEditingId(null);
    setForm(emptyEntry());
    setShowFormPassword(false);
    setDialogOpen(true);
  }

  async function openEditEntry(entry: PasswordEntrySummary) {
    setError(null);
    setIsLoadingEdit(entry.id);
    try {
      const fullEntry = await api.getPasswordEntry(entry.id);
      setEditingId(entry.id);
      setForm({
        title: fullEntry.title,
        username: fullEntry.username,
        password: fullEntry.password,
        website: fullEntry.website,
        notes: fullEntry.notes,
      });
      setShowFormPassword(false);
      setDialogOpen(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Impossible d'ouvrir cet identifiant.");
    } finally {
      setIsLoadingEdit(null);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      if (editingId) await api.updatePasswordEntry(editingId, form);
      else await api.createPasswordEntry(form);
      setDialogOpen(false);
      await loadEntries();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Impossible d'enregistrer cet identifiant.");
    } finally {
      setIsSaving(false);
    }
  }

  async function copyPassword(id: string) {
    setError(null);
    setNotice(null);
    setIsCopying(id);
    try {
      const entry = await api.getPasswordEntry(id);
      await writeClipboard(entry.password);
      setNotice("Mot de passe copié.");
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : "Impossible de copier ce mot de passe."
      );
    } finally {
      setIsCopying(null);
    }
  }

  async function deleteEntry(entry: PasswordEntrySummary) {
    if (!window.confirm(`Supprimer l'identifiant « ${entry.title} » ? Cette action est définitive.`)) return;
    setError(null);
    try {
      await api.deletePasswordEntry(entry.id);
      await loadEntries();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Impossible de supprimer cet identifiant.");
    }
  }

  const normalizedSearch = search.trim().toLocaleLowerCase("fr");
  const filteredEntries = (entries ?? []).filter((entry) =>
    [entry.title, entry.username, entry.website, entry.notes]
      .some((value) => value.toLocaleLowerCase("fr").includes(normalizedSearch))
  );

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-emerald-600 text-white">
              <KeyRound className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Gestionnaire de mots de passe</h1>
              <p className="text-sm text-muted-foreground">{entries?.length ?? 0} identifiant(s)</p>
            </div>
          </div>
          <Button variant="gradient" onClick={openNewEntry}>
            <Plus className="size-4" />
            Ajouter un identifiant
          </Button>
        </div>

        {error && (
          <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}

        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Rechercher un identifiant"
            placeholder="Rechercher un service ou un identifiant"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>

        {entries === null ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 border-y py-16 text-center">
            <KeyRound className="size-8 text-muted-foreground" />
            <p className="font-medium">{search ? "Aucun résultat" : "Aucun identifiant enregistré"}</p>
            {!search && <Button variant="outline" onClick={openNewEntry}><Plus className="size-4" />Ajouter un identifiant</Button>}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card">
            {filteredEntries.map((entry, index) => (
              <div key={entry.id} className={`flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-5 ${index > 0 ? "border-t" : ""}`}>
                <div className="flex min-w-0 flex-1 items-center gap-3 sm:min-w-56">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-600/10 text-emerald-700">
                    <KeyRound className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{entry.title}</p>
                    <p className="truncate text-sm text-muted-foreground">{entry.username || "Aucun identifiant"}</p>
                  </div>
                </div>

                <div className="flex min-w-0 flex-1 items-center gap-2 sm:min-w-48">
                  <code className="min-w-0 flex-1 truncate text-sm">••••••••••••</code>
                  <Button type="button" variant="ghost" size="icon" title="Copier le mot de passe" aria-label={`Copier le mot de passe de ${entry.title}`} disabled={isCopying === entry.id} onClick={() => void copyPassword(entry.id)}>
                    {isCopying === entry.id ? <Loader2 className="animate-spin" /> : <Copy />}
                  </Button>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {entry.website && (
                    <a className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground" href={entry.website} target="_blank" rel="noopener noreferrer" title="Ouvrir le site" aria-label="Ouvrir le site">
                      <ExternalLink className="size-4" />
                    </a>
                  )}
                  <Button type="button" variant="ghost" size="icon" title="Modifier" aria-label={`Modifier ${entry.title}`} disabled={isLoadingEdit === entry.id} onClick={() => void openEditEntry(entry)}>
                    {isLoadingEdit === entry.id ? <Loader2 className="animate-spin" /> : <Pencil />}
                  </Button>
                  <Button type="button" variant="ghost" size="icon" title="Supprimer" aria-label={`Supprimer ${entry.title}`} onClick={() => void deleteEntry(entry)}>
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogHeader title={editingId ? "Modifier l’identifiant" : "Nouvel identifiant"} onClose={() => setDialogOpen(false)} />
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {error && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          <div className="flex flex-col gap-2">
            <Label htmlFor="entry-title">Service</Label>
            <Input id="entry-title" autoComplete="off" maxLength={100} required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Ex. Messagerie" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="entry-username">Identifiant ou e-mail</Label>
            <Input id="entry-username" autoComplete="off" maxLength={254} value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="entry-password">Mot de passe</Label>
            <div className="flex gap-2">
              <Input id="entry-password" type={showFormPassword ? "text" : "password"} autoComplete="new-password" maxLength={4096} required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
              <Button type="button" variant="outline" size="icon" title={showFormPassword ? "Masquer" : "Afficher"} aria-label={showFormPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"} onClick={() => setShowFormPassword((visible) => !visible)}>
                {showFormPassword ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="entry-website">Site web</Label>
            <Input id="entry-website" type="url" maxLength={2048} value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} placeholder="https://" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="entry-notes">Notes</Label>
            <Textarea id="entry-notes" maxLength={5000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={3} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="size-4 animate-spin" />}
              {editingId ? "Enregistrer" : "Ajouter"}
            </Button>
          </div>
        </form>
      </Dialog>
    </DashboardShell>
  );
}