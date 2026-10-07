import Link from "next/link";

export default function NotFound() {
  return <main className="flex min-h-screen flex-col items-center justify-center bg-lighter px-6 text-center">
    <img src="/images/logo-dark.png" alt="اسمارت منیجر" className="mb-6 w-48" />
    <span className="overline-title">خطای ۴۰۴</span>
    <h1 className="title title-lg mt-2">این صفحه پیدا نشد</h1>
    <p className="text-soft mt-2">نشانی واردشده معتبر نیست یا صفحه جابه‌جا شده است.</p>
    <Link href="/dashboard" className="btn btn-primary mt-4">بازگشت به داشبورد</Link>
  </main>;
}
