"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { parseApiBody } from "@/lib/api";

export type DirectoryUser = {
  id: string | number;
  firstName: string | null;
  lastName: string | null;
  mobile: string;
  role: string;
  departmentId: string | number | null;
  accessLevelId: string | number | null;
  jobTitle: string | null;
  approvedAt: string | null;
  createdAt: string | null;
};

export type DirectoryDepartment = {
  id: string | number;
  name: string;
  code: string;
  managerUserId: string | number | null;
};

export type DirectoryLevel = { id: string | number; name: string };

function textId(value: string | number | null | undefined) {
  return value === null || value === undefined || value === ""
    ? ""
    : String(value);
}

function fullName(user: Pick<DirectoryUser, "firstName" | "lastName">) {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(" ") || "بدون نام"
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

function membership(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tehran",
  }).formatToParts(date);
  const pick = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}/${pick("month")}/${pick("day")}`;
}

function faNum(value: number) {
  return String(value).replace(
    /[0-9]/g,
    (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)],
  );
}

async function send(
  endpoint: string,
  method: "POST" | "PATCH",
  body?: Record<string, unknown>,
) {
  const response = await fetch(endpoint, {
    method,
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "accept-language": "fa",
    },
    body: body ? JSON.stringify(body) : "{}",
  });
  const result = await response.json().catch(() => ({}));
  const parsed = parseApiBody(result);
  if (!response.ok) throw new Error(parsed.message ?? "درخواست انجام نشد.");
}

function UserRow({
  user,
  departments,
  levels,
}: {
  user: DirectoryUser;
  departments: DirectoryDepartment[];
  levels: DirectoryLevel[];
}) {
  const router = useRouter();
  const [role, setRole] = useState(user.role === "admin" ? "admin" : "user");
  const [departmentId, setDepartmentId] = useState(textId(user.departmentId));
  const [accessLevelId, setAccessLevelId] = useState(
    textId(user.accessLevelId),
  );
  const [jobTitle, setJobTitle] = useState(user.jobTitle ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const name = fullName(user);
  const approved = Boolean(user.approvedAt);

  const organizationBody = () => ({
    departmentId: departmentId ? Number(departmentId) : null,
    accessLevelId: accessLevelId ? Number(accessLevelId) : null,
    jobTitle: jobTitle.trim() || null,
  });

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
    <article className="sm-users-row">
      <div className="sm-users-person">
        <span className="sm-header-user__avatar" aria-hidden="true">
          {initials(name)}
        </span>
        <span>
          <strong>{name}</strong>
          <small>عضویت: {membership(user.createdAt)}</small>
        </span>
      </div>
      <span className="sm-users-mobile" dir="ltr">
        {user.mobile}
      </span>
      <form
        className="sm-inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          void run("role", () =>
            send(`/api/users/${user.id}/role`, "PATCH", { role }),
          );
        }}
      >
        <select
          className="form-select"
          aria-label="سطح دسترسی"
          value={role}
          onChange={(event) => setRole(event.target.value)}
        >
          <option value="admin">مدیر سیستم</option>
          <option value="user">کاربر</option>
        </select>
        <button
          className="btn btn-outline-light"
          type="submit"
          disabled={busy === "role"}
        >
          {busy === "role" ? "…" : "ذخیره"}
        </button>
      </form>
      <div className="sm-users-unit">
        <form
          className="sm-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void run("department", () =>
              send(
                `/api/users/${user.id}/organization`,
                "PATCH",
                organizationBody(),
              ),
            );
          }}
        >
          <select
            className="form-select"
            aria-label="واحد"
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
          >
            <option value="">بدون واحد</option>
            {departments.map((department) => (
              <option key={textId(department.id)} value={textId(department.id)}>
                {department.name}
              </option>
            ))}
          </select>
          <button
            className="btn btn-outline-light"
            type="submit"
            disabled={busy === "department"}
          >
            {busy === "department" ? "…" : "ذخیره"}
          </button>
        </form>
        <form
          className="sm-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void run("job", () =>
              send(
                `/api/users/${user.id}/organization`,
                "PATCH",
                organizationBody(),
              ),
            );
          }}
        >
          <select
            className="form-select"
            aria-label="سطح سازمانی"
            value={accessLevelId}
            onChange={(event) => setAccessLevelId(event.target.value)}
          >
            <option value="">بدون سطح</option>
            {levels.map((level) => (
              <option key={textId(level.id)} value={textId(level.id)}>
                {level.name}
              </option>
            ))}
          </select>
          <input
            className="form-control"
            aria-label="عنوان شغلی"
            placeholder="عنوان شغلی"
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
          />
          <button
            className="btn btn-outline-light"
            type="submit"
            disabled={busy === "job"}
          >
            {busy === "job" ? "…" : "ذخیره"}
          </button>
        </form>
        {message && (
          <p role="alert" className="sm-row-error">
            {message}
          </p>
        )}
      </div>
      <span className={`sm-users-status ${approved ? "is-ok" : "is-wait"}`}>
        {approved ? "تأیید شده" : "در انتظار تأیید"}
      </span>
      <div className="sm-users-actions">
        {approved ? (
          <button
            type="button"
            className="sm-revoke"
            disabled={busy === "access"}
            onClick={() =>
              void run("access", () =>
                send(`/api/users/${user.id}/revoke`, "PATCH"),
              )
            }
          >
            <em className="icon ni ni-user-cross" />
            <span>{busy === "access" ? "…" : "لغو دسترسی"}</span>
          </button>
        ) : (
          <button
            type="button"
            className="sm-approve"
            disabled={busy === "access"}
            onClick={() =>
              void run("access", () =>
                send(`/api/users/${user.id}/approve`, "PATCH"),
              )
            }
          >
            {busy === "access" ? "…" : "تأیید دسترسی"}
          </button>
        )}
      </div>
    </article>
  );
}

function AddUser({ onClose }: { onClose: () => void }) {
  const router = useRouter();
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
      await send("/api/auth/register", "POST", {
        first_name: String(data.get("first_name") ?? ""),
        last_name: String(data.get("last_name") ?? ""),
        mobile: String(data.get("mobile") ?? ""),
        password: String(data.get("password") ?? ""),
        password_confirmation: String(data.get("password") ?? ""),
        national_code: String(data.get("national_code") ?? ""),
        birth_date: String(data.get("birth_date") ?? ""),
        address: String(data.get("address") ?? ""),
      });
      onClose();
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "ساخت حساب انجام نشد.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal fade show d-block" role="dialog" aria-modal="true">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-body">
            <button
              type="button"
              className="close"
              aria-label="بستن"
              onClick={onClose}
            >
              <em className="icon ni ni-cross" />
            </button>
            <h5 className="title mb-3">افزودن کاربر</h5>
            <form onSubmit={submit}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label" htmlFor="add-first">
                    نام
                  </label>
                  <input
                    id="add-first"
                    className="form-control"
                    name="first_name"
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="add-last">
                    نام خانوادگی
                  </label>
                  <input
                    id="add-last"
                    className="form-control"
                    name="last_name"
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="add-mobile">
                    موبایل
                  </label>
                  <input
                    id="add-mobile"
                    className="form-control"
                    name="mobile"
                    dir="ltr"
                    inputMode="numeric"
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="add-password">
                    رمز عبور
                  </label>
                  <input
                    id="add-password"
                    className="form-control"
                    name="password"
                    type="password"
                    minLength={8}
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="add-national">
                    کد ملی
                  </label>
                  <input
                    id="add-national"
                    className="form-control"
                    name="national_code"
                    dir="ltr"
                    inputMode="numeric"
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="add-birth">
                    تاریخ تولد
                  </label>
                  <input
                    id="add-birth"
                    className="form-control"
                    name="birth_date"
                    placeholder="۱۴۰۰/۰۱/۰۱"
                    required
                  />
                </div>
                <div className="col-12">
                  <label className="form-label" htmlFor="add-address">
                    نشانی
                  </label>
                  <input
                    id="add-address"
                    className="form-control"
                    name="address"
                    required
                  />
                </div>
              </div>
              {message && (
                <p role="alert" className="text-danger mt-3">
                  {message}
                </p>
              )}
              <button
                className="btn btn-primary mt-3"
                type="submit"
                disabled={busy}
              >
                {busy ? "در حال ساخت…" : "افزودن"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export function UsersDirectory({
  users,
  departments,
  levels,
  error,
}: {
  users: DirectoryUser[];
  departments: DirectoryDepartment[];
  levels: DirectoryLevel[];
  error: string | null;
}) {
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState("");
  const [status, setStatus] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const pending = users.filter((user) => !user.approvedAt).length;
  const summary = `${faNum(users.length)} حساب، ${pending === 0 ? "هیچ حسابی در انتظار تأیید نیست." : `${faNum(pending)} حساب در انتظار تأیید است.`} — حالت ثبت‌نام: نیازمند تأیید مدیر`;
  const visible = useMemo(() => {
    const needle = applied.trim().toLowerCase();
    return users.filter((user) => {
      if (status === "approved" && !user.approvedAt) return false;
      if (status === "pending" && user.approvedAt) return false;
      if (!needle) return true;
      return (
        fullName(user).toLowerCase().includes(needle) ||
        user.mobile.includes(needle)
      );
    });
  }, [applied, status, users]);

  return (
    <div className="sm-org-page">
      <div className="sm-org-hero">
        <div className="sm-org-hero__copy">
          <span className="sm-page-head__eyebrow">ساختار سازمانی</span>
          <h1>اسمارت منیجر در یک نگاه</h1>
          <p>
            سطح دسترسی هر شخص در همین سازمان تعریف می‌شود و فقط داده مجاز خودش را
            می‌بیند.
          </p>
        </div>
        <span className="sm-timezone-badge">
          <em className="icon ni ni-map-pin" />
          <span>منطقه زمانی تهران</span>
        </span>
      </div>
      {departments.length === 0 && (
        <div className="sm-org-banner">
          <p>
            هنوز واحدی تعریف نشده است. از بخش واحدهای سازمانی اولین واحد را
            بسازید.
          </p>
          <Link href="/admin/departments" className="btn sm-btn-ghost">
            مدیریت واحدها
          </Link>
        </div>
      )}
      {error && (
        <div role="alert" className="alert alert-fill alert-warning mb-3">
          {error}
        </div>
      )}
      <section className="card card-bordered sm-users-card">
        <div className="sm-users-toolbar">
          <div className="sm-users-toolbar-meta">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setAddOpen(true)}
            >
              <span>افزودن</span>
              <em className="icon ni ni-plus" />
            </button>
            <p className="sm-users-summary">{summary}</p>
          </div>
          <form
            className="sm-users-search"
            onSubmit={(event) => {
              event.preventDefault();
              setApplied(query);
            }}
          >
            <input
              type="search"
              value={query}
              placeholder="جستجوی نام یا موبایل"
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              className="form-select"
              aria-label="وضعیت"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">همه</option>
              <option value="approved">تأیید شده</option>
              <option value="pending">در انتظار تأیید</option>
            </select>
            <button
              className="btn sm-btn-ghost"
              type="submit"
              aria-label="جستجو"
            >
              <em className="icon ni ni-search" />
            </button>
          </form>
        </div>
        <div className="sm-users-scroll">
          <div className="sm-users-head">
            <span>کاربر</span>
            <span>موبایل</span>
            <span>سطح دسترسی</span>
            <span>واحد</span>
            <span>وضعیت</span>
            <span>عملیات</span>
          </div>
          {visible.map((user) => (
            <UserRow
              key={textId(user.id)}
              user={user}
              departments={departments}
              levels={levels}
            />
          ))}
          {visible.length === 0 && (
            <p className="sm-users-empty">حسابی با این فیلتر پیدا نشد.</p>
          )}
        </div>
      </section>
      {addOpen && <AddUser onClose={() => setAddOpen(false)} />}
      {addOpen && (
        <button
          type="button"
          className="modal-backdrop fade show"
          aria-label="بستن پنجره"
          onClick={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}

export function DepartmentsDirectory({
  departments,
  users,
  error,
}: {
  departments: DirectoryDepartment[];
  users: DirectoryUser[];
  error: string | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const names = new Map(users.map((user) => [textId(user.id), fullName(user)]));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const manager = String(data.get("managerUserId") ?? "");
    setBusy(true);
    setMessage("");
    try {
      await send("/api/departments", "POST", {
        name: String(data.get("name") ?? "").trim(),
        code: String(data.get("code") ?? "").trim(),
        managerUserId: manager ? Number(manager) : null,
      });
      form.reset();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "واحد ساخته نشد.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sm-org-page">
      <header className="sm-org-hero sm-org-hero--plain">
        <div className="sm-org-hero__copy">
          <h1>واحدهای سازمانی</h1>
          <p>
            واحدها مبنای محدوده داده ماژول‌ها هستند. کاربری بدون واحد، داده
            واحد–محور را نمی‌بیند.
          </p>
        </div>
      </header>
      {error && (
        <div role="alert" className="alert alert-fill alert-warning mb-3">
          {error}
        </div>
      )}
      <section className="card card-bordered sm-dept-create-card">
        <h2>افزودن واحد</h2>
        <form className="sm-dept-create" onSubmit={submit}>
          <label htmlFor="dept-name">
            نام واحد
            <input
              id="dept-name"
              className="form-control"
              name="name"
              required
            />
          </label>
          <div className="sm-dept-code">
            <label htmlFor="dept-code">
              کد واحد
              <input
                id="dept-code"
                className="form-control"
                name="code"
                dir="ltr"
                required
                pattern="[A-Za-z0-9_-]+"
              />
            </label>
            <small>انگلیسی، یکتا. برای ارجاع ماژول‌ها</small>
          </div>
          <label htmlFor="dept-manager">
            مدیر واحد
            <select
              id="dept-manager"
              className="form-select"
              name="managerUserId"
              defaultValue=""
            >
              <option value="">بدون مدیر</option>
              {users.map((user) => (
                <option key={textId(user.id)} value={textId(user.id)}>
                  {fullName(user)}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn btn-primary sm-dept-submit"
            type="submit"
            disabled={busy}
          >
            <span>{busy ? "در حال افزودن…" : "افزودن واحد"}</span>
            <em className="icon ni ni-plus" />
          </button>
        </form>
        {message && (
          <p role="alert" className="text-danger mt-3 mb-0">
            {message}
          </p>
        )}
      </section>
      <section className="card card-bordered sm-dept-table">
        <div className="sm-dept-head">
          <span>نام واحد</span>
          <span>کد واحد</span>
          <span>مدیر واحد</span>
          <span>اعضا</span>
          <span>عملیات</span>
        </div>
        {departments.length === 0 ? (
          <div className="sm-dept-empty">
            <em className="icon ni ni-building" />
            <p>هنوز واحدی تعریف نشده است.</p>
          </div>
        ) : (
          departments.map((department) => {
            const members = users.filter(
              (user) => textId(user.departmentId) === textId(department.id),
            ).length;
            return (
              <article className="sm-dept-row" key={textId(department.id)}>
                <strong>{department.name}</strong>
                <span dir="ltr">{department.code}</span>
                <span>
                  {names.get(textId(department.managerUserId)) ?? "بدون مدیر"}
                </span>
                <span>{faNum(members)}</span>
                <span className="text-soft">—</span>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
