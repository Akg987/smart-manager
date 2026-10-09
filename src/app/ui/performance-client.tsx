"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
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
  method: "POST" | "PATCH",
  body: Record<string, unknown>,
) {
  const response = await apiFetch(endpoint, {
    method,
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "accept-language": "fa",
    },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  const parsed = parseApiBody(result);
  if (!response.ok) throw new Error(parsed.message ?? "درخواست انجام نشد.");
}

export function CheckinSubmit({
  kpiId,
  period,
  periodLabel,
  department,
  targetLabel,
  inputMode,
  inputOptions = [],
  formulaType,
  revise,
}: {
  kpiId: string;
  period: string;
  periodLabel: string;
  department: string;
  targetLabel: string;
  inputMode: string;
  inputOptions?: string[];
  formulaType?: string;
  revise?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const numeric = (key: string) => Number(data.get(key));
    const dataJson: Record<string, unknown> = {};
    let actualValue: unknown = null;
    if (inputMode === "ratio" || inputMode === "percentage") {
      dataJson.numerator = numeric("numerator");
      dataJson.denominator = numeric("denominator");
    } else if (inputMode === "checklist") {
      dataJson.completed = numeric("completed");
      dataJson.total = numeric("total");
    } else if (inputMode === "formula" || inputMode === "components") {
      dataJson.values = String(data.get("values") ?? "")
        .split(/[,،]/)
        .map((value) =>
          Number(
            value
              .trim()
              .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
              .replace(/[٠-٩]/g, (digit) =>
                String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)),
              ),
          ),
        );
      if (formulaType) dataJson.formulaType = formulaType;
    } else if (inputMode === "multi-select") {
      actualValue = data.getAll("actualValue").map(String);
    } else if (
      ["text", "textarea", "descriptive", "select"].includes(inputMode)
    ) {
      actualValue = String(data.get("actualValue") ?? "");
    } else {
      actualValue = numeric("actualValue");
    }
    setBusy(true);
    setMessage("");
    try {
      await send("/api/checkins", "POST", {
        kpiId: Number(kpiId),
        period,
        actualValue,
        dataJson,
        note: String(data.get("note") ?? ""),
        blockers: String(data.get("blockers") ?? ""),
        status: revise ? "revised" : "submitted",
      });
      setOpen(false);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "ارتباط با سرور برقرار نشد.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button
        type="button"
        className="sm-checkin-action"
        onClick={() => {
          setMessage("");
          setOpen(true);
        }}
      >
        <em className="icon ni ni-edit" />
        <span>{revise ? "اصلاح ثبت" : "ثبت داده"}</span>
      </button>
      {open && (
        <div
          className="modal fade show d-block"
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-body sm-checkin-modal">
                <button
                  type="button"
                  className="close"
                  aria-label="بستن"
                  onClick={() => setOpen(false)}
                >
                  <em className="icon ni ni-cross" />
                </button>
                <h5 className="title mb-3">
                  {revise ? "اصلاح ثبت" : "ثبت داده"}
                </h5>
                <div className="sm-checkin-modal-summary">
                  <span>
                    <small>واحد</small>
                    <strong>{department}</strong>
                  </span>
                  <span>
                    <small>دوره</small>
                    <strong>{periodLabel}</strong>
                  </span>
                  <span>
                    <small>هدف</small>
                    <strong>{targetLabel}</strong>
                  </span>
                </div>
                <form onSubmit={submit}>
                  <div className="form-group">
                    <label
                      className="form-label"
                      htmlFor={`actual-${kpiId}-${period}`}
                    >
                      {inputMode === "ratio"
                        ? "صورت و مخرج نسبت"
                        : inputMode === "percentage"
                          ? "صورت و مخرج درصد"
                          : inputMode === "checklist"
                            ? "تعداد انجام‌شده و کل موارد"
                            : inputMode === "formula" ||
                                inputMode === "components"
                              ? "مقادیر اجزا (با ویرگول جدا کنید)"
                              : "مقدار واقعی"}
                    </label>
                    {inputMode === "ratio" || inputMode === "percentage" ? (
                      <div className="d-flex gap-2">
                        <input
                          id={`actual-${kpiId}-${period}`}
                          className="form-control"
                          name="numerator"
                          type="number"
                          step="any"
                          required
                          placeholder="صورت"
                        />
                        <input
                          className="form-control"
                          name="denominator"
                          type="number"
                          step="any"
                          required
                          placeholder="مخرج"
                        />
                      </div>
                    ) : inputMode === "checklist" ? (
                      <div className="d-flex gap-2">
                        <input
                          id={`actual-${kpiId}-${period}`}
                          className="form-control"
                          name="completed"
                          type="number"
                          min="0"
                          step="1"
                          required
                          placeholder="انجام‌شده"
                        />
                        <input
                          className="form-control"
                          name="total"
                          type="number"
                          min="1"
                          step="1"
                          required
                          placeholder="کل موارد"
                        />
                      </div>
                    ) : inputMode === "formula" ||
                      inputMode === "components" ? (
                      <input
                        id={`actual-${kpiId}-${period}`}
                        className="form-control"
                        name="values"
                        inputMode="decimal"
                        required
                        placeholder="مثلاً 10, 20, 30"
                      />
                    ) : inputMode === "textarea" ||
                      inputMode === "descriptive" ? (
                      <textarea
                        id={`actual-${kpiId}-${period}`}
                        className="form-control"
                        name="actualValue"
                        rows={4}
                        required
                      />
                    ) : inputMode === "select" ||
                      inputMode === "multi-select" ? (
                      <select
                        id={`actual-${kpiId}-${period}`}
                        className="form-control"
                        name="actualValue"
                        multiple={inputMode === "multi-select"}
                        required
                      >
                        {inputOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : inputMode === "text" ? (
                      <input
                        id={`actual-${kpiId}-${period}`}
                        className="form-control"
                        name="actualValue"
                        type="text"
                        required
                      />
                    ) : (
                      <input
                        id={`actual-${kpiId}-${period}`}
                        className="form-control"
                        name="actualValue"
                        type="number"
                        min={inputMode === "count" ? 0 : undefined}
                        step={inputMode === "count" ? "1" : "any"}
                        required
                      />
                    )}
                  </div>
                  <div className="form-group">
                    <label
                      className="form-label"
                      htmlFor={`note-${kpiId}-${period}`}
                    >
                      توضیحات
                    </label>
                    <textarea
                      id={`note-${kpiId}-${period}`}
                      className="form-control"
                      name="note"
                      rows={2}
                    />
                  </div>
                  <div className="form-group">
                    <label
                      className="form-label"
                      htmlFor={`blockers-${kpiId}-${period}`}
                    >
                      موانع
                    </label>
                    <textarea
                      id={`blockers-${kpiId}-${period}`}
                      className="form-control"
                      name="blockers"
                      rows={2}
                    />
                  </div>
                  {message && (
                    <p role="alert" className="text-danger">
                      {message}
                    </p>
                  )}
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={busy}
                  >
                    {busy ? "در حال ثبت…" : "ذخیره ثبت"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
      {open && (
        <button
          type="button"
          className="modal-backdrop fade show"
          aria-label="بستن پنجره"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}

export function AlertDecisions({
  id,
  status,
  canAcknowledge,
  canResolve,
}: {
  id: string;
  status: string;
  canAcknowledge: boolean;
  canResolve: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    try {
      await task();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "درخواست انجام نشد.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="sm-alert-actions">
      {canAcknowledge && status === "open" && (
        <button
          type="button"
          className="btn btn-sm btn-outline-primary"
          disabled={busy}
          onClick={() =>
            run(() => send(`/api/alerts/${id}/acknowledge`, "POST", {}))
          }
        >
          دیدم
        </button>
      )}
      {canResolve && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const note = String(
              new FormData(event.currentTarget).get("note") ?? "",
            );
            void run(() => send(`/api/alerts/${id}/resolve`, "POST", { note }));
          }}
        >
          <input
            className="form-control form-control-sm mb-2"
            name="note"
            placeholder="یادداشت بستن"
          />
          <button
            className="btn btn-sm btn-primary btn-block"
            type="submit"
            disabled={busy}
          >
            بستن هشدار
          </button>
        </form>
      )}
      {message && (
        <p role="alert" className="text-danger small mb-0">
          {message}
        </p>
      )}
    </div>
  );
}

export function ActionMoves({
  id,
  status,
  progress,
  canUpdate,
  canApprove,
}: {
  id: string;
  status: string;
  progress: number;
  canUpdate: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const update = async (path: string, body: Record<string, unknown>) => {
    setBusy(true);
    setMessage("");
    try {
      await send(`/api/actions/${id}/${path}`, "PATCH", body);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "درخواست انجام نشد.");
    } finally {
      setBusy(false);
    }
  };
  const reason = () => window.prompt("دلیل تغییر را وارد کنید:")?.trim() ?? "";
  const changeStatus = (next: string) => {
    const note = reason();
    if (note) void update("status", { status: next, reason: note });
  };
  const uploadEvidence = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData();
      form.append("evidence", file);
      const response = await fetch(`/api/actions/${id}/evidence`, {
        method: "POST",
        credentials: "same-origin",
        body: form,
      });
      const result = await response.json().catch(() => ({}));
      const parsed = parseApiBody(result);
      if (!response.ok)
        throw new Error(parsed.message ?? "بارگذاری مدرک انجام نشد.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "بارگذاری مدرک انجام نشد.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="sm-action-buttons">
      {canApprove && status === "proposed" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => changeStatus("approved")}
        >
          تأیید اقدام
        </button>
      )}
      {canUpdate && ["approved", "in_progress", "blocked"].includes(status) && (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => changeStatus("in_progress")}
          >
            شروع / ادامه
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => changeStatus("blocked")}
          >
            مسدود
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const raw = window.prompt("درصد پیشرفت (۰ تا ۱۰۰):");
              if (raw === null) return;
              const value = Number(raw);
              const note = reason();
              if (Number.isInteger(value) && value >= 0 && value <= 100 && note)
                void update("progress", { progress: value, reason: note });
            }}
          >
            ثبت پیشرفت ({progress}٪)
          </button>
          <label className="btn btn-sm btn-outline-primary">
            افزودن مدرک
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              hidden
              disabled={busy}
              onChange={(event) => {
                void uploadEvidence(event.currentTarget.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
          </label>
          {progress === 100 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => changeStatus("pending_completion_approval")}
            >
              ارسال برای تأیید پایان
            </button>
          )}
        </>
      )}
      {canApprove && status === "pending_completion_approval" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => changeStatus("closed")}
        >
          تأیید پایان و بستن
        </button>
      )}
      {canApprove && status === "pending_completion_approval" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => changeStatus("in_progress")}
        >
          بازگشت برای اصلاح
        </button>
      )}
      {message && (
        <p role="alert" className="text-danger small mb-0 w-100">
          {message}
        </p>
      )}
    </div>
  );
}
type KpiOption = { slug: string; name: string };
type KpiPerson = {
  id: string;
  firstName: string;
  lastName: string;
  mobile: string;
};
type KpiFormCatalog = {
  actorId: string;
  company: { id: string; name: string };
  businessUnits: { id: string; name: string }[];
  people: KpiPerson[];
  inputModes: KpiOption[];
  directions: KpiOption[];
  frequencies: KpiOption[];
};

function faDigits(value: string) {
  return value.replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
}

function personLabel(person: KpiPerson) {
  const name = [person.firstName, person.lastName].filter(Boolean).join(" ");
  const mobile = faDigits(person.mobile);
  return name ? `${mobile} — ${name}` : mobile;
}

function preferred(options: KpiOption[], slug: string) {
  return (
    options.find((option) => option.slug === slug)?.slug ??
    options[0]?.slug ??
    ""
  );
}

export function KpiCreateButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<KpiFormCatalog | null>(null);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const openModal = async () => {
    setOpen(true);
    setMessage("");
    if (catalog) return;
    setLoadError("");
    try {
      const response = await fetch("/api/kpis/form", {
        credentials: "same-origin",
        headers: { accept: "application/json", "accept-language": "fa" },
      });
      const parsed = parseApiBody<KpiFormCatalog>(
        await response.json().catch(() => ({})),
      );
      if (!response.ok || !parsed.payload)
        throw new Error(parsed.message ?? "فرم ساخت KPI آماده نشد.");
      setCatalog(parsed.payload);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "فرم ساخت KPI آماده نشد.",
      );
    }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const owner = String(data.get("ownerUserId") ?? "");
    const reporter = String(data.get("reporterUserId") ?? "");
    setBusy(true);
    setMessage("");
    try {
      await send("/api/kpis", "POST", {
        name: String(data.get("name") ?? "").trim(),
        businessUnitId: String(data.get("businessUnitId") ?? "")
          ? Number(data.get("businessUnitId"))
          : undefined,
        unit: String(data.get("unit") ?? "").trim(),
        inputMode: String(data.get("inputMode") ?? ""),
        direction: String(data.get("direction") ?? ""),
        frequency: String(data.get("frequency") ?? ""),
        targetValue: Number(data.get("targetValue")),
        warningValue: Number(data.get("warningValue")),
        criticalValue: Number(data.get("criticalValue")),
        ...(reporter ? { reporterUserId: Number(reporter) } : {}),
        ...(owner ? { ownerUserId: Number(owner) } : {}),
      });
      setOpen(false);
      form.reset();
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "ساخت KPI انجام نشد.",
      );
    } finally {
      setBusy(false);
    }
  };
  const directions = catalog?.directions.length
    ? catalog.directions
    : [
        { slug: "higher", name: "بیشتر بهتر" },
        { slug: "lower", name: "کمتر بهتر" },
        { slug: "range", name: "بازه مطلوب" },
      ];
  const inputModes = catalog?.inputModes.length
    ? catalog.inputModes
    : [{ slug: "direct", name: "مقدار مستقیم" }];
  const frequencies = catalog?.frequencies.length
    ? catalog.frequencies
    : [{ slug: "weekly", name: "هفتگی" }];
  const actorSelected = catalog?.people.some(
    (person) => person.id === catalog.actorId,
  )
    ? catalog.actorId
    : "";
  return (
    <>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => {
          void openModal();
        }}
      >
        <span>ساخت KPI</span>
        <em className="icon ni ni-plus" />
      </button>
      {open && (
        <div className="sm-kpi-modal-root" role="presentation">
          <button
            type="button"
            className="sm-kpi-modal-backdrop"
            aria-label="بستن پنجره"
            onClick={() => setOpen(false)}
          />
          <div
            className="sm-kpi-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kpi-create-title"
          >
            <button
              type="button"
              className="close"
              aria-label="بستن"
              onClick={() => setOpen(false)}
            >
              <em className="icon ni ni-cross" />
            </button>
            <h2 id="kpi-create-title">تعریف KPI جدید</h2>
            <p className="sm-kpi-modal-lead">
              یک نسخه اولیه ساخته می‌شود و ثبت‌های گذشته را تغییر نمی‌دهد.
            </p>
            {loadError && (
              <p role="alert" className="text-danger">
                {loadError}
              </p>
            )}
            {!catalog && !loadError && (
              <p className="text-soft">در حال آماده‌سازی فرم…</p>
            )}
            {catalog && (
              <form onSubmit={submit}>
                <div className="sm-kpi-form-grid">
                  <div className="form-group">
                    <label className="form-label" htmlFor="kpi-name">
                      <span className="req" aria-hidden="true">
                        *
                      </span>
                      نام KPI
                    </label>
                    <input
                      id="kpi-name"
                      className="form-control"
                      name="name"
                      required
                      maxLength={200}
                      placeholder="مثلاً نرخ تبدیل سرنخ به فروش"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="kpi-business-unit">
                      واحد سازمانی / Business Unit
                    </label>
                    <select
                      id="kpi-business-unit"
                      className="form-select"
                      name="businessUnitId"
                      defaultValue=""
                    >
                      <option value="">کل شرکت</option>
                      {catalog.businessUnits.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="kpi-unit">
                      واحد اندازه‌گیری
                    </label>
                    <input
                      id="kpi-unit"
                      className="form-control"
                      name="unit"
                      maxLength={80}
                      placeholder="درصد"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="kpi-input">
                      نوع ورودی
                    </label>
                    <select
                      id="kpi-input"
                      className="form-select"
                      name="inputMode"
                      defaultValue={preferred(inputModes, "direct")}
                    >
                      {inputModes.map((option) => (
                        <option key={option.slug} value={option.slug}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="kpi-direction">
                      جهت مطلوب
                    </label>
                    <select
                      id="kpi-direction"
                      className="form-select"
                      name="direction"
                      defaultValue={preferred(directions, "higher")}
                    >
                      {directions.map((option) => (
                        <option key={option.slug} value={option.slug}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="kpi-frequency">
                      تناوب
                    </label>
                    <select
                      id="kpi-frequency"
                      className="form-select"
                      name="frequency"
                      defaultValue={preferred(frequencies, "weekly")}
                    >
                      {frequencies.map((option) => (
                        <option key={option.slug} value={option.slug}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="kpi-target">
                      <span className="req" aria-hidden="true">
                        *
                      </span>
                      هدف دوره
                    </label>
                    <input
                      id="kpi-target"
                      className="form-control"
                      name="targetValue"
                      type="number"
                      step="any"
                      required
                      defaultValue={100}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="kpi-warning">
                      <span className="req" aria-hidden="true">
                        *
                      </span>
                      مرز زرد
                    </label>
                    <input
                      id="kpi-warning"
                      className="form-control"
                      name="warningValue"
                      type="number"
                      step="any"
                      required
                      defaultValue={80}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="kpi-critical">
                      <span className="req" aria-hidden="true">
                        *
                      </span>
                      مرز قرمز
                    </label>
                    <input
                      id="kpi-critical"
                      className="form-control"
                      name="criticalValue"
                      type="number"
                      step="any"
                      required
                      placeholder="(60)"
                      defaultValue={60}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="kpi-reporter">
                      ثبت‌کننده
                    </label>
                    <select
                      id="kpi-reporter"
                      className="form-select"
                      name="reporterUserId"
                      defaultValue={actorSelected}
                    >
                      <option value="">انتخاب کنید</option>
                      {catalog.people.map((person) => (
                        <option key={person.id} value={person.id}>
                          {personLabel(person)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="kpi-owner">
                      مالک KPI
                    </label>
                    <select
                      id="kpi-owner"
                      className="form-select"
                      name="ownerUserId"
                      defaultValue={actorSelected}
                    >
                      <option value="">انتخاب کنید</option>
                      {catalog.people.map((person) => (
                        <option key={person.id} value={person.id}>
                          {personLabel(person)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="sm-kpi-modal-note">
                  پس از ساخت، می‌توانید فیلدهای فرم، فرمول امن، مهلت و قواعد
                  کیفیت را در نسخه‌های بعدی تغییر دهید.
                </p>
                {catalog.businessUnits.length === 0 && (
                  <p role="alert" className="text-danger mt-3 mb-0">
                    این KPI در شرکت {catalog.company.name} ثبت می‌شود؛ می‌توانید
                    آن را در سطح شرکت نگه دارید.
                  </p>
                )}
                {message && (
                  <p role="alert" className="text-danger mt-3 mb-0">
                    {message}
                  </p>
                )}
                <div className="sm-kpi-modal-actions">
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={busy}
                  >
                    <em className="icon ni ni-arrow-left" />
                    <span>{busy ? "در حال ساخت…" : "ساخت KPI"}</span>
                  </button>
                  <button
                    type="button"
                    className="sm-kpi-modal-cancel"
                    onClick={() => setOpen(false)}
                  >
                    انصراف
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export type StudioRow = {
  id: string;
  name: string;
  code: string;
  department: string;
  unit: string;
  target: string;
  health: string;
  owner: string;
  version: number;
  status?: string;
  active: boolean;
};

const healthLabel: Record<string, string> = {
  green: "سبز",
  yellow: "زرد",
  red: "قرمز",
  unknown: "بدون داده",
};

export function KpiStudioTable({
  rows,
  activeCount,
}: {
  rows: StudioRow[];
  activeCount: number;
}) {
  const [query, setQuery] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.name, row.code, row.department, row.owner, row.unit].some((value) =>
        value.toLowerCase().includes(needle),
      ),
    );
  }, [query, rows]);
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * perPage, current * perPage);
  return (
    <>
      <div className="sm-kpi-toolbar">
        <label className="sm-kpi-search">
          <input
            type="search"
            value={query}
            placeholder="جستجو در KPIها یا واحد..."
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
          <em className="icon ni ni-search" />
        </label>
        <span className="sm-kpi-count">
          <i className={`sm-legend-dot ${activeCount ? "is-green" : ""}`} />
          KPI فعال {faNum(activeCount)}
        </span>
      </div>
      <div className="card card-bordered sm-kpi-table">
        <div className="sm-kpi-head">
          <span>نام KPI</span>
          <span>واحد</span>
          <span>هدف</span>
          <span>آخرین وضعیت</span>
          <span>مسئول</span>
          <span>نسخه</span>
        </div>
        <div className="sm-kpi-body">
          {visible.map((row) => {
            const target = `${faNum(Number(row.target))} ${row.unit}`;
            return (
              <article key={row.id}>
                <a className="sm-kpi-name" href={`/kpis/${row.id}`}>
                  <i className={`is-${row.health}`} />
                  <strong>{row.name}</strong>
                  <small>{row.code}</small>
                </a>
                <span>{row.department}</span>
                <span>{target}</span>
                <span>
                  <span className={`sm-kpi-pill is-${row.health}`}>
                    {healthLabel[row.health] ?? row.health}
                  </span>
                </span>
                <span>{row.owner}</span>
                <span>
                  {faNum(row.version)} · {row.status ?? "published"}
                </span>
              </article>
            );
          })}
          {rows.length === 0 && (
            <p className="sm-kpi-empty">شاخصی در محدوده دسترسی شما نیست.</p>
          )}
          {rows.length > 0 && visible.length === 0 && (
            <p className="sm-kpi-empty">موردی با این جستجو پیدا نشد.</p>
          )}
        </div>
      </div>
      <div className="sm-pager">
        <span />
        {pages > 1 && (
          <div className="sm-pager-links">
            <ul className="pagination">
              {Array.from({ length: pages }, (_, index) => (
                <li
                  className={`page-item ${index + 1 === current ? "active" : ""}`}
                  key={index}
                >
                  <button
                    type="button"
                    className="page-link"
                    onClick={() => setPage(index + 1)}
                  >
                    {faNum(index + 1)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <label className="sm-pager-perpage">
          تعداد نمایش
          <select
            className="form-select"
            value={perPage}
            onChange={(event) => {
              setPerPage(Number(event.target.value));
              setPage(1);
            }}
          >
            <option value={10}>۱۰</option>
            <option value={25}>۲۵</option>
            <option value={50}>۵۰</option>
          </select>
        </label>
      </div>
    </>
  );
}
