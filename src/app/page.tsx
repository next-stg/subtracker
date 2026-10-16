import Link from "next/link";
import Image from "next/image";
import {
  CreditCard,
  LineChart,
  BellRing,
  PieChart,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = [
  {
    icon: PieChart,
    title: "Vue d'ensemble claire",
    description:
      "Coût mensuel, annuel, et abonnements actifs : tout votre budget en un coup d'œil.",
  },
  {
    icon: BellRing,
    title: "Rappels de renouvellement",
    description:
      "Ne soyez plus jamais surpris par un prélèvement grâce aux notifications avant échéance.",
  },
  {
    icon: LineChart,
    title: "Analyses détaillées",
    description:
      "Dépenses par catégorie et évolution mensuelle pour repérer ce qui pèse sur votre budget.",
  },
];
export default function Home() {
  return (
    <div className="relative z-0 flex min-h-screen flex-col overflow-hidden bg-background">
     <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
         {/* <Image src="/img.png" alt="" fill className="object-cover" /> */}
         <div className="absolute inset-0 bg-linear-to-br from-indigo-100/90 via-violet-100/85 to-fuchsia-100/90 backdrop-blur-[2px] dark:from-indigo-950/85 dark:via-violet-950/80 dark:to-fuchsia-950/85" />
    </div>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-linear-to-br from-[oklch(0.55_0.22_280)] to-[oklch(0.6_0.2_320)] text-white shadow-md">
            <CreditCard className="size-7" />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            SubTracker
          </span>
        </div>
        <nav className="flex items-center gap-">
          <Button variant="ghost" asChild>
            <Link href="/login">Se connecter</Link>
          </Button>
          <Button variant="gradient" asChild>
            <Link href="/register">Créer un compte</Link>
          </Button>
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card/60 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur-sm">
          <ShieldCheck className="size-4 text-primary" />
          Vos abonnements, sous contrôle
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Bienvenue sur{" "}
          <span className="bg-linear-to-r from-[oklch(0.5_0.22_280)] to-[oklch(0.6_0.2_320)] bg-clip-text text-transparent">
            SubTracker
          </span>
        </h1>
        <p className="mt-5 max-w-xl text-lg text-pretty text-black">
          Centralisez tous vos abonnements, suivez vos dépenses et ne manquez
          plus jamais un renouvellement. Simple, clair, sans surprise.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" variant="gradient" asChild>
            <Link href="/login">
              Se connecter
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/register">Créer un compte</Link>
          </Button>
        </div>
      </main>
      <section className="mx-auto grid w-full max-w-5xl gap-4 px-6 pb-20 sm:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.title} className="border-border/60 bg-card/70 backdrop-blur-sm">
            <CardHeader>
              <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <feature.icon className="size-5" />
              </div>
              <CardTitle className="text-base">{feature.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>{feature.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
