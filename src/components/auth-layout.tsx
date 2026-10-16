import Link from "next/link";
import { CreditCard } from "lucide-react";
export function AuthLayout({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 py-12">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-[-6rem] right-[-6rem] h-72 w-72 rounded-full bg-[oklch(0.65_0.2_330)]/20 blur-3xl" />
      </div>
      <Link href="/" className="mb-8 flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-linear-to-br from-[oklch(0.55_0.22_280)] to-[oklch(0.6_0.2_320)] text-white shadow-md">
          <CreditCard className="size-5" />
        </div>
        <span className="text-lg font-semibold tracking-tight">
          SubTracker
        </span>
      </Link>
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
