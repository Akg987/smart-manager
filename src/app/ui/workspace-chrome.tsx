"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const navigation = [
	{ title: "نمای کلی", items: [{ label: "داشبورد", href: "/dashboard", icon: "ni-dashboard" }] },
	{ title: "سازمان", items: [{ label: "کاربران", href: "/admin/users", icon: "ni-users" }, { label: "واحدها", href: "/admin/departments", icon: "ni-building" }, { label: "سطح دسترسی", href: "/admin/access-levels", icon: "ni-lock-alt" }, { label: "نقش‌ها و مجوزها", href: "/admin/roles", icon: "ni-shield" }] },
	{ title: "عملیات", items: [{ label: "شاخص‌های کلیدی", href: "/kpis", icon: "ni-growth" }, { label: "ثبت عملکرد", href: "/checkins", icon: "ni-edit" }, { label: "اقدام‌های اصلاحی", href: "/actions", icon: "ni-list-round" }, { label: "هشدارها", href: "/alerts", icon: "ni-alert-circle" }, { label: "گزارش هفتگی", href: "/kpi-reports/weekly", icon: "ni-reports" }] },
	{ title: "سامانه", items: [{ label: "مدیریت ماژول‌ها", href: "/admin/modules", icon: "ni-block-over" }, { label: "تنظیمات", href: "/settings", icon: "ni-setting" }, { label: "گزارش رویدادها", href: "/admin/audit-log", icon: "ni-file-docs" }] },
];

type CurrentUser = { firstName: string | null; lastName: string | null; mobile: string; role: string };
type Notification = { id: string; title: string; body: string; href: string; readAt: string | null; type: string; createdAt: string };
function Icon({ name, className = "" }: { name: string; className?: string }) { return <em aria-hidden="true" className={`icon ni ${name} ${className}`} />; }
function NavLink({ item, path, close }: { item: { label: string; href: string; icon: string }; path: string; close: () => void }) {
	const active = item.href === "/dashboard" ? path === "/" || path === "/dashboard" : path === item.href || path.startsWith(`${item.href}/`);
	return <li className={`nk-menu-item ${active ? "active current-menu" : ""}`}><Link href={item.href} onClick={close} className="nk-menu-link"><span className="nk-menu-icon"><Icon name={item.icon} /></span><span className="nk-menu-text">{item.label}</span></Link></li>;
}

export function WorkspaceChrome({ children, title }: { children: React.ReactNode; title: string }) {
	const pathname = usePathname();
	const [mobileOpen, setMobileOpen] = useState(false);
	const [compact, setCompact] = useState(false);
	const [inboxOpen, setInboxOpen] = useState(false);
	const [userOpen, setUserOpen] = useState(false);
	const [user, setUser] = useState<CurrentUser | null>(null);
	const [notifications, setNotifications] = useState<Notification[]>([]);
	const [notice, setNotice] = useState("");
	const [today, setToday] = useState("");
	const closeSidebar = () => setMobileOpen(false);
	const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "کاربر";
	const initials = useMemo(() => fullName.split(/\s+/).map((part) => part[0]).slice(0, 2).join(""), [fullName]);
	const unread = notifications.filter((item) => !item.readAt).length;
	useEffect(() => { setToday(new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "full", timeZone: "Asia/Tehran" }).format(new Date())); }, []);
	useEffect(() => { let active = true; fetch("/api/auth/me", { credentials: "same-origin" }).then((response) => response.ok ? response.json() : null).then((result) => { if (active && result?.user) setUser(result.user); }).catch(() => undefined); return () => { active = false; }; }, []);
	useEffect(() => { if (!inboxOpen) return; let active = true; fetch("/api/data/inbox", { credentials: "same-origin" }).then((response) => response.ok ? response.json() : []).then((result) => { if (active && Array.isArray(result)) setNotifications(result); }).catch(() => { if (active) setNotice("اعلان‌ها دریافت نشدند."); }); return () => { active = false; }; }, [inboxOpen]);
	const readAll = async () => { const response = await fetch("/api/notifications/read-all", { method: "PATCH", credentials: "same-origin" }); if (response.ok) setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() }))); };
	const signOut = async () => { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined); window.location.assign("/login"); };

	return <div className={`nk-app-root sm-shell-root ${compact ? "is-compact" : ""}`}>
		{mobileOpen && <button aria-label="بستن منو" className="sm-mobile-scrim xl:hidden" onClick={closeSidebar} />}
		<div className="nk-main"><aside className={`nk-sidebar nk-sidebar-fixed is-dark sm-shell-sidebar ${mobileOpen ? "is-mobile-open" : ""}`} data-content="sidebarMenu">
			<div className="nk-sidebar-element nk-sidebar-head"><button className="nk-nav-toggle nk-quick-nav-icon d-xl-none" aria-label="بستن منو" onClick={closeSidebar}><Icon name="ni-arrow-right" /></button><button className="nk-nav-compact nk-quick-nav-icon d-none d-xl-inline-flex" aria-label="جمع کردن منو" onClick={() => setCompact(!compact)}><Icon name="ni-menu" /></button><div className="nk-sidebar-brand"><Link href="/dashboard" className="logo-link nk-sidebar-logo" aria-label="داشبورد اسمارت منیجر"><img className="logo-light logo-img brand-logo-full" src="/images/logo.png" alt="" /><img className="logo-light logo-img brand-logo-mark" src="/images/logo-small.png" alt="" /></Link><div className="sm-sidebar-brand-text"><span className="sm-sidebar-brand-name">اسمارت منیجر</span><span className="sm-sidebar-brand-tag">مدیریت هوشمند سازمان</span></div></div></div>
			<div className="nk-sidebar-element nk-sidebar-body"><div className="nk-sidebar-content"><nav className="nk-sidebar-menu" aria-label="منوی اصلی"><ul className="nk-menu">{navigation.flatMap((section) => [<li className="nk-menu-heading" key={section.title}><h6 className="overline-title">{section.title}</h6></li>, ...section.items.map((item) => <NavLink key={item.href} item={item} path={pathname} close={closeSidebar} />)])}</ul></nav></div></div>
			<div className="nk-sidebar-element"><div className="sm-env-chip"><span className="sm-env-dot" /><span>سامانه سازمانی</span></div></div>
		</aside>
		<div className="nk-wrap sm-shell-main"><header className="nk-header nk-header-fixed is-light"><div className="container-fluid"><div className="nk-header-wrap"><div className="nk-menu-trigger d-xl-none ms-n1"><button className="nk-nav-toggle nk-quick-nav-icon" aria-label="باز کردن منو" onClick={() => setMobileOpen(true)}><Icon name="ni-menu" /></button></div><div className="nk-header-brand d-xl-none"><Link href="/dashboard" className="logo-link"><img className="logo-dark logo-img" src="/images/logo-dark.png" alt="اسمارت منیجر" /></Link></div><nav className="sm-header-path" aria-label="مسیر صفحه"><Link href="/dashboard" className="sm-header-path__brand">اسمارت منیجر</Link><span className="sm-header-path__sep">/</span><span className="sm-header-path__current">{title}</span></nav><div className="nk-header-tools"><ul className="nk-quick-nav"><li className="d-none d-md-inline-flex align-items-center"><span className="text-soft sm-date">{today}</span></li>
			<li className={`dropdown notification-dropdown ${inboxOpen ? "show" : ""}`}><button className="dropdown-toggle nk-quick-nav-icon" aria-label="اعلان‌ها" aria-expanded={inboxOpen} onClick={() => { setInboxOpen(!inboxOpen); setUserOpen(false); }}><span className="icon-status"><Icon name="ni-bell" />{unread > 0 && <span className="sm-inbox-count">{unread}</span>}</span></button>{inboxOpen && <div className="dropdown-menu dropdown-menu-xl dropdown-menu-end show"><div className="dropdown-head"><span className="sub-title nk-dropdown-title">اعلان‌ها</span>{unread > 0 && <button className="link-primary" onClick={readAll}>خواندن همه</button>}</div><div className="dropdown-body"><div className="nk-notification">{notifications.map((item) => <Link className="nk-notification-item" href={item.href || "/inbox"} key={item.id}><div className="nk-notification-icon"><Icon name={item.type === "alert" ? "ni-alert-circle" : "ni-info"} className={item.readAt ? "bg-lighter" : "bg-warning-dim"} /></div><div className="nk-notification-content"><div className="nk-notification-text">{item.title}</div><div className="nk-notification-time">{item.body}</div><div className="nk-notification-time">{new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}</div></div></Link>)}{notifications.length === 0 && <p className="text-soft p-3">اعلانی برای نمایش وجود ندارد.</p>}{notice && <p role="alert" className="text-soft p-3">{notice}</p>}</div></div></div>}</li>
			<li className={`dropdown user-dropdown ${userOpen ? "show" : ""}`}><button className="dropdown-toggle" aria-expanded={userOpen} onClick={() => { setUserOpen(!userOpen); setInboxOpen(false); }}><span className="user-toggle"><span className="user-avatar sm"><span>{initials}</span></span><span className="user-info d-none d-md-block"><span className="user-status">{user?.role === "admin" ? "مدیر سامانه" : "کاربر"}</span><span className="user-name dropdown-indicator">{fullName}</span></span></span></button>{userOpen && <div className="dropdown-menu dropdown-menu-md dropdown-menu-end dropdown-menu-s1 show"><div className="dropdown-inner user-card-wrap bg-lighter d-none d-md-block"><div className="user-card"><span className="user-avatar"><span>{initials}</span></span><div className="user-info"><span className="lead-text">{fullName}</span><span className="sub-text" dir="ltr">{user?.mobile ?? ""}</span></div></div></div><div className="dropdown-inner"><ul className="link-list"><li><Link href="/profile"><Icon name="ni-user-alt" />پروفایل من</Link></li><li><Link href="/settings"><Icon name="ni-setting" />تنظیمات</Link></li></ul></div><div className="dropdown-inner"><ul className="link-list"><li><button onClick={signOut}><Icon name="ni-signout" />خروج</button></li></ul></div></div>}</li>
		</ul></div></div></div></header><main className="nk-content"><div className="container-fluid"><div className="nk-content-inner"><div className="nk-content-body">{children}</div></div></div></main><footer className="nk-footer"><div className="container-fluid"><div className="nk-footer-wrap"><div className="nk-footer-copyright">© اسمارت منیجر — تمام حقوق محفوظ است.</div><div className="text-soft">۱.۰</div></div></div></footer></div></div>
	</div>;
}
