import type { Metadata } from "next";
import Link from "next/link";
import { AuthFrame } from "@/app/ui/auth-form";

export const metadata: Metadata = { title: "در انتظار تأیید" };

export default function ApprovalPendingPage() {
  return <AuthFrame title="در انتظار تأیید" heading="حساب شما در انتظار تأیید است" subheading="مدیر سیستم باید دسترسی حساب شما را تأیید کند. پس از تأیید، با همین شماره موبایل وارد شوید.">
    <div className="alert alert-fill alert-warning alert-icon"><em className="icon ni ni-alert-circle" />درخواست ثبت‌نام شما برای بررسی مدیر ارسال شده است.</div>
    <Link className="btn btn-lg btn-primary btn-block" href="/login">بازگشت به ورود</Link>
  </AuthFrame>;
}
