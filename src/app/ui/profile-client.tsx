"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { parseApiBody } from "@/lib/api";

export type ProfileUser = {
  id: string;
  firstName: string;
  lastName: string;
  mobile: string;
  nationalCode: string;
  birthDate: string;
  address: string;
  jobTitle: string;
  roleLabel: string;
  departmentLabel: string;
  avatarSrc: string | null;
};

function latinDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

async function send(
  endpoint: string,
  method: "POST" | "PATCH",
  body: BodyInit,
  json: boolean,
) {
  const response = await fetch(endpoint, {
    method,
    credentials: "same-origin",
    headers: json
      ? {
          "content-type": "application/json",
          accept: "application/json",
          "accept-language": "fa",
        }
      : { accept: "application/json", "accept-language": "fa" },
    body,
  });
  const parsed = parseApiBody<{ message?: string }>(
    await response.json().catch(() => ({})),
  );
  if (!response.ok) {
    const detail = parsed.errors
      ? Object.values(parsed.errors).flat()[0]
      : undefined;
    throw new Error(detail ?? parsed.message ?? "درخواست انجام نشد.");
  }
  return (
    parsed.message ?? parsed.payload?.message ?? "درخواست با موفقیت انجام شد."
  );
}

function Field({
  label,
  children,
  hint,
  marked = true,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  marked?: boolean;
}) {
  return (
    <div className="form-group">
      <label className="form-label">
        {marked && <span className="req">*</span>}
        {label}
      </label>
      {children}
      {hint && <span className="form-note">{hint}</span>}
    </div>
  );
}

export function PersonalForm({ user }: { user: ProfileUser }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const text = await send(
        "/api/users/me",
        "PATCH",
        JSON.stringify({
          firstName: String(data.get("firstName") ?? "").trim(),
          lastName: String(data.get("lastName") ?? "").trim(),
          nationalCode: latinDigits(
            String(data.get("nationalCode") ?? "").trim(),
          ),
          birthDate: latinDigits(String(data.get("birthDate") ?? "").trim()),
          address: String(data.get("address") ?? "").trim(),
        }),
        true,
      );
      setMessage(text);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "به‌روزرسانی انجام نشد.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit}>
      <div className="sm-profile-grid">
        <div className="sm-profile-band">پایه</div>
        <Field
          label="نام کاربری"
          marked={false}
          hint="نام کاربری همان شماره موبایل ورود است و قابل تغییر نیست."
        >
          <div className="sm-profile-lock" dir="ltr">
            <em className="icon ni ni-lock-alt" />
            <span>{user.mobile}</span>
          </div>
        </Field>
        <Field label="کد ملی">
          <input
            className="form-control"
            name="nationalCode"
            inputMode="numeric"
            maxLength={10}
            required
            defaultValue={user.nationalCode}
            dir="ltr"
          />
        </Field>
        <Field label="نام">
          <input
            className="form-control"
            name="firstName"
            required
            maxLength={100}
            defaultValue={user.firstName}
          />
        </Field>
        <Field label="نام خانوادگی">
          <input
            className="form-control"
            name="lastName"
            required
            maxLength={100}
            defaultValue={user.lastName}
          />
        </Field>
        <Field label="تاریخ تولد">
          <input
            className="form-control"
            name="birthDate"
            required
            placeholder="سال / ماه / روز"
            defaultValue={user.birthDate}
            dir="ltr"
          />
        </Field>
        <div className="form-group sm-profile-span">
          <label className="form-label" htmlFor="profile-address">
            <span className="req">*</span>آدرس
          </label>
          <textarea
            id="profile-address"
            className="form-control"
            name="address"
            rows={4}
            required
            maxLength={2000}
            defaultValue={user.address}
          />
        </div>
        <div className="sm-profile-band">سازمان</div>
        <div className="sm-profile-org-row">
          <span>نقش</span>
          <div className="sm-profile-lock">
            <em className="icon ni ni-lock-alt" />
            <span>{user.roleLabel}</span>
          </div>
        </div>
        <div className="sm-profile-org-row">
          <span>واحد</span>
          <div className="sm-profile-lock">
            <em className="icon ni ni-lock-alt" />
            <span>{user.departmentLabel}</span>
          </div>
        </div>
        <div className="sm-profile-org-row">
          <span>عنوان شغلی</span>
          <div className="sm-profile-lock">
            <em className="icon ni ni-lock-alt" />
            <span>{user.jobTitle || "تعیین نشده"}</span>
          </div>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-danger text-center mt-3 mb-0">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-success text-center mt-3 mb-0">
          {message}
        </p>
      )}
      <div className="sm-profile-submit">
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "در حال ذخیره…" : "به‌روزرسانی پروفایل"}
        </button>
      </div>
    </form>
  );
}

export function PhotoForm({ user }: { user: ProfileUser }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const file = (form.elements.namedItem("avatar") as HTMLInputElement)
      .files?.[0];
    if (!file) {
      setError("یک تصویر انتخاب کنید.");
      return;
    }
    if (file.size > 200 * 1024) {
      setError("حجم تصویر باید حداکثر ۲۰۰ کیلوبایت باشد.");
      return;
    }
    const body = new FormData();
    body.set("avatar", file);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await send("/api/users/me/avatar", "POST", body, false);
      window.location.assign("/profile/photo");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "تغییر عکس انجام نشد.",
      );
      setBusy(false);
    }
  };
  return (
    <form className="sm-profile-photo" onSubmit={submit}>
      <div className="sm-profile-photo-current">
        <div>
          <strong>
            {[user.firstName, user.lastName].filter(Boolean).join(" ") ||
              "کاربر"}
          </strong>
          <small>
            JPG، PNG یا WEBP. حداکثر ۲۰۰ کیلوبایت، حداکثر ۲۰۰×۲۰۰ پیکسل.
          </small>
        </div>
        {user.avatarSrc ? (
          <img src={user.avatarSrc} alt="" />
        ) : (
          <span className="sm-profile-avatar">{initials(user)}</span>
        )}
      </div>
      <div className="sm-profile-photo-change">
        <h2>تغییر عکس</h2>
        <p>JPG، PNG یا WEBP. حداکثر ۲۰۰ کیلوبایت، حداکثر ۲۰۰×۲۰۰ پیکسل.</p>
        <label className="form-label" htmlFor="profile-avatar">
          انتخاب تصویر
        </label>
        <input
          id="profile-avatar"
          className="form-control"
          name="avatar"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
        />
        {fileName && <span className="form-note">{fileName}</span>}
        <small className="form-note">
          JPG، PNG یا WEBP. حداکثر ۲۰۰ کیلوبایت، حداکثر ۲۰۰×۲۰۰ پیکسل.
        </small>
      </div>
      {error && (
        <p role="alert" className="text-danger mt-3 mb-0">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-success mt-3 mb-0">
          {message}
        </p>
      )}
      <div className="sm-profile-submit">
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "در حال تغییر…" : "تغییر عکس"}
        </button>
      </div>
    </form>
  );
}

function initials(user: ProfileUser) {
  return (
    [user.firstName, user.lastName]
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("") || "؟"
  );
}

function Secret({
  name,
  label,
  autoComplete,
}: {
  name: string;
  label: string;
  autoComplete: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <Field label={label}>
      <div className="sm-profile-secret">
        <input
          className="form-control"
          name={name}
          type={shown ? "text" : "password"}
          required
          minLength={name === "current_password" ? 1 : 8}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          aria-label={shown ? "پنهان کردن رمز" : "نمایش رمز"}
          onClick={() => setShown((value) => !value)}
        >
          <em className={`icon ni ${shown ? "ni-eye-off" : "ni-eye"}`} />
        </button>
      </div>
    </Field>
  );
}

export function SecurityForm({ twoFactor }: { twoFactor: boolean }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const text = await send(
        "/api/users/me/password",
        "POST",
        JSON.stringify({
          current_password: String(data.get("current_password") ?? ""),
          password: String(data.get("password") ?? ""),
          password_confirmation: String(
            data.get("password_confirmation") ?? "",
          ),
        }),
        true,
      );
      form.reset();
      setMessage(text);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "تغییر رمز انجام نشد.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="sm-profile-factor">
        <div>
          <strong>ورود دو مرحله‌ای</strong>
          <span className={twoFactor ? "is-on" : ""}>
            {twoFactor ? "فعال" : "غیرفعال"}
          </span>
        </div>
        <p>
          این وضعیت از سیاست ورود سامانه می‌آید و از پروفایل قابل تغییر نیست.
        </p>
      </div>
      <form className="sm-profile-security" onSubmit={submit}>
        <h2>تغییر رمز عبور</h2>
        <p>یک رمز یکتا برای محافظت از حساب خود تنظیم کنید.</p>
        <div className="sm-profile-grid">
          <div className="sm-profile-span">
            <Secret
              name="current_password"
              label="رمز عبور فعلی"
              autoComplete="current-password"
            />
          </div>
          <Secret
            name="password"
            label="رمز عبور جدید"
            autoComplete="new-password"
          />
          <Secret
            name="password_confirmation"
            label="تکرار رمز عبور جدید"
            autoComplete="new-password"
          />
        </div>
        <small className="form-note">حداقل ۸ کاراکتر شامل حرف و عدد.</small>
        {error && (
          <p role="alert" className="text-danger mt-3 mb-0">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="text-success mt-3 mb-0">
            {message}
          </p>
        )}
        <div className="sm-profile-submit">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "در حال تغییر…" : "تغییر رمز عبور"}
          </button>
        </div>
      </form>
    </>
  );
}
