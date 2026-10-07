"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { parseApiBody } from "@/lib/api";

export type AuthField = {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  full?: boolean;
  options?: string[];
  value?: string;
};

export function DemoForm({
  fields,
  submitLabel,
  endpoint,
  method = "POST",
  redirectTo,
  disabled = false,
}: {
  fields: AuthField[];
  submitLabel: string;
  endpoint?: string;
  method?: "POST" | "PATCH";
  redirectTo?: string;
  feedback?: string;
  disabled?: boolean;
}) {
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity() || !endpoint) return;
    setBusy(true);
    setMessage("");
    setErrors({});
    const data = new FormData(form);
    const hasFile = fields.some((field) => field.type === "file");
    const payload = Object.fromEntries(
      fields.map((field) => [
        field.name,
        field.type === "checkbox"
          ? data.get(field.name) === "on"
          : field.type === "multiselect"
            ? data.getAll(field.name).map(String)
            : String(data.get(field.name) ?? ""),
      ]),
    );
    try {
      const response = await fetch(endpoint, {
        method,
        credentials: "same-origin",
        headers: hasFile
          ? { accept: "application/json" }
          : { "content-type": "application/json", accept: "application/json" },
        body: hasFile ? data : JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      const parsed = parseApiBody<{
        twoFactorRequired?: boolean;
        message?: string;
      }>(result);
      if (!response.ok) {
        setErrors(parsed.errors ?? {});
        setMessage(
          parsed.message ??
            (response.status >= 500
              ? "سرویس در دسترس نیست. API را روی پورت ۴۰۰۰ اجرا کنید."
              : "درخواست انجام نشد."),
        );
        return;
      }
      if (
        parsed.payload?.twoFactorRequired === true ||
        (result as { twoFactorRequired?: boolean }).twoFactorRequired === true
      ) {
        window.location.assign("/two-factor");
        return;
      }
      if (redirectTo) {
        window.location.assign(redirectTo);
        return;
      }
      setMessage(
        parsed.message ??
          parsed.payload?.message ??
          "درخواست با موفقیت انجام شد.",
      );
      form.reset();
    } catch {
      setMessage(
        "ارتباط با سرور برقرار نشد. اتصال را بررسی و دوباره تلاش کنید.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="is-alter" autoComplete="on" onSubmit={submit}>
      {fields.map((field) => (
        <div
          className={`form-group block ${field.full ? "col-span-2" : ""}`}
          key={field.name}
        >
          {field.type !== "checkbox" && (
            <label className="form-label" htmlFor={field.name}>
              {field.label}
              {field.required && <b className="text-danger me-1">*</b>}
            </label>
          )}
          {field.type === "textarea" ? (
            <textarea
              id={field.name}
              className="form-control form-control-lg"
              name={field.name}
              rows={3}
              placeholder={field.placeholder}
              required={field.required}
              defaultValue={field.value}
              aria-invalid={Boolean(errors[field.name])}
            />
          ) : field.type === "select" || field.type === "multiselect" ? (
            <select
              id={field.name}
              className="form-select form-control-lg"
              name={field.name}
              required={field.required}
              multiple={field.type === "multiselect"}
              defaultValue={
                field.type === "multiselect"
                  ? (field.value ?? "").split(",").filter(Boolean)
                  : (field.value ?? "")
              }
            >
              <option value="" disabled>
                انتخاب کنید
              </option>
              {field.options?.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          ) : field.type === "checkbox" ? (
            <span className="custom-control custom-control-sm custom-checkbox">
              <input
                type="checkbox"
                id={field.name}
                name={field.name}
                className="custom-control-input"
                defaultChecked={field.value === "true"}
              />
              <label className="custom-control-label" htmlFor={field.name}>
                {field.placeholder}
              </label>
            </span>
          ) : (
            <input
              id={field.name}
              className={`form-control form-control-lg ${field.type === "tel" || field.name.includes("code") || field.name.includes("national") ? "text-center" : ""}`}
              dir={
                field.type === "tel" ||
                field.name.includes("code") ||
                field.name.includes("national")
                  ? "ltr"
                  : undefined
              }
              type={field.type === "date" ? "text" : (field.type ?? "text")}
              name={field.name}
              inputMode={
                field.type === "tel" ||
                field.name.includes("code") ||
                field.name.includes("national")
                  ? "numeric"
                  : undefined
              }
              placeholder={field.placeholder}
              required={field.required}
              accept={
                field.type === "file"
                  ? "image/jpeg,image/png,image/webp"
                  : undefined
              }
              maxLength={
                field.name.includes("mobile")
                  ? 11
                  : field.name.includes("code")
                    ? 8
                    : field.name.includes("national")
                      ? 10
                      : undefined
              }
              autoComplete={
                field.type === "password"
                  ? "current-password"
                  : field.type === "tel"
                    ? "username"
                    : undefined
              }
              defaultValue={field.type === "file" ? undefined : field.value}
              aria-invalid={Boolean(errors[field.name])}
            />
          )}
          {field.hint && (
            <span className="form-note mt-1 block">{field.hint}</span>
          )}
          {errors[field.name]?.map((error) => (
            <span
              className="form-note text-danger mt-1 block"
              role="alert"
              key={error}
            >
              {error}
            </span>
          ))}
        </div>
      ))}
      {message && (
        <div
          role="alert"
          className={`alert alert-fill ${Object.keys(errors).length ? "alert-danger" : "alert-success"}`}
        >
          {message}
        </div>
      )}
      <div className="form-group">
        <button
          type="submit"
          className="btn btn-lg btn-primary btn-block"
          disabled={disabled || busy || !endpoint}
        >
          {busy ? "در حال ارسال…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

export function AuthFrame({
  title,
  heading,
  subheading,
  children,
  footnote,
}: {
  title: string;
  heading: string;
  subheading: string;
  children: React.ReactNode;
  footnote?: React.ReactNode;
}) {
  return (
    <div className="brand-auth">
      <section className="brand-auth__intro">
        <img
          className="brand-auth__mark"
          src="/images/logo.png"
          alt="اسمارت منیجر"
        />
        <span className="brand-auth__eyebrow">SMART MANAGER</span>
        <h1>هسته مدیریت هوشمند سازمان شما</h1>
        <p>
          ورود، کاربران، دسترسی‌ها و ماژول‌ها در یک فضای واحد با هویت اسمارت
          منیجر.
        </p>
        <div className="brand-auth__path" aria-hidden="true">
          <span>ورود</span>
          <span>نقش‌ها</span>
          <span>ماژول‌ها</span>
          <span>عملیات</span>
        </div>
      </section>
      <section className="brand-auth__panel">
        <div className="brand-auth__card">
          <Link href="/dashboard" className="d-block text-center">
            <img
              className="brand-auth__wordmark"
              src="/images/logo-dark.png"
              srcSet="/images/logo-dark2x.png 2x"
              alt="اسمارت منیجر"
            />
          </Link>
          <div className="nk-block-head">
            <div className="nk-block-head-content">
              <h4 className="nk-block-title">{heading}</h4>
              <div className="nk-block-des">
                <p>{subheading}</p>
              </div>
            </div>
          </div>
          {children}
          {footnote && (
            <div className="form-note-s2 pt-4 text-center">{footnote}</div>
          )}
          <p className="brand-auth__footnote">
            © ۱۴۰۵ اسمارت منیجر — تمام حقوق محفوظ است.
          </p>
          <span className="sr-only">{title}</span>
        </div>
      </section>
    </div>
  );
}

export function LocalSignoutForm() {
  return (
    <DemoForm
      fields={[]}
      submitLabel="خروج از حساب"
      endpoint="/api/auth/logout"
      redirectTo="/login"
    />
  );
}

export function ModuleToggle({
  slug,
  active,
}: {
  slug: string;
  active: boolean;
}) {
  const [enabled, setEnabled] = useState(active);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/modules/${encodeURIComponent(slug)}/activation`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({ active: !enabled }),
        },
      );
      const result = await response.json().catch(() => ({}));
      const parsed = parseApiBody(result);
      if (!response.ok) {
        setMessage(parsed.message ?? "تغییر وضعیت انجام نشد.");
        return;
      }
      setEnabled(!enabled);
      setMessage("وضعیت ذخیره شد.");
    } catch {
      setMessage("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <button
        type="button"
        className={`btn btn-sm ${enabled ? "btn-dim btn-warning" : "btn-dim btn-success"}`}
        disabled={busy}
        onClick={toggle}
      >
        {busy ? "در حال ذخیره…" : enabled ? "غیرفعال‌سازی" : "فعال‌سازی"}
      </button>
      {message && (
        <span className="form-note ms-2" role="status">
          {message}
        </span>
      )}
    </div>
  );
}

export function AvatarRemoveButton() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/users/me/avatar", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });
      const result = await response.json().catch(() => ({}));
      const parsed = parseApiBody(result);
      if (!response.ok) {
        setMessage(parsed.message ?? "حذف تصویر انجام نشد.");
        return;
      }
      setMessage("تصویر پروفایل حذف شد.");
      window.location.reload();
    } catch {
      setMessage("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-3">
      <button
        type="button"
        className="btn btn-dim btn-danger"
        onClick={remove}
        disabled={busy}
      >
        {busy ? "در حال حذف…" : "حذف تصویر پروفایل"}
      </button>
      {message && (
        <span className="form-note ms-2" role="status">
          {message}
        </span>
      )}
    </div>
  );
}

export function AuthResendButton() {
  const [message, setMessage] = useState("");
  const resend = async () => {
    setMessage("");
    try {
      const response = await fetch("/api/auth/two-factor/resend", {
        method: "POST",
        credentials: "same-origin",
        headers: { "accept-language": "fa" },
      });
      const result = await response.json().catch(() => ({}));
      const parsed = parseApiBody(result);
      setMessage(
        response.ok
          ? "کد تازه ارسال شد."
          : (parsed.message ?? "ارسال کد انجام نشد."),
      );
    } catch {
      setMessage("ارتباط با سرور برقرار نشد.");
    }
  };
  return (
    <>
      <button className="btn btn-link" type="button" onClick={resend}>
        ارسال دوباره کد
      </button>
      {message && (
        <span role="status" className="block text-soft text-xs">
          {message}
        </span>
      )}
    </>
  );
}

export function CancelTwoFactorButton() {
  const cancel = async () => {
    await fetch("/api/auth/two-factor/cancel", {
      method: "POST",
      credentials: "same-origin",
    }).catch(() => undefined);
    window.location.assign("/login");
  };
  return (
    <button className="btn btn-link text-soft" type="button" onClick={cancel}>
      انصراف و بازگشت به ورود
    </button>
  );
}
