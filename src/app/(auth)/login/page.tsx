import type { Metadata } from "next";
import Link from "next/link";
import { AuthFrame, DemoForm } from "@/app/ui/auth-form";

export const metadata: Metadata = {
  title: "ورود",
  description: "ورود به سامانه اسمارت منیجر",
};

export default function LoginPage() {
  return (
    <AuthFrame
      title="ورود"
      heading="ورود به سامانه"
      subheading="با شماره موبایل و رمز عبور خود وارد شوید."
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
            name: "password",
            label: "رمز عبور",
            type: "password",
            placeholder: "رمز عبور خود را وارد کنید",
            required: true,
          },
          {
            name: "remember",
            label: "",
            type: "checkbox",
            placeholder: "مرا به خاطر بسپار",
          },
        ]}
        submitLabel="ورود"
        endpoint="/api/auth/login"
        redirectTo="/dashboard"
      />
      <div className="form-note-s2 text-center pt-2">
        <Link href="/forgot-password">رمز عبور را فراموش کرده‌اید؟</Link>
      </div>
      <div className="form-note-s2 text-center pt-2">
        حساب کاربری ندارید؟ <Link href="/register">ثبت‌نام کنید</Link>
      </div>
    </AuthFrame>
  );
}
