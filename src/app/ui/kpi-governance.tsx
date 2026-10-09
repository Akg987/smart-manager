"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthContext } from "@/contexts/auth-context";
import { apiFetch, parseApiBody } from "@/lib/api";

type Row = Record<string, unknown>;
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(`/api/${path}`, {
    ...init,
    credentials: "same-origin",
    headers: {
      accept: "application/json",
      "accept-language": "fa",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const parsed = parseApiBody<T>(await response.json().catch(() => null));
  if (!response.ok)
    throw new Error(
      parsed.message ?? `درخواست با خطای ${response.status} انجام نشد.`,
    );
  return parsed.payload;
}
function useTenantQuery<T>(key: string, path: string) {
  const { data } = useAuthContext();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return useQuery({
    queryKey: ["tenant", data?.authContext.companyId, key],
    queryFn: () => request<T>(path),
    enabled: mounted && !!data?.authContext.companyId,
  });
}
function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-5 text-card-foreground shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
function State({
  loading,
  error,
  empty,
}: {
  loading: boolean;
  error?: Error | null;
  empty?: boolean;
}) {
  if (loading)
    return (
      <output className="text-sm text-muted-foreground">
        در حال دریافت اطلاعات…
      </output>
    );
  if (error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {error.message}
      </p>
    );
  if (empty)
    return (
      <p className="text-sm text-muted-foreground">
        موردی برای نمایش وجود ندارد.
      </p>
    );
  return null;
}
function Table({
  rows,
  columns,
}: {
  rows: Row[];
  columns: [string, string][];
}) {
  if (!rows.length) return <State loading={false} empty />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-right">
            {columns.map(([key, label]) => (
              <th className="px-3 py-2 font-medium" key={key}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              className="border-b last:border-0"
              key={String(row.id ?? index)}
            >
              {columns.map(([key]) => (
                <td className="px-3 py-3" key={key}>
                  {String(row[key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function KpiStudioPage() {
  const q = useTenantQuery<{ rows?: Row[] }>("kpi-studio", "kpis/studio");
  const rows = q.data?.rows ?? [];
  return (
    <Panel title="شاخص‌های شرکت">
      <State loading={q.isLoading} error={q.error} />
      <Table
        rows={rows}
        columns={[
          ["name", "شاخص"],
          ["code", "کد"],
          ["department", "واحد"],
          ["target", "هدف"],
          ["health", "وضعیت"],
          ["version", "نسخه"],
        ]}
      />
    </Panel>
  );
}
export function KpiReviewPage() {
  const qc = useQueryClient();
  const q = useTenantQuery<Row[]>("kpi-review-queue", "kpis/review-queue");
  const mutation = useMutation({
    mutationFn: ({
      id,
      decision,
    }: {
      id: string;
      decision: "approved" | "rejected";
    }) =>
      request(`kpis/checkins/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant"] }),
  });
  const rows = q.data ?? [];
  return (
    <Panel title="صف بررسی داده‌های KPI">
      <State
        loading={q.isLoading}
        error={q.error}
        empty={!q.isLoading && !q.error && rows.length === 0}
      />
      {rows.map((row) => (
        <article
          key={String(row.id)}
          className="flex flex-wrap items-center justify-between gap-3 border-b py-3"
        >
          <div>
            <strong>{String(row.kpiName)}</strong>
            <p className="text-sm text-muted-foreground">
              دوره {String(row.period)} · مقدار {String(row.actualValue ?? "—")}{" "}
              · ثبت‌کننده {String(row.userId)}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50"
              disabled={mutation.isPending}
              onClick={() =>
                mutation.mutate({ id: String(row.id), decision: "approved" })
              }
            >
              تأیید
            </button>
            <button
              type="button"
              className="rounded-md border px-3 py-2 disabled:opacity-50"
              disabled={mutation.isPending}
              onClick={() =>
                mutation.mutate({ id: String(row.id), decision: "rejected" })
              }
            >
              بازگشت برای اصلاح
            </button>
          </div>
        </article>
      ))}
    </Panel>
  );
}
export function RedFlagPage() {
  const qc = useQueryClient();
  const { can } = useAuthContext();
  const q = useTenantQuery<Row[]>("red-flags", "kpis/red-flags");
  const rules = useTenantQuery<Row[]>("red-flag-rules", "kpis/red-flag-rules");
  const [description, setDescription] = useState("");
  const [cause, setCause] = useState("");
  const [evidence, setEvidence] = useState("");
  const [ruleMessage, setRuleMessage] = useState("");
  const [ruleTrigger, setRuleTrigger] = useState("data_missing");
  const [ruleSeverity, setRuleSeverity] = useState("high");
  const create = useMutation({
    mutationFn: () =>
      request("kpis/red-flags", {
        method: "POST",
        body: JSON.stringify({
          description,
          suspectedCause: cause || null,
          severity: "high",
        }),
      }),
    onSuccess: () => {
      setDescription("");
      setCause("");
      void qc.invalidateQueries({ queryKey: ["tenant"] });
    },
  });
  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      request(`kpis/red-flags/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          suspectedCause: cause || undefined,
          ...(status === "closed" ? { closureEvidence: evidence } : {}),
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant"] }),
  });
  const createRule = useMutation({
    mutationFn: () =>
      request("kpis/red-flag-rules", {
        method: "POST",
        body: JSON.stringify({
          trigger: ruleTrigger,
          severity: ruleSeverity,
          configuration: {},
        }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["tenant"] }),
  });
  const updateRule = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      request(`kpis/red-flag-rules/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["tenant"] }),
  });
  const evaluateRules = useMutation({
    mutationFn: () =>
      request<{ createdRedFlags?: number }>("kpis/red-flag-rules/evaluate", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: (result) => {
      setRuleMessage(
        `ارزیابی انجام شد؛ ${String(result.createdRedFlags ?? 0)} پرچم جدید.`,
      );
      void qc.invalidateQueries({ queryKey: ["tenant"] });
    },
  });
  const rows = q.data ?? [];
  return (
    <div className="space-y-4">
      {can("redflag.create") && (
        <Panel title="ثبت پرچم قرمز">
          <div className="grid gap-3">
            <input
              className="rounded-md border bg-background p-2"
              aria-label="شرح پرچم"
              placeholder="شرح انحراف یا ریسک"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <input
              className="rounded-md border bg-background p-2"
              aria-label="علت احتمالی"
              placeholder="علت احتمالی (در صورت نامشخص، خالی بگذارید)"
              value={cause}
              onChange={(e) => setCause(e.target.value)}
            />
            <button
              type="button"
              className="w-fit rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
              disabled={!description.trim() || create.isPending}
              onClick={() => create.mutate()}
            >
              ثبت پرچم
            </button>
            {create.error && (
              <p role="alert" className="text-sm text-destructive">
                {create.error.message}
              </p>
            )}
          </div>
        </Panel>
      )}
      <Panel title="قواعد قابل تنظیم Red Flag">
        <State
          loading={rules.isLoading}
          error={rules.error}
          empty={
            !rules.isLoading && !rules.error && (rules.data ?? []).length === 0
          }
        />
        {can("redflag.create") && (
          <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
            <select
              className="rounded-md border bg-background p-2"
              value={ruleTrigger}
              onChange={(event) => setRuleTrigger(event.target.value)}
              aria-label="محرک قاعده"
            >
              <option value="kpi_below_threshold">KPI کمتر از آستانه</option>
              <option value="kpi_above_threshold">KPI بیشتر از آستانه</option>
              <option value="multiple_period_degradation">افت چنددوره‌ای</option>
              <option value="data_missing">داده ثبت‌نشده</option>
              <option value="data_stale">داده کهنه</option>
              <option value="action_overdue">اقدام معوق</option>
              <option value="decision_overdue">تصمیم معوق</option>
            </select>
            <select
              className="rounded-md border bg-background p-2"
              value={ruleSeverity}
              onChange={(event) => setRuleSeverity(event.target.value)}
              aria-label="شدت پرچم"
            >
              <option value="critical">بحرانی</option>
              <option value="high">زیاد</option>
              <option value="medium">متوسط</option>
              <option value="low">کم</option>
            </select>
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
              disabled={createRule.isPending}
              onClick={() => createRule.mutate()}
            >
              افزودن قاعده
            </button>
          </div>
        )}
        {(rules.data ?? []).map((rule) => (
          <div
            key={String(rule.id)}
            className="flex flex-wrap items-center justify-between gap-2 border-t py-3 text-sm"
          >
            <span>
              {String(rule.trigger)} · شدت {String(rule.severity)} ·{" "}
              {rule.enabled ? "فعال" : "غیرفعال"}
            </span>
            {can("redflag.update") && (
              <button
                type="button"
                className="rounded-md border px-3 py-1.5"
                disabled={updateRule.isPending}
                onClick={() =>
                  updateRule.mutate({
                    id: String(rule.id),
                    enabled: rule.enabled !== true,
                  })
                }
              >
                {rule.enabled ? "غیرفعال‌کردن" : "فعال‌کردن"}
              </button>
            )}
          </div>
        ))}
        {can("redflag.create") && (
          <button
            type="button"
            className="mt-3 rounded-md border px-4 py-2 disabled:opacity-50"
            disabled={evaluateRules.isPending}
            onClick={() => evaluateRules.mutate()}
          >
            {evaluateRules.isPending ? "در حال ارزیابی…" : "ارزیابی اکنون"}
          </button>
        )}
        {ruleMessage && (
          <p className="mt-2 text-sm text-muted-foreground" role="status">
            {ruleMessage}
          </p>
        )}
        {[createRule.error, updateRule.error, evaluateRules.error].map(
          (error, index) =>
            error && (
              <p
                role="alert"
                className="mt-2 text-sm text-destructive"
                key={index}
              >
                {error.message}
              </p>
            ),
        )}
      </Panel>
      <Panel title="پرچم‌های ثبت‌شده">
        <State
          loading={q.isLoading}
          error={q.error}
          empty={!q.isLoading && !q.error && rows.length === 0}
        />
        {can("redflag.resolve") && (
          <label className="mb-2 block text-sm" htmlFor="closureEvidence">
            شواهد لازم برای بستن مورد
          </label>
        )}
        {can("redflag.resolve") && (
          <input
            id="closureEvidence"
            className="mb-3 w-full rounded-md border bg-background p-2"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
          />
        )}
        <div className="divide-y">
          {rows.map((row) => (
            <article
              key={String(row.id)}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <strong>{String(row.description)}</strong>
                <p className="text-sm text-muted-foreground">
                  شدت {String(row.severity)} · دوره {String(row.period ?? "—")}{" "}
                  · علت {String(row.suspectedCause ?? "نامشخص")} · وضعیت{" "}
                  {String(row.status)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {can("redflag.update") && (
                  <>
                    <button
                      type="button"
                      className="rounded-md border px-3 py-2"
                      onClick={() =>
                        mutation.mutate({
                          id: String(row.id),
                          status: "investigating",
                        })
                      }
                    >
                      در حال بررسی
                    </button>
                    <button
                      type="button"
                      className="rounded-md border px-3 py-2"
                      onClick={() =>
                        mutation.mutate({
                          id: String(row.id),
                          status: "action_required",
                        })
                      }
                    >
                      نیازمند اقدام
                    </button>
                  </>
                )}
                {can("redflag.resolve") && (
                  <>
                    <button
                      type="button"
                      className="rounded-md border px-3 py-2"
                      onClick={() =>
                        mutation.mutate({
                          id: String(row.id),
                          status: "resolved",
                        })
                      }
                    >
                      حل‌شده
                    </button>
                    <button
                      type="button"
                      className="rounded-md bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50"
                      disabled={!evidence.trim() || row.status !== "resolved"}
                      onClick={() =>
                        mutation.mutate({
                          id: String(row.id),
                          status: "closed",
                        })
                      }
                    >
                      بستن با مدرک
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
        {mutation.error && (
          <p role="alert" className="text-sm text-destructive">
            {mutation.error.message}
          </p>
        )}
      </Panel>
    </div>
  );
}
export function ObservationPage() {
  const qc = useQueryClient();
  const q = useTenantQuery<Row[]>("observations", "kpis/observations");
  const [text, setText] = useState("");
  const mutation = useMutation({
    mutationFn: () => {
      const parts = Object.fromEntries(
        new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", {
          timeZone: "Asia/Tehran",
          year: "numeric",
          month: "numeric",
          day: "numeric",
        })
          .formatToParts(new Date())
          .map(({ type, value }) => [type, value]),
      );
      const year = Number(parts.year);
      const month = Number(parts.month);
      const day = Number(parts.day);
      const dayOfYear =
        month <= 6 ? (month - 1) * 31 + day : 186 + (month - 7) * 30 + day;
      const period = `${String(year).padStart(4, "0")}-W${String(Math.ceil(dayOfYear / 7)).padStart(2, "0")}`;
      return request("kpis/observations", {
        method: "POST",
        body: JSON.stringify({ period, text }),
      });
    },
    onSuccess: () => {
      setText("");
      void qc.invalidateQueries({ queryKey: ["tenant"] });
    },
  });
  const rows = q.data ?? [];
  return (
    <div className="space-y-4">
      <Panel title="ثبت مشاهده مدیریتی">
        <label className="mb-2 block text-sm" htmlFor="observation">
          یادداشت مشاهده
        </label>
        <textarea
          id="observation"
          className="min-h-28 w-full rounded-md border bg-background p-3"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={5000}
        />
        <button
          type="button"
          className="mt-3 rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          disabled={!text.trim() || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          ثبت مشاهده
        </button>
        {mutation.error && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {mutation.error.message}
          </p>
        )}
      </Panel>
      <Panel title="مشاهدات ثبت‌شده">
        <State
          loading={q.isLoading}
          error={q.error}
          empty={!q.isLoading && !q.error && rows.length === 0}
        />
        {rows.map((row) => (
          <p key={String(row.id)} className="border-b py-3">
            {String(row.text)}{" "}
            <span className="text-muted-foreground">
              · {String(row.period)}
            </span>
          </p>
        ))}
      </Panel>
    </div>
  );
}
export function KpiHistoryPage() {
  const params = useParams<{ id: string }>();
  const qc = useQueryClient();
  const q = useTenantQuery<{
    definition?: Row;
    versions?: Row[];
    values?: Row[];
  }>(`kpi-history-${params.id}`, `kpis/${params.id}/history`);
  const lifecycle = useMutation({
    mutationFn: (transition: "submit-review" | "publish") =>
      request(`kpis/${params.id}/${transition}`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tenant"] });
    },
  });
  const status = String(q.data?.definition?.status ?? "—");
  return (
    <div className="space-y-4">
      <Panel title="چرخهٔ تعریف KPI">
        <p className="mb-3 text-sm">
          وضعیت فعلی: {status} · نسخه{" "}
          {String(q.data?.definition?.version ?? "—")}
        </p>
        {status === "draft" && (
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
            onClick={() => lifecycle.mutate("submit-review")}
          >
            ارسال برای بررسی
          </button>
        )}
        {status === "reviewed" && (
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
            onClick={() => lifecycle.mutate("publish")}
          >
            انتشار با تأیید مجاز
          </button>
        )}
        {lifecycle.error && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {lifecycle.error.message}
          </p>
        )}
      </Panel>
      <Panel title="نسخه‌های تعریف">
        <State loading={q.isLoading} error={q.error} />
        <Table
          rows={q.data?.versions ?? []}
          columns={[
            ["version", "نسخه"],
            ["effectiveFrom", "مؤثر از"],
            ["createdAt", "ثبت"],
          ]}
        />
      </Panel>
      <Panel title="تاریخچهٔ مقدارهای تأییدشده">
        <Table
          rows={q.data?.values ?? []}
          columns={[
            ["period", "دوره"],
            ["actualValue", "مقدار"],
            ["targetValue", "هدف"],
            ["status", "سلامت"],
            ["dataState", "وضعیت داده"],
            ["version", "نسخه"],
          ]}
        />
      </Panel>
    </div>
  );
}

export function KpiDetailPage() {
  const params = useParams<{ id: string }>();
  const q = useTenantQuery<{
    definition?: Row;
    latest?: Row;
    companyName?: string;
    businessUnitName?: string;
  }>(`kpi-detail-${params.id}`, `kpis/${params.id}`);
  const kpi = q.data?.definition;
  return (
    <div className="space-y-4">
      <Panel title={String(kpi?.name ?? "جزئیات KPI")}>
        <State loading={q.isLoading} error={q.error} />
        {kpi && (
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <p>کد: {String(kpi.code)}</p>
            <p>
              واحد:{" "}
              {String(q.data?.businessUnitName ?? q.data?.companyName ?? "—")}
            </p>
            <p>
              هدف: {String(kpi.targetValue)} {String(kpi.unit)}
            </p>
            <p>جهت: {String(kpi.direction)}</p>
            <p>ورودی: {String(kpi.inputMode)}</p>
            <p>نسخه: {String(kpi.version)}</p>
            <p>وضعیت: {String(kpi.status)}</p>
            <p className="sm:col-span-2 lg:col-span-3">
              {String(kpi.description ?? "")}
            </p>
          </div>
        )}
        {q.data?.latest && (
          <p
            className={`mt-4 rounded-md border p-3 text-sm ${["missing", "null", "late", "stale"].includes(String(q.data.latest.dataState)) ? "bg-muted text-muted-foreground" : ""}`}
          >
            آخرین مقدار تأییدشده: {String(q.data.latest.actualValue ?? "—")}{" "}
            {String(kpi?.unit ?? "")} · سلامت KPI:{" "}
            {String(q.data.latest.status)} · وضعیت داده:{" "}
            {String(q.data.latest.dataState)}
          </p>
        )}
        {kpi && (
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
              href={`/kpis/${params.id}/data`}
            >
              ثبت داده
            </a>
            <a
              className="rounded-md border px-4 py-2"
              href={`/kpis/${params.id}/history`}
            >
              تاریخچه و نسخه‌ها
            </a>
          </div>
        )}
      </Panel>
    </div>
  );
}

export function KpiDataEntryPage() {
  const params = useParams<{ id: string }>();
  const qc = useQueryClient();
  const q = useTenantQuery<{
    kpi?: Row;
    period?: string;
    value?: Row | null;
    checkin?: Row | null;
    health?: string;
    dataState?: string;
    displayColor?: string;
  }>(`kpi-data-${params.id}`, `kpis/${params.id}/data`);
  const [period, setPeriod] = useState("");
  const [message, setMessage] = useState("");
  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      request(`kpis/${params.id}/checkins`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      setMessage("داده برای بررسی ارسال شد.");
      void qc.invalidateQueries({ queryKey: ["tenant"] });
    },
    onError: (error: Error) => setMessage(error.message),
  });
  useEffect(() => {
    if (!period && q.data?.period) setPeriod(q.data.period);
  }, [period, q.data?.period]);
  const kpi = q.data?.kpi;
  const mode = String(kpi?.inputMode ?? "numeric");
  const options = Array.isArray(kpi?.inputOptions)
    ? kpi.inputOptions.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const num = (key: string) => Number(form.get(key));
    let actualValue: unknown = null;
    const dataJson: Record<string, unknown> = {};
    if (mode === "ratio" || mode === "percentage") {
      dataJson.numerator = num("numerator");
      dataJson.denominator = num("denominator");
    } else if (mode === "formula" || mode === "components") {
      dataJson.values = String(form.get("values") ?? "")
        .split(/[,،]/)
        .map((value) => Number(value.trim()));
    } else if (mode === "multi-select")
      actualValue = form.getAll("actualValue").map(String);
    else if (["numeric", "direct", "count", "currency"].includes(mode))
      actualValue = num("actualValue");
    else actualValue = String(form.get("actualValue") ?? "");
    mutation.mutate({
      period,
      actualValue,
      dataJson,
      unit: String(kpi?.unit ?? ""),
      note: String(form.get("note") ?? ""),
      status: "data_submitted",
    });
  };
  return (
    <Panel title={`ثبت داده KPI · ${String(kpi?.name ?? "")}`}>
      <State loading={q.isLoading} error={q.error} />
      {kpi && (
        <form className="grid max-w-2xl gap-4" onSubmit={submit}>
          <label className="grid gap-1 text-sm">
            دوره گزارش
            <input
              className="rounded-md border bg-background p-2"
              required
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              placeholder="۱۴۰۵-۰۷"
            />
          </label>
          {(mode === "ratio" || mode === "percentage") && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                صورت
                <input
                  className="rounded-md border bg-background p-2"
                  name="numerator"
                  type="number"
                  step="any"
                  required
                />
              </label>
              <label className="grid gap-1 text-sm">
                مخرج
                <input
                  className="rounded-md border bg-background p-2"
                  name="denominator"
                  type="number"
                  step="any"
                  required
                />
              </label>
            </div>
          )}
          {(mode === "formula" || mode === "components") && (
            <label className="grid gap-1 text-sm">
              اجزای فرمول، جداشده با ویرگول
              <input
                className="rounded-md border bg-background p-2"
                name="values"
                inputMode="decimal"
                required
              />
            </label>
          )}
          {mode === "select" && (
            <label className="grid gap-1 text-sm">
              مقدار
              <select
                className="rounded-md border bg-background p-2"
                name="actualValue"
                required
              >
                <option value="">انتخاب کنید</option>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          )}
          {mode === "multi-select" && (
            <label className="grid gap-1 text-sm">
              مقادیر
              <select
                className="min-h-28 rounded-md border bg-background p-2"
                name="actualValue"
                multiple
                required
              >
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          )}
          {["text", "textarea", "descriptive"].includes(mode) && (
            <label className="grid gap-1 text-sm">
              {mode === "descriptive" ? "توضیح مدیریتی" : "مقدار متنی"}
              {mode === "text" ? (
                <input
                  className="rounded-md border bg-background p-2"
                  name="actualValue"
                  maxLength={500}
                  required
                />
              ) : (
                <textarea
                  className="rounded-md border bg-background p-2"
                  name="actualValue"
                  rows={5}
                  maxLength={5000}
                  required
                />
              )}
            </label>
          )}
          {["numeric", "direct", "count", "currency"].includes(mode) && (
            <label className="grid gap-1 text-sm">
              مقدار واقعی ({String(kpi.unit)})
              <input
                className="rounded-md border bg-background p-2"
                name="actualValue"
                type="number"
                step={mode === "count" ? "1" : "any"}
                min={mode === "count" ? 0 : undefined}
                required
              />
            </label>
          )}
          <label className="grid gap-1 text-sm">
            یادداشت
            <textarea
              className="rounded-md border bg-background p-2"
              name="note"
              rows={2}
              maxLength={500}
            />
          </label>
          {q.data?.displayColor === "gray" && (
            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              مقدار این دوره ثبت نشده یا دادهٔ قبلی منقضی است؛ وضعیت خاکستری به
              معنی موفقیت نیست.
            </p>
          )}
          {message && (
            <p role="status" className="text-sm text-muted-foreground">
              {message}
            </p>
          )}
          <button
            className="w-fit rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "در حال ارسال…" : "ارسال برای بررسی"}
          </button>
        </form>
      )}
    </Panel>
  );
}
