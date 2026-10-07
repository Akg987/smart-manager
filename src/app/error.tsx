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
    <main className="flex min-h-screen flex-col items-center justify-center bg-lighter px-6 text-center">
      <span className="overline-title">خطای اجرایی</span>
      <h1 className="title title-lg mt-2">پردازش این صفحه با مشکل روبه‌رو شد</h1>
      <p className="text-soft mt-2" role="alert">
        {errorMessage(error, "یک خطای پیش‌بینی‌نشده رخ داد.")}
      </p>
      <Button className="mt-4" type="button" onClick={reset}>
        تلاش دوباره
      </Button>
    </main>
  );
}
