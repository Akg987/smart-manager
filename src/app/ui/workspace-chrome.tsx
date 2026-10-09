"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CompanySwitcher } from "@/components/company-switcher";
import { useAuthContext } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";

const beforeOrg = [
  { label: "نمای کلی", href: "/dashboard", icon: "ni-grid-alt" },
  {
    label: "ثبت‌های من",
    href: "/checkins",
    icon: "ni-edit",
    permission: "kpi.submit",
  },
  {
    label: "بررسی ثبت‌ها",
    href: "/checkins/review",
    icon: "ni-check-circle",
    permission: "kpi.review",
  },
  {
    label: "مشاهدات مدیریتی",
    href: "/observations",
    icon: "ni-eye",
    permission: "company.view",
  },
  {
    label: "پرچم‌های قرمز",
    href: "/red-flags",
    icon: "ni-alert",
    permission: "redflag.view",
  },
  {
    label: "هشدارها",
    href: "/alerts",
    icon: "ni-alert-circle",
    permission: "alert.view",
  },
  {
    label: "اقدام‌ها",
    href: "/actions",
    icon: "ni-check-circle",
    permission: "action.view",
  },
  {
    label: "استودیو KPI",
    href: "/kpis",
    icon: "ni-growth",
    permission: "kpi.view",
  },
  {
    label: "واردسازی KPI",
    href: "/kpis/import",
    icon: "ni-upload",
    permission: "kpi.submit",
  },
];

const orgLinks = [
  { label: "کاربران", href: "/admin/users", permission: "users.view" },
  {
    label: "واحدهای سازمانی",
    href: "/admin/departments",
    permission: "unit.view",
  },
  { label: "ساختار شرکت", href: "/admin/tenants", permission: "company.view" },
];

const profileLinks = [
  { label: "اطلاعات شخصی", href: "/profile", icon: "ni-user-alt" },
  { label: "عکس پروفایل", href: "/profile/photo", icon: "ni-camera" },
  { label: "تنظیمات امنیتی", href: "/profile/security", icon: "ni-lock-alt" },
];

const afterOrg = [
  {
    label: "دستیار هوشمند",
    href: "/ai",
    icon: "ni-spark",
    permission: "ai.chat",
  },
  {
    label: "Dashboard Builder",
    href: "/dashboards",
    icon: "ni-grid-alt",
    permission: "dashboard.view",
  },
  {
    label: "Formula Studio",
    href: "/formulas",
    icon: "ni-calculator",
    permission: "formula.view",
  },
  {
    label: "Decisions",
    href: "/decisions",
    icon: "ni-check-circle",
    permission: "decision.view",
  },
  {
    label: "WBR / MBR",
    href: "/management-reviews",
    icon: "ni-reports",
    permission: "meeting.view",
  },
  {
    label: "Reminders & Escalation",
    href: "/management-automation",
    icon: "ni-bell",
    permission: "meeting.update",
  },
  {
    label: "گزارش هفتگی",
    href: "/kpi-reports/weekly",
    icon: "ni-reports",
    permission: "report.view",
  },
  {
    label: "ماژول‌ها",
    href: "/admin/modules",
    icon: "ni-puzzle",
    permission: "integration.view",
  },
  {
    label: "تاریخچه تغییرات",
    href: "/admin/audit-log",
    icon: "ni-clock",
    permission: "audit.view",
  },
  {
    label: "تنظیمات",
    href: "/settings",
    icon: "ni-setting",
    permission: "integration.manage",
  },
];

function jalaliHeaderDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Tehran",
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("weekday")} ${pick("day")} ${pick("month")} ${pick("year")}`
    .replace(/\s+/g, " ")
    .trim();
}

function jalaliYear(date = new Date()) {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    timeZone: "Asia/Tehran",
  }).format(date);
}

function jalaliDayMonthYear(date = new Date()) {
  const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Tehran",
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("day")} ${pick("month")} ${pick("year")}`
    .replace(/\s+/g, " ")
    .trim();
}

export function CommandStatusLine() {
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(jalaliDayMonthYear());
  }, []);
  return <p>به‌روزرسانی وضعیت بر اساس آخرین ثبت‌های تیم در {today}</p>;
}

type CurrentUser = {
  id?: string;
  firstName: string | null;
  lastName: string | null;
  mobile: string;
  role: string;
  avatarPath?: string | null;
};

function ProfileMark({
  initials,
  src,
  className,
}: {
  initials: string;
  src: string | null;
  className: string;
}) {
  return (
    <span className={className}>
      {src ? <img src={src} alt="" /> : initials}
    </span>
  );
}
type Notification = {
  id: string;
  title: string;
  body: string;
  href: string;
  readAt: string | null;
  type: string;
  createdAt: string;
};

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return <em aria-hidden="true" className={`icon ni ${name} ${className}`} />;
}

function isActive(href: string, path: string) {
  if (href === "/dashboard") return path === "/" || path === "/dashboard";
  return path === href || path.startsWith(`${href}/`);
}

function NavLink({
  item,
  path,
  close,
}: {
  item: { label: string; href: string; icon: string };
  path: string;
  close: () => void;
}) {
  const active = isActive(item.href, path);
  return (
    <li className={`nk-menu-item ${active ? "active current-menu" : ""}`}>
      <Link href={item.href} onClick={close} className="nk-menu-link">
        <span className="nk-menu-icon">
          <Icon name={item.icon} />
        </span>
        <span className="nk-menu-text">{item.label}</span>
      </Link>
    </li>
  );
}

function requiredPagePermission(path: string): string | null {
  if (path === "/ai" || path === "/ai/chat") return "ai.chat";
  if (path === "/dashboards" || /^\/dashboards\/\d+$/.test(path))
    return "dashboard.view";
  if (path === "/dashboards/create") return "dashboard.create";
  if (path === "/formulas" || /^\/formulas\/\d+$/.test(path))
    return "formula.view";
  if (path === "/formulas/create") return "formula.create";
  if (path === "/decisions") return "decision.view";
  if (path === "/management-reviews") return "meeting.view";
  if (path === "/management-reviews/create") return "meeting.create";
  if (/^\/management-reviews\/\d+$/.test(path)) return "meeting.view";
  if (path === "/management-automation") return "meeting.update";
  if (path === "/admin/users") return "users.view";
  if (path === "/admin/departments") return "unit.view";
  if (path === "/admin/tenants") return "company.view";
  if (
    path === "/admin/access-levels/create" ||
    /^\/admin\/access-levels\/[^/]+\/edit$/.test(path)
  )
    return "roles.manage";
  if (
    path === "/admin/access-levels" ||
    path === "/admin/roles" ||
    path === "/settings/roles"
  )
    return "roles.view";
  if (path === "/admin/audit-log") return "audit.view";
  if (path === "/admin/modules") return "integration.view";
  if (
    path === "/settings" ||
    path === "/settings/general" ||
    path === "/settings/action-priorities" ||
    path === "/settings/kpi-options" ||
    path === "/sms-ippanel-hub"
  )
    return "integration.manage";
  if (path === "/kpis/create") return "kpi.create";
  if (path === "/kpis/import") return "kpi.submit";
  if (/^\/kpis\/[^/]+\/edit$/.test(path)) return "kpi.update";
  if (path === "/kpis" || /^\/kpis\/[^/]+(?:\/history)?$/.test(path))
    return "kpi.view";
  if (/^\/kpis\/[^/]+\/data$/.test(path)) return "kpi.submit";
  if (path === "/checkins") return "kpi.submit";
  if (path === "/checkins/review") return "kpi.review";
  if (path === "/red-flags") return "redflag.view";
  if (path === "/alerts") return "alert.view";
  if (path === "/observations") return "kpi.view";
  if (path === "/kpi-reports/weekly") return "report.view";
  if (path === "/actions") return "action.view";
  if (path === "/actions/create") return "action.create";
  return null;
}

function RouteAccessBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data, isLoading } = useAuthContext();
  const permission = requiredPagePermission(pathname);
  if (!permission) return children;
  if (isLoading)
    return (
      <div
        role="status"
        className="rounded-xl border bg-card p-6 text-sm text-muted-foreground"
      >
        در حال بررسی دسترسی…
      </div>
    );
  if (data?.permissions.includes(permission)) return children;
  return (
    <section
      role="alert"
      className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm"
    >
      <h1 className="text-xl font-semibold">دسترسی به این صفحه مجاز نیست</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        این بخش در مجوزهای حساب شما قرار ندارد.
      </p>
      <Link
        href="/dashboard"
        className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-primary-foreground"
      >
        بازگشت به داشبورد
      </Link>
    </section>
  );
}

export function WorkspaceChrome({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const { data: authData } = useAuthContext();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const orgActive = orgLinks.some((item) => isActive(item.href, pathname));
  const [orgOpen, setOrgOpen] = useState(orgActive);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notice, setNotice] = useState("");
  const [today, setToday] = useState("");
  const [year, setYear] = useState("");
  const closeSidebar = () => setMobileOpen(false);
  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "کاربر";
  const initials = useMemo(
    () =>
      fullName
        .split(/\s+/)
        .map((part) => part[0])
        .slice(0, 2)
        .join(""),
    [fullName],
  );
  const avatarSrc =
    user?.avatarPath && user.id ? `/api/users/${user.id}/avatar` : null;
  const unread = notifications.filter((item) => !item.readAt).length;
  const permissions = new Set(authData?.permissions ?? []);
  const visibleBeforeOrg = beforeOrg.filter(
    (item) => !item.permission || permissions.has(item.permission),
  );
  const visibleOrgLinks = orgLinks.filter((item) =>
    permissions.has(item.permission),
  );
  const visibleAfterOrg = afterOrg.filter((item) =>
    permissions.has(item.permission),
  );

  useEffect(() => {
    const now = new Date();
    setToday(jalaliHeaderDate(now));
    setYear(jalaliYear(now));
  }, []);
  useEffect(() => {
    if (orgActive) setOrgOpen(true);
  }, [orgActive]);
  useEffect(() => {
    setUserOpen(false);
    setInboxOpen(false);
    setMobileOpen(false);
  }, [pathname]);
  useEffect(() => {
    let active = true;
    apiFetch("/api/auth/me", {
      credentials: "same-origin",
      headers: { "accept-language": "fa" },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        const payload = result?.data ?? result;
        const next = payload?.user;
        if (active && next) setUser(next);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    apiFetch("/api/data/inbox", {
      credentials: "same-origin",
      headers: { "accept-language": "fa" },
    })
      .then((response) => (response.ok ? response.json() : []))
      .then((result) => {
        const rows = Array.isArray(result)
          ? result
          : Array.isArray(result?.data)
            ? result.data
            : [];
        if (active) setNotifications(rows);
      })
      .catch(() => {
        if (active) setNotice("اعلان‌ها دریافت نشدند.");
      });
    return () => {
      active = false;
    };
  }, []);

  const readAll = async () => {
    const response = await apiFetch("/api/notifications/read-all", {
      method: "PATCH",
      credentials: "same-origin",
    });
    if (response.ok)
      setNotifications((items) =>
        items.map((item) => ({
          ...item,
          readAt: item.readAt ?? new Date().toISOString(),
        })),
      );
  };
  const signOut = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    }).catch(() => undefined);
    window.location.assign("/login");
  };

  return (
    <div className="nk-app-root sm-shell-root">
      {mobileOpen && (
        <button
          aria-label="بستن منو"
          className="fixed inset-0 z-[1020] bg-[rgba(15,18,22,0.48)] xl:hidden"
          onClick={closeSidebar}
        />
      )}
      <div className="nk-main">
        <aside
          className={`nk-sidebar nk-sidebar-fixed is-dark z-[1030] transition-transform duration-200 ${mobileOpen ? "translate-x-0" : "translate-x-[110%] min-[1200px]:translate-x-0"}`}
          data-content="sidebarMenu"
        >
          <div className="nk-sidebar-element nk-sidebar-head">
            <button
              className="nk-nav-toggle nk-quick-nav-icon d-xl-none"
              aria-label="بستن منو"
              onClick={closeSidebar}
            >
              <Icon name="ni-arrow-right" />
            </button>
            <div className="nk-sidebar-brand">
              <Link
                href="/dashboard"
                className="logo-link nk-sidebar-logo"
                aria-label="داشبورد اسمارت منیجر"
              >
                <img
                  className="logo-light logo-img brand-logo-full"
                  src="/images/logo.png"
                  alt=""
                />
                <img
                  className="logo-light logo-img brand-logo-mark"
                  src="/images/logo-small.png"
                  alt=""
                />
              </Link>
              <div className="sm-sidebar-brand-text">
                <span className="sm-sidebar-brand-name">اسمارت منیجر</span>
                <span className="sm-sidebar-brand-tag">
                  مدیریت هوشمند سازمان
                </span>
              </div>
            </div>
          </div>
          <div className="nk-sidebar-element nk-sidebar-body">
            <div className="nk-sidebar-content">
              <nav className="nk-sidebar-menu" aria-label="منوی اصلی">
                <ul className="nk-menu">
                  {visibleBeforeOrg.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      path={pathname}
                      close={closeSidebar}
                    />
                  ))}
                  {visibleOrgLinks.length > 0 && (
                    <li
                      className={`nk-menu-item has-sub sm-nav-group ${orgOpen ? "is-open" : ""} ${orgActive ? "active current-menu" : ""}`}
                    >
                      <button
                        type="button"
                        className="nk-menu-link sm-nav-toggle"
                        aria-expanded={orgOpen}
                        onClick={() => setOrgOpen((open) => !open)}
                      >
                        <span className="nk-menu-icon">
                          <Icon name="ni-users" />
                        </span>
                        <span className="nk-menu-text">سازمان و پرسنل</span>
                        <Icon
                          name={orgOpen ? "ni-chevron-up" : "ni-chevron-down"}
                          className="sm-nav-caret"
                        />
                      </button>
                      {orgOpen && (
                        <ul className="sm-nav-sub">
                          {visibleOrgLinks.map((item) => (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                onClick={closeSidebar}
                                className={
                                  isActive(item.href, pathname)
                                    ? "is-active"
                                    : ""
                                }
                              >
                                {item.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  )}
                  {visibleAfterOrg.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      path={pathname}
                      close={closeSidebar}
                    />
                  ))}
                </ul>
              </nav>
            </div>
          </div>
          <div className="nk-sidebar-element">
            <div className="sm-env-chip">
              <span className="sm-env-dot" />
              <span>محیط محلی فعال</span>
            </div>
          </div>
        </aside>
        <div className="nk-wrap min-w-0">
          <header className="nk-header nk-header-fixed is-light">
            <div className="container-fluid">
              <div className="nk-header-wrap">
                <div className="nk-menu-trigger d-xl-none ms-n1">
                  <button
                    className="nk-nav-toggle nk-quick-nav-icon"
                    aria-label="باز کردن منو"
                    onClick={() => setMobileOpen(true)}
                  >
                    <Icon name="ni-menu" />
                  </button>
                </div>
                <div className="nk-header-brand d-xl-none">
                  <Link href="/dashboard" className="logo-link">
                    <img
                      className="logo-dark logo-img"
                      src="/images/logo-dark.png"
                      alt="اسمارت منیجر"
                    />
                  </Link>
                </div>
                <nav className="sm-header-path" aria-label="مسیر صفحه">
                  <Link href="/dashboard" className="sm-header-path__brand">
                    اسمارت منیجر
                  </Link>
                  <span className="sm-header-path__sep">/</span>
                  <span className="sm-header-path__current">{title}</span>
                </nav>
                <div className="nk-header-tools">
                  <div className="sm-header-cluster">
                    <CompanySwitcher />
                    <div
                      className={`dropdown sm-header-slot ${userOpen ? "show" : ""}`}
                    >
                      <button
                        type="button"
                        className="sm-header-user"
                        aria-expanded={userOpen}
                        onClick={() => {
                          setUserOpen(!userOpen);
                          setInboxOpen(false);
                        }}
                      >
                        <ProfileMark
                          initials={initials}
                          src={avatarSrc}
                          className="sm-header-user__avatar"
                        />
                        <span className="sm-header-user__name">{fullName}</span>
                        <Icon
                          name="ni-chevron-down"
                          className="sm-header-user__caret"
                        />
                      </button>
                      {userOpen && (
                        <div className="sm-header-menu sm-user-menu">
                          <div className="sm-user-menu__card">
                            <div className="sm-user-menu__id">
                              <strong>{fullName}</strong>
                              <span dir="ltr">{user?.mobile ?? ""}</span>
                            </div>
                            <ProfileMark
                              initials={initials}
                              src={avatarSrc}
                              className="sm-user-menu__avatar"
                            />
                          </div>
                          <div className="sm-user-menu__links">
                            {profileLinks.map((item) => (
                              <Link
                                href={item.href}
                                className={`sm-user-menu__item ${pathname === item.href ? "is-current" : ""}`}
                                key={item.href}
                              >
                                <Icon name={item.icon} />
                                <span>{item.label}</span>
                              </Link>
                            ))}
                          </div>
                          <button
                            type="button"
                            className="sm-user-menu__item"
                            onClick={signOut}
                          >
                            <Icon name="ni-signout" />
                            <span>خروج</span>
                          </button>
                        </div>
                      )}
                    </div>
                    <div
                      className={`dropdown sm-header-slot ${inboxOpen ? "show" : ""}`}
                    >
                      <button
                        type="button"
                        className="sm-header-bell"
                        aria-label="اعلان‌ها"
                        aria-expanded={inboxOpen}
                        onClick={() => {
                          setInboxOpen(!inboxOpen);
                          setUserOpen(false);
                        }}
                      >
                        <Icon name="ni-bell" />
                        {unread > 0 && (
                          <span className="sm-inbox-count">{unread}</span>
                        )}
                      </button>
                      {inboxOpen && (
                        <div className="dropdown-menu dropdown-menu-xl dropdown-menu-end show sm-header-menu">
                          <div className="dropdown-head">
                            <span className="sub-title nk-dropdown-title">
                              اعلان‌ها
                            </span>
                            {unread > 0 && (
                              <button
                                type="button"
                                className="link-primary"
                                onClick={readAll}
                              >
                                خواندن همه
                              </button>
                            )}
                          </div>
                          <div className="dropdown-body">
                            <div className="nk-notification">
                              {notifications.map((item) => (
                                <Link
                                  className="nk-notification-item"
                                  href={item.href || "/alerts"}
                                  key={item.id}
                                >
                                  <div className="nk-notification-icon">
                                    <Icon
                                      name={
                                        item.type === "alert"
                                          ? "ni-alert-circle"
                                          : "ni-info"
                                      }
                                      className={
                                        item.readAt
                                          ? "bg-lighter"
                                          : "bg-warning-dim"
                                      }
                                    />
                                  </div>
                                  <div className="nk-notification-content">
                                    <div className="nk-notification-text">
                                      {item.title}
                                    </div>
                                    <div className="nk-notification-time">
                                      {item.body}
                                    </div>
                                  </div>
                                </Link>
                              ))}
                              {notifications.length === 0 && (
                                <p className="text-soft p-3">
                                  اعلانی برای نمایش وجود ندارد.
                                </p>
                              )}
                              {notice && (
                                <p role="alert" className="text-soft p-3">
                                  {notice}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <span className="sm-header-date">{today}</span>
                  </div>
                </div>
              </div>
            </div>
          </header>
          <main className="nk-content">
            <div className="container-fluid">
              <div className="nk-content-inner">
                <div className="nk-content-body">
                  <RouteAccessBoundary>{children}</RouteAccessBoundary>
                </div>
              </div>
            </div>
          </main>
          <footer className="nk-footer">
            <div className="container-fluid">
              <div className="nk-footer-wrap">
                <div className="nk-footer-copyright">
                  &copy; {year} اسمارت منیجر — تمام حقوق محفوظ است.
                </div>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
