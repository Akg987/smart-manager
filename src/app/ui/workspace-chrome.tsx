"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const beforeOrg = [
  { label: "نمای کلی", href: "/dashboard", icon: "ni-grid-alt" },
  { label: "ثبت‌های من", href: "/checkins", icon: "ni-edit" },
  { label: "هشدارها", href: "/alerts", icon: "ni-alert-circle" },
  { label: "اقدام‌ها", href: "/actions", icon: "ni-check-circle" },
  { label: "استودیو KPI", href: "/kpis", icon: "ni-growth" },
];

const orgLinks = [
  { label: "کاربران", href: "/admin/users" },
  { label: "واحدهای سازمانی", href: "/admin/departments" },
];

const profileLinks = [
  { label: "اطلاعات شخصی", href: "/profile", icon: "ni-user-alt" },
  { label: "عکس پروفایل", href: "/profile/photo", icon: "ni-camera" },
  { label: "تنظیمات امنیتی", href: "/profile/security", icon: "ni-lock-alt" },
];

const afterOrg = [
  { label: "گزارش هفتگی", href: "/kpi-reports/weekly", icon: "ni-reports" },
  { label: "ماژول‌ها", href: "/admin/modules", icon: "ni-puzzle" },
  { label: "تاریخچه تغییرات", href: "/admin/audit-log", icon: "ni-clock" },
  { label: "تنظیمات", href: "/settings", icon: "ni-setting" },
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

export function WorkspaceChrome({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
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
    fetch("/api/auth/me", {
      credentials: "same-origin",
      headers: { "accept-language": "fa" },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        const next = result?.user ?? result?.data?.user;
        if (active && next) setUser(next);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    fetch("/api/data/inbox", {
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
    const response = await fetch("/api/notifications/read-all", {
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
          className="sm-mobile-scrim xl:hidden"
          onClick={closeSidebar}
        />
      )}
      <div className="nk-main">
        <aside
          className={`nk-sidebar nk-sidebar-fixed is-dark sm-shell-sidebar ${mobileOpen ? "is-mobile-open" : ""}`}
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
                  {beforeOrg.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      path={pathname}
                      close={closeSidebar}
                    />
                  ))}
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
                        {orgLinks.map((item) => (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              onClick={closeSidebar}
                              className={
                                isActive(item.href, pathname) ? "is-active" : ""
                              }
                            >
                              {item.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                  {afterOrg.map((item) => (
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
        <div className="nk-wrap sm-shell-main">
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
                <div className="nk-content-body">{children}</div>
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
