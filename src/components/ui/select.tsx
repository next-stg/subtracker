import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

function Select({
  className,
  children,
  showIcon = true,
  ...props
}: React.ComponentProps<"select"> & { showIcon?: boolean }) {
  return (
    <div className={cn("relative w-full", className)}>
      <select
        data-slot="select"
        className={cn(
          "border-input dark:bg-input/30 flex h-10 w-full appearance-none rounded-md border bg-transparent px-3 py-2 pr-8 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
      </select>
      {showIcon && (
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      )}
    </div>
  );
}

export { Select };
