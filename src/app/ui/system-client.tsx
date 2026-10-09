"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, parseApiBody } from "@/lib/api";

function faNum(value: unknown) {
  return String(value ?? 0).replace(
    /[0-9]/g,
    (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)],
  );
}

async function send(
  endpoint: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: Record<string, unknown> | FormData,
) {
  const isForm = body instanceof FormData;
  const response = await apiFetch(endpoint, {
    method,
    credentials: "same-origin",
    headers: isForm
      ? { accept: "application/json", "accept-language": "fa" }
      : {
          "content-type": "application/json",
          accept: "application/json",
          "accept-language": "fa",
        },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  const parsed = parseApiBody(result);
  if (!response.ok) throw new Error(parsed.message ?? "درخواست انجام نشد.");
}

export function ExcelButton({ rows }: { rows: string[][] }) {
  const download = () => {
    const csv = rows
      .map((row) =>
        row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "weekly-report.csv";
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button type="button" className="sm-csv-btn" onClick={download}>
      <em className="icon ni ni-download" />
      <span>دریافت Excel</span>
    </button>
  );
}

export function GeneralSettings({
  companyName,
  hasLogo,
}: {
  companyName: string;
  hasLogo: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(companyName);
  const [preview, setPreview] = useState(
    hasLogo ? "/api/settings/branding/logo" : "/images/logo.png",
  );
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await send("/api/settings/branding", "PATCH", {
        companyName: name.trim(),
      });
      if (file) {
        const data = new FormData();
        data.set("logo", file);
        await send("/api/settings/branding/logo", "POST", data);
      }
      router.refresh();
      setMessage("تنظیمات ذخیره شد.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ذخیره انجام نشد.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="sm-general-form" onSubmit={submit}>
      <div className="sm-general-copy">
        <h2>عمومی</h2>
        <p>نام شرکت و لوگوی نمایش‌داده‌شده در هدر و منوی کناری را تنظیم کنید.</p>
      </div>
      <div className="sm-general-grid">
        <label htmlFor="company-name">
          نام شرکت
          <input
            id="company-name"
            className="form-control"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <small>این نام در مسیر بالای صفحات و کنار لوگو دیده می‌شود.</small>
        </label>
        <div className="sm-logo-field">
          <span>لوگوی شرکت</span>
          <div className="sm-logo-preview">
            <img
              className="sm-logo-preview__img"
              src={preview}
              alt="لوگوی شرکت"
            />
          </div>
          <input
            className="form-control"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const next = event.target.files?.[0] ?? null;
              setFile(next);
              if (next) setPreview(URL.createObjectURL(next));
            }}
          />
          <small>JPG، PNG یا WebP. تا یک مگابایت.</small>
        </div>
      </div>
      {message && (
        <p role="status" className="sm-save-note">
          {message}
        </p>
      )}
      <div className="sm-general-actions">
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "در حال ذخیره…" : "ذخیره تنظیمات عمومی"}
        </button>
      </div>
    </form>
  );
}

export type NamedRow = { id: string | number; name: string; slug?: string };

function OptionRows({
  rows,
  addLabel,
  addPlaceholder,
  addEndpoint,
  itemEndpoint,
  slug,
  columns,
}: {
  rows: NamedRow[];
  addLabel: string;
  addPlaceholder: string;
  addEndpoint: string;
  itemEndpoint: string;
  slug?: boolean;
  columns?: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const run = async (key: string, task: () => Promise<void>) => {
    setBusy(key);
    setMessage("");
    try {
      await task();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ذخیره انجام نشد.");
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="sm-option-block">
      <form
        className="sm-option-add"
        onSubmit={(event) => {
          event.preventDefault();
          void run("add", async () => {
            await send(addEndpoint, "POST", { name: draft.trim() });
            setDraft("");
          });
        }}
      >
        <input
          className="form-control"
          value={draft}
          placeholder={addPlaceholder}
          onChange={(event) => setDraft(event.target.value)}
          required
        />
        <button
          className="btn btn-primary"
          type="submit"
          disabled={busy === "add"}
        >
          <span>{addLabel}</span>
          <em className="icon ni ni-plus" />
        </button>
      </form>
      {columns && (
        <div className="sm-option-columns">
          <span>عنوان اولویت</span>
          <span>عملیات</span>
        </div>
      )}
      {rows.map((row) => {
        const id = String(row.id);
        const value = names[id] ?? row.name;
        return (
          <form
            className={`sm-option-row ${slug ? "" : "is-plain"}`}
            key={id}
            onSubmit={(event) => {
              event.preventDefault();
              void run(id, () =>
                send(`${itemEndpoint}/${id}`, "PATCH", { name: value.trim() }),
              );
            }}
          >
            <input
              className="form-control"
              value={value}
              aria-label="عنوان گزینه"
              onChange={(event) =>
                setNames((current) => ({
                  ...current,
                  [id]: event.target.value,
                }))
              }
              required
            />
            {slug && (
              <span className="sm-option-slug" dir="ltr">
                {row.slug}
              </span>
            )}
            <div className="sm-option-actions">
              <button
                className="btn sm-btn-ghost"
                type="submit"
                disabled={busy === id}
              >
                {busy === id ? "…" : "ذخیره"}
              </button>
              <button
                className="sm-mini-delete"
                type="button"
                disabled={busy === `del-${id}`}
                onClick={() =>
                  void run(`del-${id}`, () =>
                    send(`${itemEndpoint}/${id}`, "DELETE"),
                  )
                }
              >
                <em className="icon ni ni-trash" />
                <span>حذف</span>
              </button>
            </div>
          </form>
        );
      })}
      {message && (
        <p role="alert" className="sm-row-error">
          {message}
        </p>
      )}
    </div>
  );
}

export function KpiOptionGroups({
  inputModes,
  directions,
  frequencies,
}: {
  inputModes: NamedRow[];
  directions: NamedRow[];
  frequencies: NamedRow[];
}) {
  return (
    <div className="sm-settings-section">
      <p className="sm-settings-lead">
        گزینه‌های این فهرست در پاپ‌آپ ساخت KPI به‌عنوان لیست بازشو دیده می‌شوند.
      </p>
      <section>
        <h2>نوع ورودی</h2>
        <p>در پاپ‌آپ ساخت KPI در فهرست نوع ورودی دیده می‌شود.</p>
        <OptionRows
          rows={inputModes}
          addLabel="افزودن"
          addPlaceholder="مثلاً ماهانه"
          addEndpoint="/api/kpis/options/input_mode"
          itemEndpoint="/api/kpis/options"
          slug
        />
      </section>
      <section>
        <h2>جهت مطلوب</h2>
        <p>برای محاسبه سلامت، «بیشتر بهتر» و «کمتر بهتر» را نگه دارید.</p>
        <OptionRows
          rows={directions}
          addLabel="افزودن"
          addPlaceholder="مثلاً ماهانه"
          addEndpoint="/api/kpis/options/direction"
          itemEndpoint="/api/kpis/options"
          slug
        />
      </section>
      <section>
        <h2>تناوب</h2>
        <p>دوره‌های ثبت داده مثل هفتگی یا ماهانه.</p>
        <OptionRows
          rows={frequencies}
          addLabel="افزودن"
          addPlaceholder="مثلاً ماهانه"
          addEndpoint="/api/kpis/options/frequency"
          itemEndpoint="/api/kpis/options"
          slug
        />
      </section>
    </div>
  );
}

export function PriorityEditor({ rows }: { rows: NamedRow[] }) {
  return (
    <div className="sm-settings-section">
      <h2>اولویت اقدام</h2>
      <p>
        هر عنوانی که اینجا بگذارید، در پاپ‌آپ ساخت اقدام به‌عنوان اولویت دیده
        می‌شود.
      </p>
      <OptionRows
        rows={rows}
        addLabel="افزودن اولویت"
        addPlaceholder="مثلاً فوری"
        addEndpoint="/api/actions/priorities"
        itemEndpoint="/api/actions/priorities"
        columns
      />
    </div>
  );
}

const moduleCopy: Record<string, { lead: string; depends: string }> = {
  "kpi-management": {
    lead: "تعریف شاخص‌های کلیدی عملکرد، ثبت دوره‌ای مقدار توسط پرسنل، محاسبه سلامت سبز/زرد/قرمز استودیو KPI.",
    depends: "ثبت‌های من و گزارش هفتگی در محدوده واحد سازمانی.",
  },
  "corrective-actions": {
    lead: "مدیریت هشدارها و کانبان اقدام اصلاحی؛ به کانبان اقدام‌ها از طریق قالب وصل می‌شود.",
    depends: "بدون آن‌ها هم به‌صورت مستقل کار می‌کند.",
  },
  "sms-ippanel-hub": {
    lead: "هاب اتصال به پنل پیامکی IPPanel. سایر ماژول‌ها فقط کد پترن و متغیرها را ارسال می‌کنند.",
    depends: "ارسال واقعی از این ماژول انجام می‌شود.",
  },
};

const moduleIcon: Record<string, string> = {
  "kpi-management": "ni-growth",
  "corrective-actions": "ni-check-circle",
  "sms-ippanel-hub": "ni-emails",
};

export type ModuleRow = {
  id: string | number;
  slug: string;
  name: string;
  version: string;
  isActive: boolean;
};

export function ModulesTable({ rows }: { rows: ModuleRow[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState(false);
  const active = rows.filter((row) => row.isActive).length;
  const run = async (key: string, task: () => Promise<void>) => {
    setBusy(key);
    setMessage("");
    try {
      await task();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "عملیات انجام نشد.");
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="sm-catalog-page">
      <div className="sm-catalog-head">
        <div>
          <h1>ماژول‌ها</h1>
          <p>
            {faNum(rows.length)} ماژول نصب شده، {faNum(active)} مورد فعال.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setNotice(true)}
        >
          <span>افزودن ماژول</span>
          <em className="icon ni ni-plus" />
        </button>
      </div>
      {notice && (
        <p className="sm-save-note">
          ماژول‌ها همراه سامانه ثبت می‌شوند و از این صفحه فقط فعال یا حذف می‌شوند.
        </p>
      )}
      {message && (
        <p role="alert" className="alert alert-warning">
          {message}
        </p>
      )}
      <section className="card card-bordered sm-catalog-card">
        <div className="sm-module-head">
          <span>ماژول</span>
          <span>نسخه</span>
          <span>وابستگی‌ها</span>
          <span>وضعیت</span>
          <span>عملیات</span>
        </div>
        {rows.map((row) => {
          const copy = moduleCopy[row.slug];
          return (
            <article className="sm-module-row" key={String(row.id)}>
              <div className="sm-module-name">
                <span className="sm-module-icon">
                  <em
                    className={`icon ni ${moduleIcon[row.slug] ?? "ni-puzzle"}`}
                  />
                </span>
                <span>
                  <strong>{row.name}</strong>
                  <small>{copy?.lead ?? "ماژول نصب‌شده سامانه."}</small>
                  <em>Proprietary · v{row.version} · تیم اسمارت‌لوکس</em>
                </span>
              </div>
              <span dir="ltr">{row.version}</span>
              <span>{copy?.depends ?? "وابستگی جداگانه‌ای ندارد."}</span>
              <button
                type="button"
                className={`sm-module-toggle ${row.isActive ? "is-on" : ""}`}
                disabled={busy === row.slug}
                onClick={() =>
                  void run(row.slug, () =>
                    send(`/api/modules/${row.slug}/activation`, "PATCH", {
                      active: !row.isActive,
                    }),
                  )
                }
              >
                {row.isActive ? "غیرفعال کردن" : "فعال کردن"}
              </button>
              <button
                type="button"
                className="sm-mini-delete"
                disabled={busy === `del-${row.slug}`}
                onClick={() =>
                  void run(`del-${row.slug}`, () =>
                    send(`/api/modules/${row.slug}`, "DELETE"),
                  )
                }
              >
                <em className="icon ni ni-trash" />
                <span>حذف</span>
              </button>
            </article>
          );
        })}
        {rows.length === 0 && (
          <p className="sm-users-empty">ماژولی نصب نشده است.</p>
        )}
      </section>
    </div>
  );
}

export type AuditRow = {
  id: string | number;
  actorName: string | null;
  action: string;
  description: string;
  ipAddress: string | null;
  createdAt: string;
  userId: string | number | null;
};

function eventMeta(action: string) {
  const value = action.toLowerCase();
  if (
    value.includes("fail") ||
    value.includes("invalid") ||
    value.includes("denied")
  )
    return { label: "ورود ناموفق", tone: "is-bad" };
  if (value.includes("login") || value.includes("session.created"))
    return { label: "ورود موفق", tone: "is-ok" };
  return { label: action.replaceAll(".", " "), tone: "" };
}

function stamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Tehran",
  }).formatToParts(date);
  const pick = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}/${pick("month")}/${pick("day")} ${pick("hour")}:${pick("minute")}`;
}

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  const [kind, setKind] = useState("all");
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState({ kind: "all", query: "" });
  const kinds = useMemo(
    () => ["all", ...new Set(rows.map((row) => eventMeta(row.action).label))],
    [rows],
  );
  const visible = rows.filter((row) => {
    const meta = eventMeta(row.action);
    if (applied.kind !== "all" && meta.label !== applied.kind) return false;
    const needle = applied.query.trim().toLowerCase();
    if (!needle) return true;
    return [row.actorName, row.description, row.ipAddress, row.action].some(
      (value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(needle),
    );
  });
  return (
    <div className="sm-catalog-page">
      <div className="sm-catalog-head">
        <div>
          <h1>تاریخچه و ممیزی</h1>
          <p>
            {faNum(rows.length)} رویداد ثبت شده است. ثبت تغییرپذیر نیست؛ هر
            رویداد پس از ثبت قابل ویرایش یا حذف دستی نیست.
          </p>
        </div>
      </div>
      <section className="card card-bordered sm-catalog-card">
        <form
          className="sm-audit-filters"
          onSubmit={(event) => {
            event.preventDefault();
            setApplied({ kind, query });
          }}
        >
          <label>
            نوع رویداد
            <select
              className="form-select"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              {kinds.map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "همه رویدادها" : item}
                </option>
              ))}
            </select>
          </label>
          <label>
            جستجو
            <input
              className="form-control"
              value={query}
              placeholder="شرح، نام کاربر یا نشانی IP"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button className="btn btn-primary" type="submit">
            <em className="icon ni ni-filter" />
            <span>اعمال فیلتر</span>
          </button>
        </form>
        <div className="sm-audit-head">
          <span>کاربر</span>
          <span>رویداد</span>
          <span>شرح</span>
          <span>نشانی IP</span>
          <span>زمان</span>
        </div>
        {visible.map((row) => {
          const meta = eventMeta(row.action);
          const guest = !row.userId && meta.tone === "is-bad";
          return (
            <article className="sm-audit-row" key={String(row.id)}>
              <strong>{guest ? "مهمان" : row.actorName || "سامانه"}</strong>
              <span className={`sm-event-pill ${meta.tone}`}>{meta.label}</span>
              <span>{row.description}</span>
              <span dir="ltr">{row.ipAddress || "—"}</span>
              <span>{stamp(row.createdAt)}</span>
            </article>
          );
        })}
        {visible.length === 0 && (
          <p className="sm-users-empty">رویدادی با این فیلتر پیدا نشد.</p>
        )}
      </section>
    </div>
  );
}
