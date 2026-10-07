import type { Metadata } from "next";
import Link from "next/link";
import { AuthFrame, DemoForm } from "@/app/ui/auth-form";

export const metadata: Metadata = { title: "تنظیم رمز عبور جدید" };

export default function ResetPasswordPage() {
  return (
    <AuthFrame
      title="تنظیم رمز عبور جدید"
      heading="رمز عبور جدید"
      subheading="کد ارسال‌شده به موبایل و رمز عبور تازه را وارد کنید."
      footnote={
        <>
          کد نرسید؟ <Link href="/forgot-password">ارسال دوباره</Link>
        </>
      }
    >
      <DemoForm
        fields={[
          {
            name: "mobile",
            label: "شماره موبایل",
            type: "tel",
            placeholder: "09123456789",
            required: true,
          },
          {
            name: "code",
            label: "کد تأیید",
            placeholder: "کد پیامک‌شده",
            required: true,
          },
          {
            name: "password",
            label: "رمز عبور جدید",
            type: "password",
            placeholder: "رمز عبور تازه",
            hint: "حداقل ۸ کاراکتر، شامل حرف و عدد.",
            required: true,
          },
          {
            name: "password_confirmation",
            label: "تکرار رمز عبور",
            type: "password",
            placeholder: "رمز عبور را دوباره وارد کنید",
            required: true,
          },
        ]}
        submitLabel="ذخیره رمز عبور"
        endpoint="/api/auth/password-reset/confirm"
        redirectTo="/login"
      />
    </AuthFrame>
  );
}
