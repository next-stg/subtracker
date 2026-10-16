"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/types";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthLayout title="Nouveau mot de passe" subtitle="Vérification du lien de réinitialisation.">
          <Card>
            <CardContent className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin" />
            </CardContent>
          </Card>
        </AuthLayout>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== passwordConfirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.resetPassword({ token, password, password_confirm: passwordConfirm });
      setSubmitted(true);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Impossible de modifier le mot de passe. Réessaie."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Nouveau mot de passe" subtitle="Choisissez un nouveau mot de passe pour votre compte.">
      <Card>
        {submitted ? (
          <>
            <CardContent className="py-6 text-sm text-muted-foreground">
              Votre mot de passe a été modifié. Vous pouvez maintenant vous connecter.
            </CardContent>
            <CardFooter className="justify-center">
              <Link href="/login" className="text-sm font-medium text-primary hover:underline">
                Se connecter
              </Link>
            </CardFooter>
          </>
        ) : !token ? (
          <>
            <CardContent className="py-6 text-sm text-destructive">
              Le lien de réinitialisation est invalide ou incomplet.
            </CardContent>
            <CardFooter className="justify-center">
              <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
                Demander un nouveau lien
              </Link>
            </CardFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="flex flex-col gap-5">
              {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Nouveau mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password-confirm">Confirmer le mot de passe</Label>
                <Input
                  id="password-confirm"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="mt-2">
              <Button type="submit" variant="gradient" className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Modifier le mot de passe"}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </AuthLayout>
  );
}
