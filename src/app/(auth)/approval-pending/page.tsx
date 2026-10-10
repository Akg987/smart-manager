import type { Metadata } from "next";
import Link from "next/link";
import { AuthFrame } from "@/app/ui/auth-form";

export const metadata: Metadata = { title: "در انتظار تأیید" };

export default function ApprovalPendingPage() {
  return (
    <AuthFrame
      title="در انتظار تأیید"
      heading="حساب شما در انتظار تأیید است"
      subheading="مدیر سیستم باید دسترسی حساب شما را تأیید کند. پس از تأیید، با همین شماره موبایل وارد شوید."
    >
      <div className="mb-4 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">
        <span aria-hidden="true" className="mt-0.5 font-bold">!</span>
        درخواست ثبت‌نام شما برای بررسی مدیر ارسال شده است.
      </div>
      <Link href="/login" className="inline-flex h-10 w-full items-center justify-center rounded-md bg-brand-copper px-4 text-sm font-medium text-white hover:bg-brand-copper-hover">
        بازگشت به ورود
      </Link>
    </AuthFrame>
  );
}
