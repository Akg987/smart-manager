"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body className="flex min-h-screen flex-col items-center justify-center bg-brand-canvas px-6 text-center text-brand-ink">
        <h1 className="text-2xl font-bold">خطای سامانه</h1>
        <p className="mt-2 max-w-xl text-sm text-brand-muted" role="alert">
          {error.message || "بارگذاری برنامه با خطا روبه‌رو شد."}
        </p>
        <button
          type="button"
          className="mt-4 inline-flex min-h-10 items-center justify-center rounded-md bg-brand-copper px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-copper-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-copper focus-visible:ring-offset-2"
          onClick={reset}
        >
          تلاش دوباره
        </button>
      </body>
    </html>
  );
}
