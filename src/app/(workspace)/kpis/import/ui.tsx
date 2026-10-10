"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch, parseApiBody } from "@/lib/api";

const MAX_FILE_BYTES = 1_048_576;
const fields = [
  { key: "externalid", label: "شناسهٔ خارجی", defaultValue: "externalId" },
  { key: "kpicode", label: "کد شاخص عملکرد", defaultValue: "kpiCode" },
  { key: "period", label: "دوره (سال-ماه)", defaultValue: "period" },
  { key: "value", label: "مقدار", defaultValue: "value" },
  { key: "unit", label: "واحد", defaultValue: "unit" },
  { key: "source", label: "منبع", defaultValue: "source" },
] as const;

type ImportRow = {
  rowNumber: number;
  externalId: string;
  kpiCode: string;
  period: string;
  value: string;
  unit: string;
  source: string;
  kpiId?: string;
};

type ImportIssue = { rowNumber: number; field: string; message: string };
type Preview = {
  rowCount: number;
  validRows: ImportRow[];
  issues: ImportIssue[];
  canImport: boolean;
};
type ImportResult = {
  runId: string;
  status: string;
  importedCount: number;
  duplicateCount: number;
  rejectedCount: number;
  rows: Array<{
    rowNumber: number;
    status: string;
    message?: string;
  }>;
};
type ImportRun = {
  id: string;
  fileName: string;
  rowCount: number;
  importedCount: number;
  duplicateCount: number;
  rejectedCount: number;
  status: string;
  createdAt: string;
};

function responseError(body: unknown, fallback: string) {
  const parsed = parseApiBody<unknown>(body);
  return parsed.message || fallback;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    completed: "کامل‌شده",
    partial: "نیمه‌کامل",
    failed: "ناموفق",
    imported: "ثبت‌شده",
    duplicate: "تکراری",
    rejected: "ردشده",
  };
  return labels[status] ?? status;
}

export function KpiImportClient() {
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.key, field.defaultValue])),
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [runs, setRuns] = useState<ImportRun[]>([]);
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState<"preview" | "import" | null>(
    null,
  );
  const [loadingRuns, setLoadingRuns] = useState(true);

  const mappingJson = useMemo(() => JSON.stringify(mapping), [mapping]);

  const loadRuns = useCallback(async () => {
    setLoadingRuns(true);
    try {
      const response = await apiFetch("/api/kpis/import/runs", {
        headers: { accept: "application/json", "accept-language": "fa" },
      });
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(responseError(body, "دریافت تاریخچه ناموفق بود."));
      const { payload } = parseApiBody<ImportRun[]>(body);
      setRuns(Array.isArray(payload) ? payload : []);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "دریافت تاریخچه ناموفق بود.",
      );
    } finally {
      setLoadingRuns(false);
    }
  }, []);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  function makeFormData() {
    if (!file) throw new Error("ابتدا یک فایل CSV یا XLSX انتخاب کنید.");
    const data = new FormData();
    data.append("columnMapping", mappingJson);
    data.append("file", file);
    return data;
  }

  async function requestPreview() {
    setError("");
    setResult(null);
    if (!file) {
      setError("ابتدا یک فایل CSV یا XLSX انتخاب کنید.");
      return;
    }
    setBusyAction("preview");
    try {
      const response = await apiFetch("/api/kpis/import/preview", {
        method: "POST",
        headers: { accept: "application/json", "accept-language": "fa" },
        body: makeFormData(),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(responseError(body, "پیش‌نمایش فایل ناموفق بود."));
      const { payload } = parseApiBody<Preview>(body);
      setPreview(payload);
    } catch (cause) {
      setPreview(null);
      setError(
        cause instanceof Error ? cause.message : "پیش‌نمایش فایل ناموفق بود.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function importFile() {
    if (!preview?.canImport || !file) return;
    setError("");
    setBusyAction("import");
    try {
      const response = await apiFetch("/api/kpis/import", {
        method: "POST",
        headers: { accept: "application/json", "accept-language": "fa" },
        body: makeFormData(),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(responseError(body, "ثبت داده‌ها ناموفق بود."));
      const { payload } = parseApiBody<ImportResult>(body);
      setResult(payload);
      setPreview(null);
      await loadRuns();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "ثبت داده‌ها ناموفق بود.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div dir="rtl" className="sm-kpi-import-page">
      <section className="rounded-xl border border-brand-line bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5">
          <h1 className="text-lg font-semibold text-brand-ink">
            واردسازی داده‌های شاخص عملکرد
          </h1>
          <p className="mt-1 text-sm leading-6 text-brand-muted">
            فایل CSV یا XLSX را انتخاب کنید. هر ردیف پیش از ثبت با شرکت فعال، کد
            شناسهٔ شاخص، دوره و واحد سنجیده می‌شود.
          </p>
        </div>

        <div className="sm-kpi-import-grid grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
          <div className="space-y-3">
            <p
              id="kpi-import-file-label"
              className="block text-sm font-medium text-brand-ink"
            >
              فایل ورودی
            </p>
            <div className="sm-kpi-import-file-picker">
              <Input
                id="kpi-import-file"
                type="file"
                className="sm-kpi-import-native-input"
                aria-labelledby="kpi-import-file-label"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(event) => {
                  const selected = event.currentTarget.files?.[0] ?? null;
                  setError("");
                  setPreview(null);
                  setResult(null);
                  if (selected && selected.size > MAX_FILE_BYTES) {
                    setFile(null);
                    event.currentTarget.value = "";
                    setError("حجم فایل نباید بیشتر از ۱ مگابایت باشد.");
                    return;
                  }
                  setFile(selected);
                }}
              />
              <label htmlFor="kpi-import-file" className="sm-kpi-import-file-button">
                انتخاب فایل
              </label>
              <span aria-live="polite" className="sm-kpi-import-file-name">
                {file?.name ?? "فایلی انتخاب نشده است"}
              </span>
            </div>
            <p className="text-xs text-brand-muted">
              حداکثر ۱ مگابایت و ۲۰۰ ردیف داده؛ فایل‌های اکسل با پسوند XLSX
              پذیرفته می‌شوند.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-medium text-brand-ink">
              نگاشت نام ستون‌ها
            </h2>
            <div className="sm-kpi-import-mapping grid gap-3 sm:grid-cols-2">
              {fields.map((field) => (
                <label
                  key={field.key}
                  htmlFor={`kpi-import-column-${field.key}`}
                  className="space-y-1 text-xs text-brand-muted"
                >
                  <span>{field.label}</span>
                  <Input
                    id={`kpi-import-column-${field.key}`}
                    value={mapping[field.key] ?? ""}
                    onChange={(event) => {
                      setMapping((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }));
                      setPreview(null);
                    }}
                    aria-label={`ستون ${field.label}`}
                  />
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={requestPreview}
            disabled={!file || busyAction !== null}
          >
            {busyAction === "preview"
              ? "در حال بررسی…"
              : "اعتبارسنجی و پیش‌نمایش"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={importFile}
            disabled={!preview?.canImport || busyAction !== null}
          >
            {busyAction === "import" ? "در حال ثبت…" : "ثبت داده‌های معتبر"}
          </Button>
        </div>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}
      </section>

      {preview && (
        <section className="space-y-4 rounded-xl border border-brand-line bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold text-brand-ink">نتیجهٔ اعتبارسنجی</h2>
              <p className="mt-1 text-sm text-brand-muted">
                {preview.rowCount} ردیف · {preview.validRows.length} ردیف معتبر
                · {preview.issues.length} ایراد
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${preview.canImport ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}
            >
              {preview.canImport ? "آمادهٔ ثبت" : "نیازمند اصلاح"}
            </span>
          </div>

          {preview.validRows.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ردیف</TableHead>
                  <TableHead>کد شاخص</TableHead>
                  <TableHead>دوره</TableHead>
                  <TableHead>مقدار</TableHead>
                  <TableHead>واحد</TableHead>
                  <TableHead>شناسه خارجی</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.validRows.slice(0, 20).map((row) => (
                  <TableRow key={`${row.rowNumber}-${row.externalId}`}>
                    <TableCell>{row.rowNumber}</TableCell>
                    <TableCell>{row.kpiCode}</TableCell>
                    <TableCell>{row.period}</TableCell>
                    <TableCell>{row.value}</TableCell>
                    <TableCell>{row.unit}</TableCell>
                    <TableCell>{row.externalId}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {preview.validRows.length > 20 && (
            <p className="text-xs text-brand-muted">
              ۲۰ ردیف اول نمایش داده شده‌اند؛ همهٔ {preview.validRows.length} ردیف
              معتبر هنگام ثبت پردازش می‌شوند.
            </p>
          )}

          {preview.issues.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-amber-200">
              <h3 className="bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900">
                ایرادهای نیازمند اصلاح
              </h3>
              <ul className="max-h-56 divide-y divide-amber-100 overflow-y-auto text-sm">
                {preview.issues.map((issue, index) => (
                  <li
                    key={`${issue.rowNumber}-${issue.field}-${index}`}
                    className="px-4 py-2 text-brand-ink"
                  >
                    ردیف {issue.rowNumber} · {issue.field}: {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {result && (
        <section className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
          <div>
            <h2 className="font-semibold">نتیجهٔ ثبت</h2>
            <p className="mt-2 text-sm">
              واردشده: {result.importedCount} · تکراری: {result.duplicateCount}{" "}
              · ردشده: {result.rejectedCount} · وضعیت:{" "}
              {statusLabel(result.status)}
            </p>
          </div>
          {result.rows.some((row) => row.status === "rejected") && (
            <ul className="max-h-48 divide-y divide-emerald-200 overflow-y-auto rounded-md border border-emerald-200 bg-white text-sm">
              {result.rows
                .filter((row) => row.status === "rejected")
                .map((row) => (
                  <li key={row.rowNumber} className="px-3 py-2">
                    ردیف {row.rowNumber}: {row.message || "رد شد"}
                  </li>
                ))}
            </ul>
          )}
        </section>
      )}

      <section className="rounded-xl border border-brand-line bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-brand-ink">
              تاریخچهٔ واردسازی‌های من
            </h2>
            <p className="mt-1 text-sm text-brand-muted">
              فقط اجراهای شما در شرکت فعال نمایش داده می‌شود.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadRuns()}
            disabled={loadingRuns}
          >
            {loadingRuns ? "در حال دریافت…" : "تازه‌سازی"}
          </Button>
        </div>
        {runs.length === 0 ? (
          <p className="rounded-lg bg-brand-canvas px-4 py-6 text-center text-sm text-brand-muted">
            {loadingRuns
              ? "در حال بارگیری تاریخچه…"
              : "هنوز واردسازی‌ای ثبت نشده است."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>فایل</TableHead>
                <TableHead>تاریخ</TableHead>
                <TableHead>ردیف‌ها</TableHead>
                <TableHead>ثبت‌شده</TableHead>
                <TableHead>تکراری</TableHead>
                <TableHead>ردشده</TableHead>
                <TableHead>وضعیت</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="max-w-56 truncate">
                    {run.fileName}
                  </TableCell>
                  <TableCell>
                    {new Intl.DateTimeFormat("fa-IR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(run.createdAt))}
                  </TableCell>
                  <TableCell>{run.rowCount}</TableCell>
                  <TableCell>{run.importedCount}</TableCell>
                  <TableCell>{run.duplicateCount}</TableCell>
                  <TableCell>{run.rejectedCount}</TableCell>
                  <TableCell>{statusLabel(run.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
