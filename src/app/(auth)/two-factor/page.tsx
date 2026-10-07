import type { Metadata } from "next";
import { AuthFrame, AuthResendButton, CancelTwoFactorButton, DemoForm } from "@/app/ui/auth-form";

export const metadata: Metadata = { title: "ØªØ£ÛŒÛŒØ¯ Ù‡ÙˆÛŒØª Ø¯ÙˆÙ…Ø±Ø­Ù„Ù‡â€ŒØ§ÛŒ" };

export default function TwoFactorPage() {
  return <AuthFrame title="ØªØ£ÛŒÛŒØ¯ Ù‡ÙˆÛŒØª Ø¯ÙˆÙ…Ø±Ø­Ù„Ù‡â€ŒØ§ÛŒ" heading="Ú©Ø¯ ØªØ£ÛŒÛŒØ¯ Ø±Ø§ ÙˆØ§Ø±Ø¯ Ú©Ù†ÛŒØ¯" subheading="این مرحله برای حساب‌هایی است که احراز هویت دومرحله‌ای آن‌ها از سوی مدیر سامانه فعال شده است.">
    <DemoForm fields={[{ name: "code", label: "کد تأیید", placeholder: "کد پیامک‌شده", required: true }]} submitLabel="تأیید و ورود" endpoint="/api/auth/two-factor/verify" redirectTo="/dashboard" />
    <div className="mt-2 text-center"><AuthResendButton /></div><div className="text-center"><CancelTwoFactorButton /></div>
  </AuthFrame>;
}
