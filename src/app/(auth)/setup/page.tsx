import type { Metadata } from "next";
import { AuthFrame, DemoForm } from "@/app/ui/auth-form";

export const metadata: Metadata = { title: "راه‌اندازی اولیه" };

export default function SetupPage() {
  return (
    <AuthFrame
      title="راه‌اندازی اولیه"
      heading="ساخت حساب مدیر"
      subheading="این نخستین اجرای سامانه است. شماره موبایل و رمز عبور خود را وارد کنید تا حساب مدیر ساخته شود."
    >
      <DemoForm
        fields={[
          {
            name: "mobile",
            label: "شماره موبایل",
            type: "tel",
            placeholder: "09123456789",
            hint: "این شماره، نام کاربری شما برای ورود خواهد بود.",
            required: true,
          },
          {
            name: "password",
            label: "رمز عبور",
            type: "password",
            placeholder: "رمز عبور خود را وارد کنید",
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
        submitLabel="ساخت حساب مدیر و ورود"
        endpoint="/api/auth/setup"
        redirectTo="/dashboard"
      />
    </AuthFrame>
  );
}
