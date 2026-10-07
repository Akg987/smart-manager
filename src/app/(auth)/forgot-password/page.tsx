import type { Metadata } from "next";
import Link from "next/link";
import { AuthFrame, DemoForm } from "@/app/ui/auth-form";

export const metadata: Metadata = { title: "بازیابی رمز عبور" };

export default function ForgotPasswordPage() {
  return (
    <AuthFrame
      title="بازیابی رمز عبور"
      heading="بازیابی رمز عبور"
      subheading="شماره موبایل حساب را وارد کنید. اگر حسابی با این شماره وجود داشته باشد، یک کد یکبارمصرف برای آن ارسال می‌شود."
      footnote={
        <>
          رمز عبور را به خاطر دارید؟ <Link href="/login">بازگشت به ورود</Link>
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
        ]}
        submitLabel="ارسال کد تأیید"
        endpoint="/api/auth/password-reset/request"
        redirectTo="/reset-password"
      />
    </AuthFrame>
  );
}
