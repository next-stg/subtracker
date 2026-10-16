"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft } from "lucide-react";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/types";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.requestPasswordReset(email);
      setSubmitted(true);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Impossible d'envoyer la demande. Vérifie ta connexion et réessaie."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Mot de passe oublié ?"
      subtitle="Saisissez l’adresse associée à votre compte."
    >
      <Card>
        {submitted ? (
          <CardContent className="py-6 text-sm text-muted-foreground">
            Si un compte correspond à cette adresse, un e-mail contenant un lien
            de réinitialisation vient d’être envoyé. Vérifiez aussi vos
            courriers indésirables.
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="flex flex-col gap-5">
              {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Adresse email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="vous@exemple.com"
                />
              </div>
            </CardContent>
            <CardFooter className="mt-2 flex-col gap-3">
              <Button
                type="submit"
                variant="gradient"
                className="w-full"
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Envoyer le lien"}
              </Button>
            </CardFooter>
          </form>
        )}
        <CardFooter className="justify-center">
          <Link href="/login" className="flex items-center gap-2 text-sm text-primary hover:underline">
            <ArrowLeft className="size-4" />
            Retour à la connexion
          </Link>
        </CardFooter>
      </Card>
    </AuthLayout>
  );
}
