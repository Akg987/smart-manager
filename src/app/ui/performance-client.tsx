"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { parseApiBody } from "@/lib/api";

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
  const response = await fetch(endpoint, {
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
  revise,
}: {
  kpiId: string;
  period: string;
  periodLabel: string;
  department: string;
  targetLabel: string;
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
    setBusy(true);
    setMessage("");
    try {
      await send("/api/checkins", "POST", {
        kpiId: Number(kpiId),
        period,
        actualValue: Number(data.get("actualValue")),
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
                      مقدار واقعی
                    </label>
                    <input
                      id={`actual-${kpiId}-${period}`}
                      className="form-control"
                      name="actualValue"
                      type="number"
                      step="any"
                      required
                    />
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

const moves: Record<
  string,
  { status: "open" | "in_progress" | "blocked" | "done"; label: string }[]
> = {
  open: [
    { status: "in_progress", label: "شروع" },
    { status: "blocked", label: "مسدود" },
  ],
  in_progress: [
    { status: "done", label: "انجام شد" },
    { status: "blocked", label: "مسدود" },
  ],
  blocked: [{ status: "in_progress", label: "ادامه" }],
  done: [],
};

export function ActionMoves({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const options = moves[status] ?? [];
  if (!options.length && !message) return null;
  return (
    <div className="sm-action-buttons">
      {options.map((option) => (
        <button
          key={option.status}
          type="button"
          onClick={async () => {
            setMessage("");
            try {
              await send(`/api/actions/${id}/status`, "PATCH", {
                status: option.status,
              });
              router.refresh();
            } catch (error) {
              setMessage(
                error instanceof Error
                  ? error.message
                  : "تغییر وضعیت انجام نشد.",
              );
            }
          }}
        >
          {option.label}
        </button>
      ))}
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
  departmentId: string | null;
};
type KpiFormCatalog = {
  actorId: string;
  departments: { id: string; name: string }[];
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
        departmentId: Number(data.get("departmentId")),
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
                    <label className="form-label" htmlFor="kpi-department">
                      <span className="req" aria-hidden="true">
                        *
                      </span>
                      واحد سازمانی
                    </label>
                    <select
                      id="kpi-department"
                      className="form-select"
                      name="departmentId"
                      required
                      defaultValue=""
                    >
                      <option value="" disabled>
                        انتخاب واحد
                      </option>
                      {catalog.departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
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
                {catalog.departments.length === 0 && (
                  <p role="alert" className="text-danger mt-3 mb-0">
                    هنوز واحدی تعریف نشده است. ابتدا از بخش واحدهای سازمانی یک
                    واحد بسازید.
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
                    disabled={busy || catalog.departments.length === 0}
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
                <span>{faNum(row.version)}</span>
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
