"use client";
import { useEffect, useState } from "react";
import { Loader2, Save, Settings as SettingsIcon } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { CURRENCIES } from "@/lib/constants";
import { Select }  from "@/components/ui/select";
import { ApiError, type UserPreferences } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/dist/client/components/navigation";
import { useAuth } from "@/lib/auth-context";
const REMINDER_OPTIONS = [1, 3, 7, 14, 30];
export default function SettingsPage() {
  const { refreshProfile } = useAuth();
  const [appLanguage, setAppLanguage] = useState("fr");
  const [username, setUsername] = useState("");
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => {
    api
      .getPreferences()
      .then(setPrefs)
      .catch(() => setError("Impossible de charger les préférences."));
  }, []);
  async function handleSave() {
    if (!prefs) return;
    setIsSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await api.updatePreferences({...prefs, 
        language: appLanguage,
      });
      await refreshProfile();
      setPrefs(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible d'enregistrer les préférences."
      );
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <DashboardShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
          <p className="text-muted-foreground">
            Gérez vos préférences et paramètres de l&apos;application
          </p>
        </div>
        {!prefs ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
            <Card className="h-fit py-3">
              <CardContent className="flex flex-col gap-1 px-3">
                <div className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
                  <SettingsIcon className="size-4" />
                  Préférences
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-8">
                {error && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </div>
                )}
                  <div className="mt-8 border-t pt-6"> 
                    <h2 className="mb-4 text-lg font-semibold">Profil</h2>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="username">Nom d'utilisateur</Label>
                          <Input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Votre nom"
                            className="max-w-xs"
                          />
                          <p className="text-xs text-muted-foreground">
                            C'est le nom qui sera affiché sur votre tableau de bord.
                          </p>
                      </div>
                  </div>
                <div>
                  <h2 className="mb-4 text-lg font-semibold">Préférences</h2>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="currency">Devise par défaut</Label>
                    <Select
                      id="currency"
                      className="max-w-xs"
                      value={prefs.display_currency}
                      onChange={(e) =>
                        setPrefs({ ...prefs, display_currency: e.target.value })
                      }
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div>
                  <h2 className="mb-4 text-lg font-semibold">
                    Notifications Système
                  </h2>
                  <div className="flex flex-col gap-6">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">
                          Notifications par email
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Recevoir des rappels par email
                        </p>
                      </div>
                      <Switch
                        checked={prefs.email_notifications}
                        onCheckedChange={(checked) =>
                          setPrefs({ ...prefs, email_notifications: checked })
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="reminder">
                        Délai de rappel de renouvellement (jours)
                      </Label>
                      <Select
                        id="reminder"
                        className="max-w-xs"
                        value={prefs.renewal_reminder_days}
                        onChange={(e) =>
                          setPrefs({
                            ...prefs,
                            renewal_reminder_days: Number(e.target.value),
                          })
                        }
                      >
                        {REMINDER_OPTIONS.map((n) => (
                          <option key={n} value={n}>
                            {n} jour{n > 1 ? "s" : ""} avant
                          </option>
                        ))}
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Le système enverra une notification X jours avant le
                        renouvellement
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="gradient"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    Enregistrer
                  </Button>
                  {saved && (
                    <span className="text-sm text-emerald-600">
                      Préférences enregistrées ✓
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
