"use client";

import Link from "next/link";
import { Can } from "@/contexts/auth-context";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, parseApiBody } from "@/lib/api";

type Row = Record<string, unknown>;
const widgetTypes = [
  "kpi_card",
  "trend_chart",
  "line_chart",
  "bar_chart",
  "comparison",
  "progress",
  "table",
  "red_flag_list",
  "action_list",
  "decision_list",
  "data_quality",
  "company_scorecard",
];
const visibleWidgetType: Record<string, string> = {
  kpi_card: "کارت شاخص عملکرد",
  trend_chart: "نمودار روند",
  line_chart: "نمودار خطی",
  bar_chart: "نمودار میله‌ای",
  comparison: "مقایسه",
  progress: "پیشرفت",
  table: "جدول",
  red_flag_list: "فهرست پرچم‌های قرمز",
  action_list: "فهرست اقدام‌ها",
  decision_list: "فهرست تصمیم‌ها",
  data_quality: "کیفیت داده",
  company_scorecard: "کارنامه شرکت",
};
const visibleEnum: Record<string, string> = {
  draft: "پیش‌نویس",
  published: "منتشرشده",
  pending: "در انتظار بررسی",
  reviewed: "بازبینی‌شده",
  submitted: "ثبت‌شده",
  approved: "تأییدشده",
  rejected: "ردشده",
  proposed: "پیشنهادی",
  completed: "تکمیل‌شده",
  acknowledged: "دیده‌شده",
  resolved: "رسیدگی‌شده",
  active: "فعال",
  inactive: "غیرفعال",
  open: "باز",
  closed: "بسته",
  in_progress: "در حال اجرا",
  result_review: "بازبینی نتیجه",
  communicated: "ابلاغ‌شده",
  cancelled: "لغوشده",
  critical: "بحرانی",
  high: "زیاد",
  medium: "متوسط",
  low: "کم",
  severity: "شدت",
  amount: "مبلغ",
  duration: "مدت‌زمان",
  delay: "تأخیر",
  missing_data: "دادهٔ ثبت‌نشده",
  data_missing: "دادهٔ ثبت‌نشده",
  no_response: "بی‌پاسخی",
  wbr: "مرور هفتگی",
  mbr: "مرور ماهانه",
};
const card =
  "rounded-xl border border-brand-line bg-card p-5 text-card-foreground shadow-sm";
const field =
  "w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60";
const button =
  "inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
const outlineButton =
  "inline-flex min-h-9 items-center justify-center rounded-md border border-input bg-white px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
const compactOutlineButton =
  "inline-flex min-h-8 items-center justify-center rounded-md border border-input bg-white px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

function rows(value: unknown): Row[] {
  if (Array.isArray(value)) return value as Row[];
  if (value && typeof value === "object") {
    const r = value as Row;
    for (const key of [
      "data",
      "items",
      "rows",
      "dashboards",
      "formulas",
      "meetings",
      "decisions",
      "rules",
      "policies",
      "widgets",
      "snapshot",
    ]) {
      if (Array.isArray(r[key])) return r[key] as Row[];
    }
  }
  return [];
}
function object(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : {};
}
function id(row: Row) {
  return String(row.id ?? row.kpiId ?? "");
}
function display(value: unknown) {
  return value == null || value === ""
    ? "—"
    : typeof value === "object"
      ? JSON.stringify(value)
      : (visibleEnum[String(value)] ?? String(value));
}

function useApi() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const call = useCallback(
    async (url: string, method = "GET", body?: unknown) => {
      setBusy(true);
      setError("");
      setNotice("");
      try {
        const response = await apiFetch(url, {
          method,
          headers: {
            "content-type": "application/json",
            "accept-language": "fa",
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const raw = await response.json().catch(() => null);
        const parsed = parseApiBody<unknown>(raw);
        if (!response.ok)
          throw new Error(
            parsed.message || `درخواست ناموفق بود (${response.status})`,
          );
        setNotice(parsed.message || "با موفقیت ذخیره شد.");
        return parsed.payload;
      } catch (e) {
        setError(e instanceof Error ? e.message : "خطای ارتباط با سرور");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [],
  );
  return { call, busy, error, notice };
}

function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className={card}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
function Feedback({ error, notice }: { error: string; notice: string }) {
  return (
    <>
      {error && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {notice && !error && (
        <p role="status" className="rounded-md bg-muted p-3 text-sm">
          {notice}
        </p>
      )}
    </>
  );
}
function ItemList({
  items,
  empty = "موردی برای نمایش نیست.",
}: {
  items: Row[];
  empty?: string;
}) {
  if (!items.length)
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="divide-y">
      {items.map((item, i) => (
        <div
          key={id(item) || i}
          className="flex flex-wrap items-center justify-between gap-3 py-3"
        >
          <div>
            <strong>
              {display(
                item.name ??
                  item.title ??
                  item.code ??
                  item.decisionText ??
                  item.type,
              )}
            </strong>
            <p className="mt-1 text-xs text-muted-foreground">
              {display(item.status)}{" "}
              {item.period ? `· ${display(item.period)}` : ""}
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {display(item.version ?? item.id)}
          </span>
        </div>
      ))}
    </div>
  );
}

function Dashboards() {
  const { call, busy, error, notice } = useApi();
  const [items, setItems] = useState<Row[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState("company");
  const [visibility, setVisibility] = useState("private");
  const [widgets, setWidgets] = useState<
    {
      type: string;
      title: string;
      config: Row;
      positionX: number;
      positionY: number;
      width: number;
      height: number;
    }[]
  >([]);
  const [widgetType, setWidgetType] = useState(widgetTypes[0]);
  const [kpis, setKpis] = useState<Row[]>([]);
  const [selectedKpi, setSelectedKpi] = useState("");
  const [active, setActive] = useState<Row | null>(null);
  const [mode, setMode] = useState("view");
  const [period, setPeriod] = useState("");
  const reload = useCallback(
    async () => setItems(rows(await call("/api/dashboard/boards"))),
    [call],
  );
  useEffect(() => {
    void reload();
    void call("/api/formulas/source-kpis").then((v) => setKpis(rows(v)));
  }, [reload, call]);
  const open = async (item: Row, nextMode = "view") => {
    const v = await call(`/api/dashboard/boards/${id(item)}?mode=${nextMode}`);
    if (v) {
      setActive(object(v));
      setMode(nextMode);
    }
  };
  const addWidget = () => {
    setWidgets((v) => [
      ...v,
      {
        type: widgetType,
        title: visibleWidgetType[widgetType] ?? widgetType,
        config: selectedKpi
          ? { kpiIds: [selectedKpi], period: period || undefined }
          : {},
        positionX: 0,
        positionY: v.length * 3,
        width: 6,
        height: 3,
      },
    ]);
  };
  const save = async () => {
    const payload = { name, type, visibility, widgets };
    const v = await call("/api/dashboard/boards", "POST", payload);
    if (v) {
      setName("");
      setWidgets([]);
      await reload();
    }
  };
  const update = async () => {
    if (!active) return;
    const boardId = id(active);
    const widgetRows = rows(active.widgets).map((w, i) => ({
      ...w,
      positionY: Number(w.positionY ?? i * 3),
    }));
    const v = await call(`/api/dashboard/boards/${boardId}`, "PUT", {
      name: String(active.name ?? ""),
      widgets: widgetRows,
    });
    if (v) await open({ id: boardId }, "edit");
  };
  const publish = async () => {
    if (active) {
      await call(`/api/dashboard/boards/${id(active)}/publish`, "POST", {});
      await open(active, "view");
      await reload();
    }
  };
  const duplicate = async () => {
    if (active) {
      const n = window.prompt("نام داشبورد جدید");
      if (n?.trim()) {
        await call(`/api/dashboard/boards/${id(active)}/duplicate`, "POST", {
          name: n.trim(),
        });
        await reload();
      }
    }
  };
  const selectedWidgets = useMemo(() => rows(active?.widgets), [active]);
  return (
    <div className="space-y-5" dir="rtl">
      <Feedback error={error} notice={notice} />
      <Can permission="dashboard.create">
      <Panel
        title="ساخت داشبورد"
        action={
          <Link
            className="text-sm text-primary underline"
            href="/dashboards/create"
          >
            صفحه ساخت
          </Link>
        }
      >
        <div className="grid gap-3 md:grid-cols-3">
          <input
            className={field}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="نام داشبورد"
          />
          <select
            className={field}
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="company">شرکت</option>
            <option value="holding">هلدینگ</option>
            <option value="business_unit">واحد کسب‌وکار</option>
            <option value="role">نقش</option>
            <option value="personal">شخصی</option>
          </select>
          <select
            className={field}
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
          >
            <option value="private">خصوصی</option>
            <option value="role">نقش</option>
            <option value="company">شرکت</option>
            <option value="holding">هلدینگ</option>
          </select>
        </div>
        {widgets.length > 0 && (
          <div className="grid gap-2 md:grid-cols-2">
            {widgets.map((w, i) => (
              <div
                key={`size-${i}`}
                className="flex items-center gap-2 rounded-md border border-brand-line p-2 text-xs"
              >
                <span className="min-w-0 flex-1 truncate">{w.title}</span>
                <label className="flex items-center gap-1">
                  عرض{" "}
                  <input
                    aria-label="عرض ویجت"
                    className={`${field} w-14 px-1 py-1`}
                    type="number"
                    min={1}
                    max={12}
                    value={w.width}
                    onChange={(e) =>
                      setWidgets((v) =>
                        v.map((item, j) =>
                          j === i
                            ? {
                                ...item,
                                width: Math.max(
                                  1,
                                  Math.min(12, Number(e.target.value) || 1),
                                ),
                              }
                            : item,
                        ),
                      )
                    }
                  />
                </label>
                <label className="flex items-center gap-1">
                  ارتفاع{" "}
                  <input
                    aria-label="ارتفاع ویجت"
                    className={`${field} w-14 px-1 py-1`}
                    type="number"
                    min={1}
                    max={12}
                    value={w.height}
                    onChange={(e) =>
                      setWidgets((v) =>
                        v.map((item, j) =>
                          j === i
                            ? {
                                ...item,
                                height: Math.max(
                                  1,
                                  Math.min(12, Number(e.target.value) || 1),
                                ),
                              }
                            : item,
                        ),
                      )
                    }
                  />
                </label>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <select
            className={`${field} max-w-xs`}
            value={widgetType}
            onChange={(e) => setWidgetType(e.target.value)}
          >
            {widgetTypes.map((t) => (
              <option key={t} value={t}>
                {visibleWidgetType[t] ?? t}
              </option>
            ))}
          </select>
          <select
            className={`${field} max-w-xs`}
            value={selectedKpi}
            onChange={(e) => setSelectedKpi(e.target.value)}
          >
            <option value="">انتخاب شاخص عملکرد (اختیاری)</option>
            {kpis.map((k) => (
              <option key={id(k)} value={id(k)}>
                {display(k.name)} · {display(k.code)}
              </option>
            ))}
          </select>
          <input
            className={`${field} max-w-40`}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            placeholder="دوره مثل 1405-W02"
          />
          <button
            className={outlineButton}
            type="button"
            onClick={addWidget}
          >
            افزودن ویجت
          </button>
          <button
            className={button}
            disabled={busy || !name.trim()}
            onClick={() => void save()}
          >
            ذخیره داشبورد
          </button>
        </div>
        {!!widgets.length && (
          <div className="mt-3 flex flex-wrap gap-2">
            {widgets.map((w, i) => (
              <span key={i} className="rounded-md bg-muted px-3 py-1 text-xs">
                {w.title}{" "}
                <button
                  aria-label="حذف ویجت"
                  onClick={() => setWidgets((v) => v.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </Panel>
      </Can>
      <Can permission="dashboard.view">
      <Panel title="داشبوردهای در دسترس">
        <ItemList items={items} />
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <button
              className={outlineButton}
              key={id(item)}
              onClick={() => void open(item)}
            >
              {display(item.name)} · مشاهده
            </button>
          ))}
        </div>
      </Panel>
      </Can>
      {active && (
        <Can permission="dashboard.view">
      <Panel
          title={`${display(active.name)} · ${mode}`}
          action={
            <div className="flex gap-2">
              <button
                className={compactOutlineButton}
                onClick={() => void open(active, "preview")}
              >
                پیش‌نمایش
              </button>
              <button
                className={compactOutlineButton}
                onClick={() => void open(active, "edit")}
              >
                ویرایش
              </button>
              <button
                className={compactOutlineButton}
                onClick={() => void duplicate()}
              >
                تکثیر
              </button>
              <button className={button} onClick={() => void publish()}>
                انتشار
              </button>
            </div>
          }
        >
          <div className="grid gap-3 md:grid-cols-2">
            {selectedWidgets.map((w, i) => (
              <div className="rounded-lg border border-brand-line p-4" key={id(w) || i}>
                <div className="font-medium">{display(w.title ?? w.type)}</div>
                <pre className="mt-2 overflow-auto text-xs text-muted-foreground">
                  {JSON.stringify(w.data ?? w.config ?? {}, null, 2)}
                </pre>
                {mode === "edit" && (
                  <div className="mt-2 flex gap-2">
                    <button
                      className={compactOutlineButton}
                      onClick={() =>
                        setActive((a) =>
                          a
                            ? {
                                ...a,
                                widgets: selectedWidgets.filter(
                                  (_, j) => j !== i,
                                ),
                              }
                            : a,
                        )
                      }
                    >
                      حذف
                    </button>
                    <button
                      className={compactOutlineButton}
                      onClick={() => {
                        const next = [...selectedWidgets];
                        if (i > 0)
                          [next[i - 1], next[i]] = [next[i], next[i - 1]];
                        setActive((a) => (a ? { ...a, widgets: next } : a));
                      }}
                    >
                      جابجایی بالا
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {mode === "edit" && (
            <button className={`${button} mt-4`} onClick={() => void update()}>
              ذخیره تغییرات
            </button>
          )}
        </Panel>
      </Can>
      )}
    </div>
  );
}

function Formulas() {
  const { call, busy, error, notice } = useApi();
  const [items, setItems] = useState<Row[]>([]);
  const [sources, setSources] = useState<Row[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [formula, setFormula] = useState("");
  const [unit, setUnit] = useState("عدد");
  const [periodType, setPeriodType] = useState("monthly");
  const [period, setPeriod] = useState("");
  const [validation, setValidation] = useState<Row | null>(null);
  const reload = useCallback(
    async () => setItems(rows(await call("/api/formulas"))),
    [call],
  );
  useEffect(() => {
    void reload();
    void call("/api/formulas/source-kpis").then((v) => setSources(rows(v)));
  }, [reload, call]);
  const validate = async () =>
    setValidation(
      object(
        await call("/api/formulas/validate", "POST", {
          formula,
          unit,
          periodType,
        }),
      ),
    );
  const create = async () => {
    const v = await call("/api/formulas", "POST", {
      code,
      name,
      formula,
      unit,
      periodType,
    });
    if (v) {
      setCode("");
      setName("");
      setFormula("");
      await reload();
    }
  };
  return (
    <div className="space-y-5" dir="rtl">
      <Feedback error={error} notice={notice} />
      <Can permission="formula.create">
      <Panel title="استودیوی فرمول‌ها · ساخت شاخص عملکرد مشتق‌شده">
        <div className="grid gap-3 md:grid-cols-2">
          <input
            className={field}
            placeholder="کد یکتا"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <input
            className={field}
            placeholder="نام شاخص"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className={field}
            placeholder="واحد خروجی"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          />
          <select
            className={field}
            value={periodType}
            onChange={(e) => setPeriodType(e.target.value)}
          >
            <option value="weekly">هفتگی</option>
            <option value="monthly">ماهانه</option>
            <option value="quarterly">فصلی</option>
            <option value="yearly">سالانه</option>
          </select>
        </div>
        <textarea
          className={`${field} mt-3 min-h-24 font-mono`}
          dir="ltr"
          placeholder="مثال: {REVENUE} / {CUSTOMERS}"
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          منابع مجاز:{" "}
          {sources
            .map((s) => `${display(s.code)} (${display(s.unit)})`)
            .join(" · ") || "در حال بارگذاری"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className={outlineButton}
            disabled={busy || !formula}
            onClick={() => void validate()}
          >
            اعتبارسنجی ساختار فرمول و منابع
          </button>
          <button
            className={button}
            disabled={busy || !name || !code || !formula}
            onClick={() => void create()}
          >
            ساخت نسخهٔ پیش‌نویس
          </button>
        </div>
        {validation && (
          <pre
            className="mt-3 overflow-auto rounded-md bg-muted p-3 text-xs"
            dir="ltr"
          >
            {JSON.stringify(validation, null, 2)}
          </pre>
        )}
      </Panel>
      </Can>
      <Can permission="formula.view">
      <Panel title="شاخص‌های مشتق‌شده">
        <div className="divide-y">
          {items.map((item) => (
            <div
              key={id(item)}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <strong>
                  {display(item.name)}{" "}
                  <span className="text-xs text-muted-foreground">
                    v{display(item.formulaVersion ?? item.version)}
                  </span>
                </strong>
                <div className="text-xs text-muted-foreground" dir="ltr">
                  {display(item.formula)} · {display(item.status)}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className={compactOutlineButton}
                  onClick={() =>
                    void call(`/api/formulas/${id(item)}/publish`, "POST", {})
                  }
                >
                  انتشار
                </button>
                <input
                  aria-label="دوره محاسبه"
                  className={`${field} w-36`}
                  placeholder="1405-W02"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                />
                <button
                  className={compactOutlineButton}
                  onClick={() =>
                    void call(`/api/formulas/${id(item)}/calculate`, "POST", {
                      period,
                    })
                  }
                >
                  محاسبه
                </button>
                <button
                  className={compactOutlineButton}
                  onClick={async () => {
                    const v = await call(
                      `/api/formulas/${id(item)}/drilldown?period=${encodeURIComponent(period)}`,
                    );
                    if (v) window.alert(JSON.stringify(v, null, 2));
                  }}
                >
                  ریزبینی
                </button>
              </div>
            </div>
          ))}
        </div>
        {!items.length && (
          <p className="text-sm text-muted-foreground">
            شاخص مشتق‌شده‌ای ثبت نشده است.
          </p>
        )}
      </Panel>
      </Can>
    </div>
  );
}

function Reviews() {
  const { call, busy, error, notice } = useApi();
  const [items, setItems] = useState<Row[]>([]);
  const [type, setType] = useState("wbr");
  const [period, setPeriod] = useState("");
  const [title, setTitle] = useState("");
  const reload = useCallback(
    async () => setItems(rows(await call("/api/management-reviews"))),
    [call],
  );
  useEffect(() => {
    void reload();
  }, [reload]);
  const create = async () => {
    const v = await call("/api/management-reviews", "POST", {
      type,
      period,
      title,
    });
    if (v) {
      setTitle("");
      await reload();
    }
  };
  return (
    <div className="space-y-5" dir="rtl">
      <Feedback error={error} notice={notice} />
      <Can permission="meeting.create">
      <Panel title="ساخت مرور مدیریتی هفتگی یا ماهانه">
        <div className="grid gap-3 md:grid-cols-3">
          <select
            className={field}
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="wbr">هفتگی</option>
            <option value="mbr">ماهانه</option>
          </select>
          <input
            className={field}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            placeholder={type === "wbr" ? "1405-W02" : "1405-02"}
          />
          <input
            className={field}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="عنوان جلسه"
          />
        </div>
        <button
          className={`${button} mt-3`}
          disabled={busy || !period || !title}
          onClick={() => void create()}
        >
          ساخت پیش‌نویس
        </button>
      </Panel>
      </Can>
      <Can permission="meeting.view">
      <Panel title="جلسه‌ها و گزارش‌ها">
        <div className="divide-y">
          {items.map((item) => (
            <div
              key={id(item)}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <strong>{display(item.title)}</strong>
                <p className="text-xs text-muted-foreground">
                  {display(item.type)} · {display(item.period)} ·{" "}
                  {display(item.status)}
                </p>
                <pre className="mt-2 max-h-48 overflow-auto text-xs">
                  {JSON.stringify(
                    item.snapshot ?? item.sections ?? {},
                    null,
                    2,
                  )}
                </pre>
              </div>
              <div className="flex gap-2">
                <button
                  className={compactOutlineButton}
                  onClick={() =>
                    void call(
                      `/api/management-reviews/${id(item)}/publish`,
                      `POST`,
                      {},
                    )
                  }
                >
                  انتشار
                </button>
                <button
                  className={compactOutlineButton}
                  onClick={() =>
                    void call(
                      `/api/management-reviews/${id(item)}/close`,
                      `POST`,
                      {
                        closureSummary: window.prompt("خلاصه بستن جلسه") || "",
                      },
                    )
                  }
                >
                  بستن
                </button>
                <button
                  className={compactOutlineButton}
                  onClick={async () => {
                    const v = await call(
                      `/api/management-reviews/${id(item)}/export`,
                    );
                    if (v) window.alert(JSON.stringify(v, null, 2));
                  }}
                >
                  خروجی
                </button>
              </div>
            </div>
          ))}
        </div>
        {!items.length && (
          <p className="text-sm text-muted-foreground">جلسه‌ای ثبت نشده است.</p>
        )}
      </Panel>
      </Can>
    </div>
  );
}

function Decisions() {
  const { call, busy, error, notice } = useApi();
  const [items, setItems] = useState<Row[]>([]);
  const [text, setText] = useState("");
  const [deadline, setDeadline] = useState("");
  const reload = useCallback(
    async () => setItems(rows(await call("/api/decisions"))),
    [call],
  );
  useEffect(() => {
    void reload();
  }, [reload]);
  const create = async () => {
    const v = await call("/api/decisions", "POST", {
      decisionText: text,
      deadline: new Date(`${deadline}T12:00:00`).toISOString(),
    });
    if (v) {
      setText("");
      setDeadline("");
      await reload();
    }
  };
  return (
    <div className="space-y-5" dir="rtl">
      <Feedback error={error} notice={notice} />
      <Can permission="decision.create">
      <Panel title="ثبت تصمیم">
        <textarea
          className={`${field} min-h-24`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="متن تصمیم"
        />
        <div className="mt-3 flex gap-2">
          <input
            className={field}
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
          <button
            className={button}
            disabled={busy || !text || !deadline}
            onClick={() => void create()}
          >
            ثبت پیش‌نویس
          </button>
        </div>
      </Panel>
      </Can>
      <Can permission="decision.view">
      <Panel title="پیگیری تصمیم‌ها">
        <div className="divide-y">
          {items.map((item) => (
            <div
              key={id(item)}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <strong>{display(item.decisionText)}</strong>
                <p className="text-xs text-muted-foreground">
                  {display(item.status)} · موعد {display(item.deadline)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded border px-3 py-1 text-sm"
                  onClick={() =>
                    void call(`/api/decisions/${id(item)}/approve`, `POST`, {})
                  }
                >
                  تأیید
                </button>
                <select
                  aria-label="تغییر وضعیت"
                  className={`${field} w-auto`}
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value)
                      void call(`/api/decisions/${id(item)}/status`, `PATCH`, {
                        status: e.target.value,
                        closureEvidence:
                          e.target.value === "closed"
                            ? window.prompt("شواهد بستن تصمیم")
                            : undefined,
                      });
                  }}
                >
                  <option value="">وضعیت...</option>
                  <option value="communicated">ابلاغ‌شده</option>
                  <option value="in_progress">در حال اجرا</option>
                  <option value="result_review">بازبینی نتیجه</option>
                  <option value="closed">بسته</option>
                  <option value="cancelled">لغو</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </Panel>
      </Can>
    </div>
  );
}

function Automation() {
  const { call, busy, error, notice } = useApi();
  const [rules, setRules] = useState<Row[]>([]);
  const [policies, setPolicies] = useState<Row[]>([]);
  const [trigger, setTrigger] = useState("severity");
  const [period, setPeriod] = useState("");
  const reload = useCallback(async () => {
    const [r, p] = await Promise.all([
      call("/api/management-automation/escalation-rules"),
      call("/api/management-automation/reminder-policies"),
    ]);
    setRules(rows(r));
    setPolicies(rows(p));
  }, [call]);
  useEffect(() => {
    void reload();
  }, [reload]);
  const addRule = async () => {
    const v = await call(
      "/api/management-automation/escalation-rules",
      "POST",
      {
        trigger,
        configuration: { severity: "critical" },
        levels: [
          { level: 1, roleKeys: ["COMPANY_CEO"], afterMinutes: 0 },
          { level: 2, roleKeys: ["PMO"], afterMinutes: 1440 },
        ],
      },
    );
    if (v) await reload();
  };
  const savePolicy = async (itemType: string, offsetsMinutes: number[]) => {
    const v = await call(
      "/api/management-automation/reminder-policies",
      "PUT",
      { itemType, offsetsMinutes, enabled: true },
    );
    if (v) await reload();
  };
  return (
    <div className="space-y-5" dir="rtl">
      <Feedback error={error} notice={notice} />
      <Panel title="قواعد تشدید">
        <div className="flex flex-wrap gap-2">
          <select
            className={`${field} max-w-xs`}
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
          >
            {[
              "severity",
              "amount",
              "duration",
              "delay",
              "missing_data",
              "no_response",
            ].map((t) => (
              <option key={t} value={t}>
                {visibleEnum[t] ?? t}
              </option>
            ))}
          </select>
          <button
            className={button}
            disabled={busy}
            onClick={() => void addRule()}
          >
            افزودن قاعده نمونه
          </button>
          <input
            className={`${field} max-w-40`}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            placeholder="دوره جاری (اختیاری)"
          />
          <button
            className={outlineButton}
            disabled={busy}
            onClick={() =>
              void call(
                "/api/management-automation/run",
                "POST",
                period ? { period } : {},
              )
            }
          >
            اجرای دستی
          </button>
        </div>
        <div className="mt-4">
          <ItemList items={rules} />
        </div>
      </Panel>
      <Panel title="سیاست یادآوری موعد">
        <p className="mb-3 text-sm text-muted-foreground">
          پیش از موعد، روز موعد و یک روز پس از موعد
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            className={outlineButton}
            disabled={busy}
            onClick={() => void savePolicy("action", [-1440, 0, 1440])}
          >
            فعال‌سازی یادآوری اقدام
          </button>
          <button
            className={outlineButton}
            disabled={busy}
            onClick={() => void savePolicy("decision", [-1440, 0, 1440])}
          >
            فعال‌سازی یادآوری تصمیم
          </button>
        </div>
        <div className="mt-3">
          <ItemList items={policies} />
        </div>
      </Panel>
    </div>
  );
}

export function Phase4Page() {
  const path = usePathname();
  if (path.startsWith("/dashboards")) return <Dashboards />;
  if (path.startsWith("/formulas")) return <Formulas />;
  if (path.startsWith("/management-reviews")) return <Reviews />;
  if (path.startsWith("/decisions")) return <Decisions />;
  return <Automation />;
}
