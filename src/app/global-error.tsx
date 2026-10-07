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
      <body className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
        <h1>خطای سامانه</h1>
        <p role="alert">
          {error.message || "بارگذاری برنامه با خطا روبه‌رو شد."}
        </p>
        <button type="button" onClick={reset}>
          تلاش دوباره
        </button>
      </body>
    </html>
  );
}
