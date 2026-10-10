import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  type,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink shadow-sm outline-none transition placeholder:text-brand-muted/70 focus-visible:border-brand-copper focus-visible:ring-4 focus-visible:ring-brand-copper/10 disabled:cursor-not-allowed disabled:bg-brand-canvas disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
