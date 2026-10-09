"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { parseApiBody } from "@/lib/api";
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

type Row = {
  id: string | number;
  name: string;
  code: string;
  status?: string;
  domain?: string;
  branchId?: string | number | null;
  branchName?: string | null;
};
type MembershipRow = {
  membership: {
    id: string | number;
    userId: string | number;
    companyId: string | number | null;
    branchId: string | number | null;
    businessUnitId: string | number | null;
    scopeType: "company" | "branch" | "businessUnit";
    status: string;
  };
  user: {
    id: string | number;
    firstName: string | null;
    lastName: string | null;
    mobile: string;
    approvedAt: string | null;
  };
  roles: { id: string | number; key: string; name: string }[];
};
type DelegableRole = { id: string | number; key: string; name: string };
type InvitationRow = {
  id: string | number;
  mobile: string;
  roleId: string | number | null;
  roleKey: string | null;
  roleName: string | null;
  expiresAt: string;
  createdAt: string;
};
type AssignmentScope = "company" | "branch" | "businessUnit";
type Section =
  | "companies"
  | "branches"
  | "business-units"
  | "memberships"
  | "invitations";
type StructureSection = Exclude<Section, "memberships" | "invitations">;

const labels: Record<
  StructureSection,
  { title: string; endpoint: string; columns: string[] }
> = {
  companies: {
    title: "شرکت‌ها",
    endpoint: "companies",
    columns: ["نام شرکت", "کد", "وضعیت"],
  },
  branches: {
    title: "شعبه‌ها",
    endpoint: "branches",
    columns: ["نام شعبه", "کد", "وضعیت"],
  },
  "business-units": {
    title: "واحدهای کسب‌وکار",
    endpoint: "business-units",
    columns: ["نام واحد", "کد", "شعبه", "دامنه"],
  },
};

const sectionNames: Record<Section, string> = {
  companies: "شرکت‌ها",
  branches: "شعبه‌ها",
  "business-units": "واحدهای کسب‌وکار",
  memberships: "اعضا و نقش‌ها",
  invitations: "دعوت‌نامه‌ها",
};

const fieldClassName =
  "h-10 rounded-md border border-brand-line bg-white px-3 text-sm text-brand-ink shadow-sm outline-none transition focus:border-brand-copper focus:ring-4 focus:ring-brand-copper/10";

async function api<T>(path: string, init?: RequestInit) {
  const response = await fetch(`/api/tenant-admin/${path}`, {
    ...init,
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "accept-language": "fa",
      ...init?.headers,
    },
  });
  const parsed = parseApiBody<T>(await response.json().catch(() => ({})));
  if (!response.ok) throw new Error(parsed.message ?? "درخواست انجام نشد.");
  return parsed.payload;
}

export function TenantAdminBoard() {
  const [section, setSection] = useState<Section>("companies");
  const [rows, setRows] = useState<Record<StructureSection, Row[]>>({
    companies: [],
    branches: [],
    "business-units": [],
  });
  const [branches, setBranches] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [delegableRoles, setDelegableRoles] = useState<DelegableRole[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string[]>>(
    {},
  );
  const [companies, setCompanies] = useState<Row[]>([]);
  const [membershipCompanyId, setMembershipCompanyId] = useState("");
  const [membershipBranches, setMembershipBranches] = useState<Row[]>([]);
  const [membershipUnits, setMembershipUnits] = useState<Row[]>([]);
  const [assignmentScope, setAssignmentScope] =
    useState<AssignmentScope>("company");
  const [assigning, setAssigning] = useState(false);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [invitationCompanyId, setInvitationCompanyId] = useState("");
  const [createdInvitationLinks, setCreatedInvitationLinks] = useState<{
    registration: string;
    accept: string;
  } | null>(null);

  const reload = useCallback(async (key: StructureSection) => {
    setError("");
    try {
      const result = await api<Row[]>(labels[key].endpoint);
      setRows((current) => ({
        ...current,
        [key]: Array.isArray(result) ? result : [],
      }));
      if (key === "branches") setBranches(Array.isArray(result) ? result : []);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "دریافت اطلاعات انجام نشد.",
      );
    }
  }, []);

  useEffect(() => {
    if (section === "memberships" || section === "invitations") {
      setError("");
      if (section === "invitations") {
        void Promise.all([
          api<DelegableRole[]>("delegable-roles").then((result) =>
            setDelegableRoles(Array.isArray(result) ? result : []),
          ),
          api<Row[]>("companies").then((result) => {
            const list = Array.isArray(result) ? result : [];
            setCompanies(list);
            setInvitationCompanyId((current) =>
              list.some((company) => String(company.id) === current)
                ? current
                : String(list[0]?.id ?? ""),
            );
          }),
        ]).catch((cause) =>
          setError(
            cause instanceof Error
              ? cause.message
              : "دریافت اطلاعات انجام نشد.",
          ),
        );
        return;
      }
      void Promise.all([
        api<MembershipRow[]>("memberships").then((result) => {
          const list = Array.isArray(result) ? result : [];
          setMemberships(list);
          setSelectedRoles(
            Object.fromEntries(
              list.map((item) => [
                String(item.membership.id),
                item.roles.map((role) => String(role.id)),
              ]),
            ),
          );
        }),
        api<DelegableRole[]>("delegable-roles").then((result) =>
          setDelegableRoles(Array.isArray(result) ? result : []),
        ),
        api<Row[]>("companies").then((result) => {
          const list = Array.isArray(result) ? result : [];
          setCompanies(list);
          setMembershipCompanyId((current) =>
            list.some((company) => String(company.id) === current)
              ? current
              : String(list[0]?.id ?? ""),
          );
        }),
        api<Row[]>("branches")
          .then((result) =>
            setMembershipBranches(Array.isArray(result) ? result : []),
          )
          .catch(() => setMembershipBranches([])),
        api<Row[]>("business-units")
          .then((result) =>
            setMembershipUnits(Array.isArray(result) ? result : []),
          )
          .catch(() => setMembershipUnits([])),
      ]).catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : "دریافت اطلاعات انجام نشد.",
        ),
      );
      return;
    }
    void reload(section);
    if (section === "business-units") void reload("branches");
  }, [reload, section]);

  useEffect(() => {
    if (section !== "invitations" || !invitationCompanyId) return;
    void api<InvitationRow[]>(
      `invitations?companyId=${encodeURIComponent(invitationCompanyId)}`,
    )
      .then((result) => setInvitations(Array.isArray(result) ? result : []))
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "دریافت دعوت‌نامه‌ها انجام نشد.",
        ),
      );
  }, [invitationCompanyId, section]);

  const saveRoles = async (row: MembershipRow) => {
    const membership = row.membership;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api("memberships", {
        method: "POST",
        body: JSON.stringify({
          userId: String(membership.userId),
          companyId:
            membership.companyId == null
              ? undefined
              : String(membership.companyId),
          branchId:
            membership.branchId == null
              ? undefined
              : String(membership.branchId),
          businessUnitId:
            membership.businessUnitId == null
              ? undefined
              : String(membership.businessUnitId),
          scopeType: membership.scopeType,
          roleIds: selectedRoles[String(membership.id)] ?? [],
        }),
      });
      setNotice("نقش‌های عضویت به‌روزرسانی شد.");
      const result = await api<MembershipRow[]>("memberships");
      const list = Array.isArray(result) ? result : [];
      setMemberships(list);
      setSelectedRoles(
        Object.fromEntries(
          list.map((item) => [
            String(item.membership.id),
            item.roles.map((role) => String(role.id)),
          ]),
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "به‌روزرسانی نقش انجام نشد.",
      );
    } finally {
      setBusy(false);
    }
  };

  const revokeMembership = async (membershipId: string | number) => {
    if (!window.confirm("دسترسی این عضویت لغو شود؟")) return;
    setBusy(true);
    setError("");
    try {
      await api(`memberships/${membershipId}`, { method: "DELETE" });
      setMemberships((current) =>
        current.filter(
          (row) => String(row.membership.id) !== String(membershipId),
        ),
      );
      setNotice("عضویت لغو شد.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "لغو عضویت انجام نشد.");
    } finally {
      setBusy(false);
    }
  };

  const assignMembership = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const roleIds = data.getAll("roleIds").map(String);
    const body = {
      userId: String(data.get("userId") ?? "").trim(),
      companyId: String(data.get("companyId") ?? "") || undefined,
      branchId:
        assignmentScope === "branch"
          ? String(data.get("branchId") ?? "") || undefined
          : undefined,
      businessUnitId:
        assignmentScope === "businessUnit"
          ? String(data.get("businessUnitId") ?? "") || undefined
          : undefined,
      scopeType: assignmentScope,
      roleIds,
    };
    setAssigning(true);
    setError("");
    setNotice("");
    try {
      await api("memberships", { method: "POST", body: JSON.stringify(body) });
      form.reset();
      setAssignmentScope("company");
      setNotice("عضویت ایجاد یا به‌روزرسانی شد.");
      const result = await api<MembershipRow[]>("memberships");
      const list = Array.isArray(result) ? result : [];
      setMemberships(list);
      setSelectedRoles(
        Object.fromEntries(
          list.map((item) => [
            String(item.membership.id),
            item.roles.map((role) => String(role.id)),
          ]),
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ثبت عضویت انجام نشد.");
    } finally {
      setAssigning(false);
    }
  };

  const editStructureRow = async (row: Row) => {
    const name = window.prompt("نام جدید", row.name)?.trim();
    if (!name) return;
    const code = window.prompt("کد جدید", row.code)?.trim();
    if (!code) return;
    const body: Record<string, string> = { name, code };
    if (section === "business-units")
      body.domain =
        window.prompt("دامنه", row.domain ?? "general")?.trim() || "general";
    const endpoint =
      section === "branches"
        ? `branches/${row.id}`
        : `business-units/${row.id}`;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(endpoint, { method: "PATCH", body: JSON.stringify(body) });
      setNotice("ساختار به‌روزرسانی شد.");
      await reload(section as StructureSection);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "به‌روزرسانی انجام نشد.",
      );
    } finally {
      setBusy(false);
    }
  };

  const createInvitation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    setNotice("");
    setCreatedInvitationLinks(null);
    try {
      const result = await api<{ invitation: InvitationRow; token: string }>(
        "invitations",
        {
          method: "POST",
          body: JSON.stringify({
            mobile: String(data.get("mobile") ?? "").trim(),
            roleId: String(data.get("roleId") ?? ""),
            companyId: invitationCompanyId || undefined,
          }),
        },
      );
      const registerUrl = new URL("/register", window.location.origin);
      registerUrl.searchParams.set("invitation", result.token);
      const acceptUrl = new URL("/accept-invitation", window.location.origin);
      acceptUrl.searchParams.set("token", result.token);
      setCreatedInvitationLinks({
        registration: registerUrl.toString(),
        accept: acceptUrl.toString(),
      });
      setNotice(
        "دعوت ساخته شد. لینک فقط همین بار نمایش داده می‌شود؛ آن را به شمارهٔ دعوت‌شده برسانید.",
      );
      form.reset();
      const rows = await api<InvitationRow[]>(
        `invitations?companyId=${encodeURIComponent(invitationCompanyId)}`,
      );
      setInvitations(Array.isArray(rows) ? rows : []);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "ساخت دعوت‌نامه انجام نشد.",
      );
    } finally {
      setBusy(false);
    }
  };

  const revokeInvitation = async (invitationId: string | number) => {
    if (!window.confirm("این دعوت‌نامه باطل شود؟")) return;
    setBusy(true);
    setError("");
    try {
      await api(`invitations/${invitationId}`, { method: "DELETE" });
      setInvitations((current) =>
        current.filter((row) => String(row.id) !== String(invitationId)),
      );
      setNotice("دعوت‌نامه باطل شد.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "ابطال دعوت‌نامه انجام نشد.",
      );
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (section === "memberships" || section === "invitations") return;
    const key = section;
    const form = event.currentTarget;
    const data = new FormData(form);
    const body: Record<string, unknown> = {
      name: String(data.get("name") ?? "").trim(),
      code: String(data.get("code") ?? "").trim(),
    };
    if (section === "business-units") {
      body.domain = String(data.get("domain") ?? "general").trim() || "general";
      body.branchId = String(data.get("branchId") ?? "") || null;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(labels[key].endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });
      form.reset();
      setNotice("اطلاعات با موفقیت ثبت شد.");
      await reload(key);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "ثبت اطلاعات انجام نشد.",
      );
    } finally {
      setBusy(false);
    }
  };

  const structureSection: StructureSection =
    section === "memberships" || section === "invitations"
      ? "companies"
      : section;
  const current = labels[structureSection];
  return (
    <section className="space-y-5" dir="rtl">
      <div className="nk-block-head nk-block-head-sm">
        <div className="nk-block-between flex-wrap gap-3">
          <div className="nk-block-head-content">
            <span className="overline-title">ساختار سازمانی</span>
            <h1 className="nk-block-title page-title">مدیریت ساختار شرکت</h1>
            <div className="nk-block-des text-soft">
              <p>
                شرکت‌ها، شعبه‌ها، واحدهای کسب‌وکار و دسترسی اعضا را در محدودهٔ مجاز
                خود مدیریت کنید.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-brand-canvas px-3 py-1.5 text-xs font-medium text-brand-muted">
            <span
              className="size-1.5 rounded-full bg-brand-copper"
              aria-hidden="true"
            />
            اطلاعات بر اساس محدودهٔ دسترسی شما
          </span>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <div
          className="flex min-w-max gap-1"
          role="tablist"
          aria-label="بخش‌های ساختار شرکت"
        >
          {(
            [...Object.keys(labels), "memberships", "invitations"] as Section[]
          ).map((key) => (
            <Button
              key={key}
              type="button"
              variant="ghost"
              role="tab"
              aria-selected={section === key}
              className={
                section === key
                  ? "bg-brand-copper text-white hover:bg-[#86654d] hover:text-white focus-visible:ring-4 focus-visible:ring-brand-copper/20"
                  : "text-slate-600 hover:bg-brand-canvas hover:text-brand-ink focus-visible:ring-4 focus-visible:ring-brand-copper/20"
              }
              onClick={() => setSection(key)}
            >
              {sectionNames[key]}
            </Button>
          ))}
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}
      {section === "memberships" ? (
        <div className="space-y-4">
          <form
            onSubmit={assignMembership}
            className="card card-bordered grid gap-3 p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4"
          >
            <h2 className="text-lg font-semibold text-slate-900 sm:col-span-2 lg:col-span-4">
              افزودن یا به‌روزرسانی عضویت
            </h2>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              شناسهٔ کاربر
              <Input
                name="userId"
                required
                inputMode="numeric"
                pattern="[1-9][0-9]*"
                className="font-normal"
                dir="ltr"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              شرکت
              <select
                name="companyId"
                required
                value={membershipCompanyId}
                onChange={(event) => setMembershipCompanyId(event.target.value)}
                className={`${fieldClassName} font-normal`}
              >
                <option value="">انتخاب شرکت</option>
                {companies.map((company) => (
                  <option key={String(company.id)} value={String(company.id)}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              دامنهٔ عضویت
              <select
                value={assignmentScope}
                onChange={(event) =>
                  setAssignmentScope(event.target.value as AssignmentScope)
                }
                className={`${fieldClassName} font-normal`}
              >
                <option value="company">شرکت</option>
                <option value="branch">شعبه</option>
                <option value="businessUnit">واحد کسب‌وکار</option>
              </select>
            </label>
            {assignmentScope === "branch" && (
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                شعبه
                <select
                  name="branchId"
                  required
                  className={`${fieldClassName} font-normal`}
                >
                  <option value="">انتخاب شعبه</option>
                  {membershipBranches.map((branch) => (
                    <option key={String(branch.id)} value={String(branch.id)}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {assignmentScope === "businessUnit" && (
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                واحد کسب‌وکار
                <select
                  name="businessUnitId"
                  required
                  className={`${fieldClassName} font-normal`}
                >
                  <option value="">انتخاب واحد</option>
                  {membershipUnits.map((unit) => (
                    <option key={String(unit.id)} value={String(unit.id)}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="grid gap-1 text-sm font-medium text-slate-700 lg:col-span-2">
              نقش‌ها
              <select
                name="roleIds"
                required
                multiple
                className="min-h-24 w-full rounded-md border border-brand-line bg-white p-2 text-sm shadow-sm outline-none focus:border-brand-copper focus:ring-4 focus:ring-brand-copper/10"
              >
                {delegableRoles.map((role) => (
                  <option key={String(role.id)} value={String(role.id)}>
                    {role.name} ({role.key})
                  </option>
                ))}
              </select>
              <span className="text-xs font-normal text-slate-500">
                برای انتخاب چند نقش از Ctrl یا Command استفاده کنید.
              </span>
            </label>
            <div className="flex items-end">
              <Button
                type="submit"
                className="bg-brand-copper hover:bg-[#86654d]"
                disabled={
                  assigning ||
                  delegableRoles.length === 0 ||
                  companies.length === 0
                }
              >
                {assigning ? "در حال ثبت…" : "ثبت عضویت"}
              </Button>
            </div>
          </form>
          <div className="card card-bordered p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">
              عضویت‌های در محدودهٔ دسترسی شما
            </h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>کاربر</TableHead>
                  <TableHead>وضعیت</TableHead>
                  <TableHead>نقش‌های قابل تفویض</TableHead>
                  <TableHead>عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberships.map((row) => {
                  const id = String(row.membership.id);
                  const companyScoped = row.membership.companyId !== null;
                  const canEditRoles = row.roles.every((role) =>
                    delegableRoles.some(
                      (candidate) => String(candidate.id) === String(role.id),
                    ),
                  );
                  return (
                    <TableRow key={id}>
                      <TableCell>
                        <div className="font-medium">
                          {[row.user.firstName, row.user.lastName]
                            .filter(Boolean)
                            .join(" ") || "بدون نام"}
                        </div>
                        <div className="text-xs text-slate-500" dir="ltr">
                          {row.user.mobile}
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.membership.status === "active"
                          ? "فعال"
                          : "در انتظار تأیید"}
                      </TableCell>
                      <TableCell>
                        <select
                          multiple
                          aria-label={`نقش‌های ${row.user.mobile}`}
                          value={selectedRoles[id] ?? []}
                          onChange={(event) =>
                            setSelectedRoles((current) => ({
                              ...current,
                              [id]: Array.from(
                                event.currentTarget.selectedOptions,
                                (option) => option.value,
                              ),
                            }))
                          }
                          className="min-h-24 w-full rounded-md border border-brand-line bg-white p-2 text-sm shadow-sm outline-none focus:border-brand-copper focus:ring-4 focus:ring-brand-copper/10"
                          disabled={busy}
                        >
                          {delegableRoles.map((role) => (
                            <option
                              key={String(role.id)}
                              value={String(role.id)}
                            >
                              {role.name} ({role.key})
                            </option>
                          ))}
                        </select>
                        {row.roles.length > 0 && (
                          <p className="mt-1 text-xs text-slate-500">
                            فعلی:{" "}
                            {row.roles.map((role) => role.name).join("، ")}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={
                              busy ||
                              !companyScoped ||
                              !canEditRoles ||
                              delegableRoles.length === 0
                            }
                            onClick={() => void saveRoles(row)}
                          >
                            ذخیره نقش‌ها
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={busy || !companyScoped}
                            onClick={() => void revokeMembership(id)}
                          >
                            لغو عضویت
                          </Button>
                        </div>
                        {!canEditRoles && (
                          <p className="mt-1 text-xs text-slate-500">
                            این عضویت نقش غیرقابل‌تفویض دارد و از این صفحه قابل
                            تغییر نیست.
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {memberships.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-slate-500"
                    >
                      عضوی در این محدوده پیدا نشد.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <p className="mt-3 text-xs text-slate-500">
              فهرست نقش‌ها فقط نقش‌های غیرسیستمی را نشان می‌دهد که مجوزها و
              دامنه‌شان زیرمجموعهٔ دسترسی فعلی شماست.
            </p>
          </div>
        </div>
      ) : section === "invitations" ? (
        <div className="space-y-4">
          <form
            onSubmit={createInvitation}
            className="card card-bordered grid gap-3 p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4"
          >
            <h2 className="text-lg font-semibold text-slate-900 sm:col-span-2 lg:col-span-4">
              دعوت عضو جدید
            </h2>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              شمارهٔ موبایل
              <Input
                name="mobile"
                type="tel"
                required
                pattern="09[0-9]{9}"
                maxLength={11}
                dir="ltr"
                className="font-normal"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              شرکت
              <select
                name="companyId"
                required
                value={invitationCompanyId}
                onChange={(event) => setInvitationCompanyId(event.target.value)}
                className={`${fieldClassName} font-normal`}
              >
                <option value="">انتخاب شرکت</option>
                {companies.map((company) => (
                  <option key={String(company.id)} value={String(company.id)}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              نقش
              <select
                name="roleId"
                required
                className={`${fieldClassName} font-normal`}
              >
                <option value="">انتخاب نقش</option>
                {delegableRoles.map((role) => (
                  <option key={String(role.id)} value={String(role.id)}>
                    {role.name} ({role.key})
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <Button
                type="submit"
                className="bg-brand-copper hover:bg-[#86654d]"
                disabled={
                  busy || delegableRoles.length === 0 || companies.length === 0
                }
              >
                {busy ? "در حال ساخت…" : "ساخت دعوت"}
              </Button>
            </div>
          </form>
          {createdInvitationLinks && (
            <div className="space-y-3 rounded-lg border border-brand-copper/30 bg-brand-copper/5 p-4 text-sm text-brand-ink">
              <p className="font-semibold">
                توکن خام ذخیره نمی‌شود و دوباره قابل بازیابی نیست. لینک را امن به
                همان شمارهٔ موبایل ارسال کنید.
              </p>
              <label className="grid gap-1">
                ثبت‌نام با دعوت
                <Input
                  readOnly
                  dir="ltr"
                  value={createdInvitationLinks.registration}
                  className="border-brand-line text-xs"
                />
              </label>
              <label className="grid gap-1">
                پذیرش برای حساب موجود
                <Input
                  readOnly
                  dir="ltr"
                  value={createdInvitationLinks.accept}
                  className="border-brand-line text-xs"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(createdInvitationLinks.registration)
                      .then(() => setNotice("لینک ثبت‌نام کپی شد."))
                  }
                >
                  کپی لینک ثبت‌نام
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(createdInvitationLinks.accept)
                      .then(() => setNotice("لینک حساب موجود کپی شد."))
                  }
                >
                  کپی لینک حساب موجود
                </Button>
              </div>
            </div>
          )}
          <div className="card card-bordered p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">
              دعوت‌های معتبر و پذیرفته‌نشده
            </h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>شماره موبایل</TableHead>
                  <TableHead>نقش</TableHead>
                  <TableHead>انقضا</TableHead>
                  <TableHead>عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={String(invitation.id)}>
                    <TableCell dir="ltr">{invitation.mobile}</TableCell>
                    <TableCell>
                      {invitation.roleName ??
                        invitation.roleKey ??
                        "نقش حذف شده"}
                    </TableCell>
                    <TableCell>
                      {new Date(invitation.expiresAt).toLocaleString("fa-IR")}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => void revokeInvitation(invitation.id)}
                      >
                        ابطال
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {invitations.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-slate-500"
                    >
                      دعوت معتبری وجود ندارد.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <>
          <form
            onSubmit={submit}
            className="card card-bordered grid gap-3 p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4"
          >
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              نام
              <Input
                name="name"
                required
                minLength={2}
                maxLength={160}
                className="font-normal"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              کد
              <Input
                name="code"
                required
                minLength={2}
                maxLength={48}
                pattern="[A-Za-z0-9_-]+"
                dir="ltr"
                className="font-normal"
              />
            </label>
            {section === "business-units" && (
              <>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  شعبه (اختیاری)
                  <select
                    name="branchId"
                    defaultValue=""
                    className={`${fieldClassName} font-normal`}
                  >
                    <option value="">بدون شعبه</option>
                    {branches.map((branch) => (
                      <option key={String(branch.id)} value={String(branch.id)}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  دامنه
                  <Input
                    name="domain"
                    defaultValue="general"
                    maxLength={64}
                    className="font-normal"
                  />
                </label>
              </>
            )}
            <div className="flex items-end">
              <Button
                type="submit"
                className="bg-brand-copper hover:bg-[#86654d]"
                disabled={busy}
              >
                {busy ? "در حال ثبت…" : "افزودن"}
              </Button>
            </div>
          </form>
          <div className="card card-bordered p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">
              {current.title}
            </h2>
            <Table>
              <TableHeader>
                <TableRow>
                  {current.columns.map((column) => (
                    <TableHead key={column}>{column}</TableHead>
                  ))}
                  {section !== "companies" && <TableHead>عملیات</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows[structureSection].map((row) => (
                  <TableRow key={String(row.id)}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell dir="ltr">{row.code}</TableCell>
                    {section === "business-units" ? (
                      <>
                        <TableCell>{row.branchName ?? "—"}</TableCell>
                        <TableCell>{row.domain ?? "general"}</TableCell>
                      </>
                    ) : (
                      <TableCell>{row.status ?? "فعال"}</TableCell>
                    )}
                    {section !== "companies" && (
                      <TableCell>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void editStructureRow(row)}
                        >
                          ویرایش
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {rows[structureSection].length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={
                        current.columns.length +
                        (section === "companies" ? 0 : 1)
                      }
                      className="py-8 text-center text-slate-500"
                    >
                      موردی برای نمایش نیست.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </section>
  );
}

export function AcceptInvitationBoard() {
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, []);

  const accept = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ membership: { status: string } }>(
        "invitations/accept",
        { method: "POST", body: JSON.stringify({ token }) },
      );
      setMessage(
        result.membership.status === "active"
          ? "دعوت پذیرفته شد و عضویت فعال است."
          : "دعوت پذیرفته شد؛ عضویت پس از تأیید مدیر فعال می‌شود.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "پذیرش دعوت انجام نشد.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section dir="rtl" className="mx-auto max-w-xl space-y-5">
      <div className="nk-block-head nk-block-head-sm">
        <span className="overline-title">عضویت سازمانی</span>
        <h1 className="nk-block-title page-title">پذیرش دعوت شرکت</h1>
        <p className="nk-block-des text-soft mt-1">
          برای پذیرش دعوت باید با حسابی وارد شده باشید که شمارهٔ موبایل آن با
          دعوت برابر است.
        </p>
      </div>
      <div className="card card-bordered">
        <div className="card-inner space-y-4">
          <p className="text-sm text-slate-600">
            پس از تأیید، نقش دعوت‌شده در شرکت مربوط به عضویت شما اضافه می‌شود.
          </p>
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {error}
            </p>
          )}
          {message && (
            <p
              role="status"
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
            >
              {message}
            </p>
          )}
          <Button
            type="button"
            disabled={!token || busy || Boolean(message)}
            className="bg-brand-copper hover:bg-[#86654d]"
            onClick={() => void accept()}
          >
            {busy ? "در حال بررسی…" : "پذیرش دعوت"}
          </Button>
        </div>
      </div>
    </section>
  );
}
