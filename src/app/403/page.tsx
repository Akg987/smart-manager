import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12"
    >
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-amber-50 text-lg font-bold text-amber-700">
          403
        </span>
        <h1 className="mt-5 text-2xl font-semibold text-slate-900">
          دسترسی به این صفحه مجاز نیست
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          نقش یا محدودهٔ عضویت فعلی شما اجازهٔ مشاهدهٔ این بخش را نمی‌دهد. اگر به
          این صفحه نیاز دارید، با مدیر مربوطه تماس بگیرید.
        </p>
        <Link href="/dashboard" className={`${buttonVariants()} mt-6`}>
          بازگشت به داشبورد
        </Link>
      </section>
    </main>
  );
}
