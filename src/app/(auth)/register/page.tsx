import type { Metadata } from "next";
import Link from "next/link";
import { AuthFrame, DemoForm } from "@/app/ui/auth-form";

export const metadata: Metadata = {
  title: "ثبت نام",
  description: "ساخت حساب کاربری در اسمارت منیجر",
};

export default function RegisterPage() {
  return (
    <AuthFrame
      title="ثبت نام"
      heading="ثبت نام"
      subheading="برای ساخت حساب کاربری، اطلاعات زیر را تکمیل کنید."
    >
      <DemoForm
        fields={[
          {
            name: "first_name",
            label: "نام",
            placeholder: "نام خود را وارد کنید",
            required: true,
          },
          {
            name: "last_name",
            label: "نام خانوادگی",
            placeholder: "نام خانوادگی خود را وارد کنید",
            required: true,
          },
          {
            name: "birth_date",
            label: "تاریخ تولد",
            type: "date",
            placeholder: "۱۴۰۵/۰۱/۰۱",
            required: true,
          },
          {
            name: "national_code",
            label: "کد ملی",
            placeholder: "۰۱۲۳۴۵۶۷۸۹",
            required: true,
          },
          {
            name: "address",
            label: "آدرس",
            type: "textarea",
            placeholder: "نشانی کامل محل سکونت",
            required: true,
            full: true,
          },
          {
            name: "mobile",
            label: "شماره موبایل",
            type: "tel",
            placeholder: "09123456789",
            hint: "این شماره، نام کاربری شما برای ورود خواهد بود.",
            required: true,
            full: true,
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
        submitLabel="ثبت نام"
        endpoint="/api/auth/register"
        redirectTo="/approval-pending"
      />
      <div className="form-note-s2 text-center pt-2">
        حساب کاربری دارید؟ <Link href="/login">وارد شوید</Link>
      </div>
    </AuthFrame>
  );
}
