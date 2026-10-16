"use client";

import { useState } from "react";

import { getServiceLogoUrl } from "@/lib/logos";
import { cn } from "@/lib/utils";

export function ServiceLogo({
  name,
  color,
  className,
}: {
  name: string;
  color?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = getServiceLogoUrl(name);

  if (!url || failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg text-sm font-semibold text-white",
          className
        )}
        style={{ backgroundColor: color || "#6D28D9" }}
      >
        {name.slice(0, 1).toUpperCase()}
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg bg-white p-1.5 ring-1 ring-border",
        className
      )}
    >
      <img
        src={url}
        alt={name}
        className="h-full w-full object-contain"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
