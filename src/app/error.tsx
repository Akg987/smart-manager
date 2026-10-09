"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-brand-canvas px-6 text-center text-brand-ink">
      <span className="text-xs font-semibold tracking-wide text-brand-muted">خطای اجرایی</span>
      <h1 className="mt-2 text-2xl font-bold">پردازش این صفحه با مشکل روبه‌رو شد</h1>
      <p className="mt-2 max-w-xl text-sm text-brand-muted" role="alert">
        {errorMessage(error, "یک خطای پیش‌بینی‌نشده رخ داد.")}
      </p>
      <Button className="mt-4" type="button" onClick={reset}>
        تلاش دوباره
      </Button>
    </main>
  );
}
