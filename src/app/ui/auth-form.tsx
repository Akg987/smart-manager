"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useState, type FormEvent } from "react";
import { apiFetch, parseApiBody } from "@/lib/api";

export type AuthField = {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  full?: boolean;
  options?: (string | { value: string; label: string })[];
  value?: string;
};

export function DemoForm({
  fields,
  submitLabel,
  endpoint,
  method = "POST",
  redirectTo,
  redirectToNext = false,
  includeInvitationToken = false,
  disabled = false,
  redirectOnCreate = false,
}: {
  fields: AuthField[];
  submitLabel: string;
  endpoint?: string;
  method?: "POST" | "PATCH";
  redirectTo?: string;
  redirectToNext?: boolean;
  includeInvitationToken?: boolean;
  feedback?: string;
  disabled?: boolean;
  redirectOnCreate?: boolean;
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
    const payload: Record<string, unknown> = Object.fromEntries(
      fields.map((field) => [
        field.name,
        field.type === "checkbox"
          ? data.get(field.name) === "on"
          : field.type === "number"
            ? data.get(field.name) === ""
              ? null
              : Number(data.get(field.name))
            : field.type === "multiselect"
              ? data.getAll(field.name).map(String)
              : String(data.get(field.name) ?? ""),
      ]),
    );
    if (Object.hasOwn(payload, "inputOptions")) {
      payload.inputOptions = String(payload.inputOptions ?? "")
        .split(/[,،]/)
        .map((value) => value.trim())
        .filter(Boolean);
    }
    if (
      Object.hasOwn(payload, "rangeMinimum") ||
      Object.hasOwn(payload, "rangeMaximum")
    ) {
      const minimum =
        payload.rangeMinimum === "" || payload.rangeMinimum == null
          ? null
          : Number(payload.rangeMinimum);
      const maximum =
        payload.rangeMaximum === "" || payload.rangeMaximum == null
          ? null
          : Number(payload.rangeMaximum);
      delete payload.rangeMinimum;
      delete payload.rangeMaximum;
      if (minimum !== null && maximum !== null)
        payload.rangeConfig = { minimum, maximum };
    }
    const invitationToken = includeInvitationToken
      ? new URLSearchParams(window.location.search).get("invitation")
      : null;
    if (invitationToken) payload.invitationToken = invitationToken;
    const next = new URLSearchParams(window.location.search).get("next");
    const safeNext =
      next?.startsWith("/") && !next.startsWith("//") ? next : null;
    try {
      const response = await apiFetch(endpoint, {
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
        window.location.assign(
          safeNext
            ? `/two-factor?next=${encodeURIComponent(safeNext)}`
            : "/two-factor",
        );
        return;
      }
      const createdId = (parsed.payload as { id?: string | number } | undefined)
        ?.id;
      if (redirectOnCreate && method === "POST" && createdId != null) {
        window.location.assign(
          `/kpis/${encodeURIComponent(String(createdId))}`,
        );
        return;
      }
      const destination = redirectToNext && safeNext ? safeNext : redirectTo;
      if (destination) {
        window.location.assign(destination);
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
    <form className="space-y-4" autoComplete="on" onSubmit={submit}>
      {fields.map((field) => (
        <div
          className={`block space-y-1.5 ${field.full ? "col-span-2" : ""}`}
          key={field.name}
        >
          {field.type !== "checkbox" && (
            <label className="text-sm font-medium text-brand-ink" htmlFor={field.name}>
              {field.label}
              {field.required && <b className="me-1 text-rose-600">*</b>}
            </label>
          )}
          {field.type === "textarea" ? (
            <textarea
              id={field.name}
              className="min-h-24 w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-copper/30"
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
              className="h-10 w-full rounded-md border border-brand-line bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-copper/30"
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
              {field.options?.map((option) => {
                const value =
                  typeof option === "string" ? option : option.value;
                const label =
                  typeof option === "string" ? option : option.label;
                return (
                  <option key={value} value={value}>
                    {label}
                  </option>
                );
              })}
            </select>
          ) : field.type === "checkbox" ? (
            <label className="flex items-center gap-2 text-sm text-brand-muted">
              <input
                type="checkbox"
                id={field.name}
                name={field.name}
                className="size-4 accent-brand-copper"
                defaultChecked={field.value === "true"}
              />
              <span>
                {field.placeholder}
              </span>
            </label>
          ) : (
            <input
              id={field.name}
              className={`h-11 w-full rounded-md border border-brand-line bg-white px-3 text-sm outline-none placeholder:text-slate-400 focus-visible:border-brand-copper focus-visible:ring-4 focus-visible:ring-brand-copper/10 ${field.type === "tel" || field.name.includes("code") || field.name.includes("national") ? "text-center" : ""}`}
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
            <span className="mt-1 block text-xs text-brand-muted">{field.hint}</span>
          )}
          {errors[field.name]?.map((error) => (
            <span
              className="mt-1 block text-xs text-rose-600"
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
          className={`rounded-md border px-3 py-2 text-sm ${Object.keys(errors).length ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
        >
          {message}
        </div>
      )}
      <div>
        <Button
          type="submit"
          className="h-11 w-full bg-brand-copper text-white hover:bg-brand-muted"
          disabled={disabled || busy || !endpoint}
        >
          {busy ? "در حال ارسال…" : submitLabel}
        </Button>
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
    <div className="grid min-h-screen bg-brand-canvas lg:grid-cols-[minmax(0,1fr)_minmax(28rem,0.9fr)]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-brand-ink p-12 text-white lg:flex">
        <img
          className="mb-12 h-14 w-auto object-contain object-right"
          src="/images/logo.png"
          alt="اسمارت منیجر"
        />
        <span className="text-xs font-semibold tracking-[0.25em] text-brand-gold">SMART MANAGER</span>
        <h1 className="mt-5 max-w-lg text-4xl font-bold leading-tight">هسته مدیریت هوشمند سازمان شما</h1>
        <p className="mt-4 max-w-lg text-base leading-8 text-white/70">
          ورود، کاربران، دسترسی‌ها و ماژول‌ها در یک فضای واحد با هویت اسمارت
          منیجر.
        </p>
        <div className="mt-12 flex flex-wrap gap-3 text-sm text-white/70" aria-hidden="true">
          <span>ورود</span>
          <span>نقش‌ها</span>
          <span>ماژول‌ها</span>
          <span>عملیات</span>
        </div>
      </section>
      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-lg rounded-2xl border border-brand-line bg-white p-6 shadow-xl shadow-brand-ink/5 sm:p-10">
          <Link href="/dashboard" className="mb-8 block text-center">
            <img
              className="mx-auto h-10 w-auto object-contain"
              src="/images/logo-dark.png"
              srcSet="/images/logo-dark2x.png 2x"
              alt="اسمارت منیجر"
            />
          </Link>
          <div className="mb-6">
            <h2 className="text-xl font-bold text-brand-ink">{heading}</h2>
            <p className="mt-2 text-sm leading-6 text-brand-muted">{subheading}</p>
          </div>
          {children}
          {footnote && (
            <div className="pt-4 text-center text-sm text-brand-muted">{footnote}</div>
          )}
          <p className="mt-8 border-t border-brand-line pt-5 text-center text-xs text-brand-muted">
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
      const response = await apiFetch(
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
      <Button
        type="button"
        variant={enabled ? "outline" : "default"}
        size="sm"
        className={enabled ? "border-amber-300 text-amber-800" : "bg-emerald-700 text-white"}
        disabled={busy}
        onClick={toggle}
      >
        {busy ? "در حال ذخیره…" : enabled ? "غیرفعال‌سازی" : "فعال‌سازی"}
      </Button>
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
      const response = await apiFetch("/api/users/me/avatar", {
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
      <Button
        type="button"
        variant="destructive"
        onClick={remove}
        disabled={busy}
      >
        {busy ? "در حال حذف…" : "حذف تصویر پروفایل"}
      </Button>
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
      const response = await apiFetch("/api/auth/two-factor/resend", {
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
      <Button variant="ghost" className="px-0 text-brand-copper" type="button" onClick={resend}>
        ارسال دوباره کد
      </Button>
      {message && (
          <span role="status" className="block text-xs text-brand-muted">
          {message}
        </span>
      )}
    </>
  );
}

export function CancelTwoFactorButton() {
  const cancel = async () => {
    await apiFetch("/api/auth/two-factor/cancel", {
      method: "POST",
      credentials: "same-origin",
    }).catch(() => undefined);
    window.location.assign("/login");
  };
  return (
    <Button variant="ghost" className="px-0 text-brand-muted" type="button" onClick={cancel}>
      انصراف و بازگشت به ورود
    </Button>
  );
}
