import type { Metadata } from "next";
import {
  AuthFrame,
  AuthResendButton,
  CancelTwoFactorButton,
  DemoForm,
} from "@/app/ui/auth-form";

export const metadata: Metadata = { title: "تأیید هویت دومرحله‌ای" };

export default function TwoFactorPage() {
  return (
    <AuthFrame
      title="تأیید هویت دومرحله‌ای"
      heading="کد تأیید را وارد کنید"
      subheading="این مرحله برای حساب‌هایی است که احراز هویت دومرحله‌ای آن‌ها از سوی مدیر سامانه فعال شده است."
    >
      <DemoForm
        fields={[
          {
            name: "code",
            label: "کد تأیید",
            placeholder: "کد پیامک‌شده",
            required: true,
          },
        ]}
        submitLabel="تأیید و ورود"
        endpoint="/api/auth/two-factor/verify"
        redirectTo="/dashboard"
        redirectToNext
      />
      <div className="mt-2 text-center">
        <AuthResendButton />
      </div>
      <div className="text-center">
        <CancelTwoFactorButton />
      </div>
    </AuthFrame>
  );
}
