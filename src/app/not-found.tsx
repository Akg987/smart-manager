import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-brand-canvas px-6 text-center text-brand-ink">
      <img
        src="/images/logo-dark.png"
        alt="اسمارت منیجر"
        className="mb-6 w-48"
      />
      <span className="text-xs font-semibold tracking-wide text-brand-muted">خطای ۴۰۴</span>
      <h1 className="mt-2 text-2xl font-bold">این صفحه پیدا نشد</h1>
      <p className="mt-2 text-sm text-brand-muted">
        نشانی واردشده معتبر نیست یا صفحه جابه‌جا شده است.
      </p>
      <Link
        href="/dashboard"
        className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-brand-copper px-6 text-sm font-medium text-white transition-colors hover:bg-brand-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-copper focus-visible:ring-offset-2"
      >
        بازگشت به داشبورد
      </Link>
    </main>
  );
}
