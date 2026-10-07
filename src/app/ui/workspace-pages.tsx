import Link from "next/link";
import { AvatarRemoveButton, DemoForm, ModuleToggle, type AuthField } from "./auth-form";
import { getRoutePage, type RoutePage } from "./route-catalog";
import { serverApi } from "@/lib/api-server";

type RecordValue = Record<string, unknown>;
const columns: Partial<Record<NonNullable<RoutePage["collection"]>, { labels: string[]; keys: string[]; api: string }>> = {
	users: { labels: ["نام و نام خانوادگی", "موبایل", "نقش", "واحد", "وضعیت"], keys: ["fullName", "mobile", "role", "departmentId", "approvedAt"], api: "users" },
	departments: { labels: ["نام واحد", "کد", "مدیر"], keys: ["name", "code", "managerUserId"], api: "departments" },
	"access-levels": { labels: ["عنوان", "واحد", "مجوزها", "کاربران"], keys: ["name", "departmentId", "permissionsCount", "usersCount"], api: "access-levels" },
	audit: { labels: ["رویداد", "کاربر", "شرح", "زمان"], keys: ["action", "actorName", "description", "createdAt"], api: "audit" },
	modules: { labels: ["ماژول", "نسخه", "وضعیت"], keys: ["name", "version", "isActive"], api: "modules" },
	kpis: { labels: ["شاخص", "کد", "هدف", "واحد"], keys: ["name", "code", "targetValue", "departmentId"], api: "kpis" },
	checkins: { labels: ["دوره", "مقدار واقعی", "وضعیت", "ثبت‌کننده"], keys: ["period", "actualValue", "status", "userId"], api: "checkins" },
	actions: { labels: ["عنوان اقدام", "وضعیت", "اولویت", "مسئول", "موعد"], keys: ["title", "status", "priority", "ownerUserId", "dueAt"], api: "actions" },
	alerts: { labels: ["هشدار", "شدت", "وضعیت", "دوره"], keys: ["title", "severity", "status", "period"], api: "alerts" },
	inbox: { labels: ["عنوان", "نوع", "وضعیت", "زمان"], keys: ["title", "type", "readAt", "createdAt"], api: "inbox" },
	priorities: { labels: ["عنوان", "ترتیب"], keys: ["name", "position"], api: "priorities" },
};

function format(value: unknown) {
	if (value === null || value === undefined || value === "") return "—";
	if (typeof value === "boolean") return value ? "فعال" : "غیرفعال";
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

function PageHeading({ page, action }: { page: RoutePage; action?: React.ReactNode }) {
	return <div className="nk-block-head nk-block-head-sm"><div className="nk-block-between flex-wrap gap-3"><div className="nk-block-head-content"><span className="overline-title">{page.eyebrow}</span><h1 className="nk-block-title page-title">{page.title}</h1><div className="nk-block-des text-soft"><p>{page.description}</p></div></div>{action && <div className="nk-block-head-content">{action}</div>}</div></div>;
}

async function Dashboard() {
	const [summary, kpis, actions] = await Promise.all([serverApi<{ dashboard: RecordValue | null }>("dashboard"), serverApi<{ dashboard: RecordValue | null }>("dashboard/kpis"), serverApi<{ dashboard: RecordValue | null }>("dashboard/actions")]);
	const statItems = [
		["شاخص‌های فعال", kpis.data?.dashboard?.total ?? summary.data?.dashboard?.activeKpis ?? "—", "ni-growth", "primary"],
		["ثبت‌های این دوره", kpis.data?.dashboard?.submitted ?? "—", "ni-check-circle", "success"],
		["هشدارهای باز", actions.data?.dashboard?.openAlerts ?? summary.data?.dashboard?.openAlerts ?? "—", "ni-alert-circle", "warning"],
		["اقدام‌های من", summary.data?.dashboard?.ownedActions ?? "—", "ni-list-round", "info"],
	] as const;
	const failure = summary.error ?? kpis.error ?? actions.error;
	return <div className="nk-block"><div className="row g-gs mb-3">{statItems.map(([label, value, icon, tone]) => <div className="col-sm-6 col-xxl-3" key={label}><div className="card card-bordered sm-shell-card"><div className="card-inner"><div className="flex items-center justify-between"><div><span className="sub-title text-soft">{label}</span><div className="sm-stat-value mt-2">{format(value)}</div></div><span className={`user-avatar ${tone === "warning" ? "bg-warning-dim" : tone === "success" ? "bg-success-dim" : "bg-primary-dim"}`}><em className={`icon ni ${icon}`} /></span></div></div></div></div>)}</div>
		{failure && <div role="alert" className="alert alert-fill alert-warning">{failure}</div>}
		<div className="row g-gs"><div className="col-xxl-8"><div className="card card-bordered"><div className="card-inner"><div className="flex items-center justify-between"><h2 className="title">سلامت شاخص‌ها</h2><Link href="/kpis" className="link-primary">مشاهده شاخص‌ها</Link></div><p className="text-soft mt-3">تکمیل این دوره: {format(kpis.data?.dashboard?.completionLabel)} · نیازمند توجه: {format(kpis.data?.dashboard?.attentionLabel)}</p><div className="sm-trend mt-4" role="img" aria-label="روند دوره‌های گزارش‌شده">{Array.isArray(kpis.data?.dashboard?.bars) && (kpis.data.dashboard.bars as RecordValue[]).map((bar, index) => <span key={index} className={bar.health === "red" ? "is-red" : bar.health === "yellow" ? "is-yellow" : "is-green"} style={{ height: `${format(bar.height)}%` }} />)}</div></div></div></div><div className="col-xxl-4"><div className="card card-bordered h-full"><div className="card-inner"><h2 className="title">اقدام‌های نیازمند پیگیری</h2><p className="text-soft mt-3">اقدام‌های ثبت‌شده برای حساب شما از سرویس دریافت می‌شوند.</p><Link href="/actions" className="btn btn-dim btn-outline-light btn-block mt-3">مشاهده اقدام‌ها</Link></div></div></div></div>
	</div>;
}

async function CollectionTable({ collection, label }: { collection: NonNullable<RoutePage["collection"]>; label?: string }) {
	const definition = columns[collection];
	if (!definition) return <div className="card card-bordered"><div className="card-inner text-soft">این فهرست در API موجود نیست.</div></div>;
	const result = await serverApi<RecordValue[]>(`data/${definition.api}`);
	const rows = Array.isArray(result.data) ? result.data : [];
	return <div className="card card-bordered"><div className="card-inner"><h2 className="title">{label ?? "فهرست"}</h2>{result.error && <p className="alert alert-fill alert-warning mt-3" role="alert">{result.error}</p>}<div className="sm-table-wrap mt-3"><table className="table table-tranx"><thead><tr>{definition.labels.map((item) => <th key={item}>{item}</th>)}{collection === "modules" && <th>عملیات</th>}</tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id ?? index)}>{definition.keys.map((key) => <td key={key}>{collection === "access-levels" && key === "name" ? <Link href={`/admin/access-levels/${row.id}/edit`} className="link-primary">{format(row.name)}</Link> : format(key === "fullName" ? [row.firstName, row.lastName].filter(Boolean).join(" ") : row[key])}</td>)}{collection === "modules" && <td><ModuleToggle slug={String(row.slug)} active={row.isActive === true} /></td>}</tr>)}{rows.length === 0 && <tr><td colSpan={definition.labels.length} className="py-5 text-center text-soft">{result.error ? "برای این حساب داده‌ای در دسترس نیست." : "داده‌ای برای نمایش وجود ندارد."}</td></tr>}</tbody></table></div></div></div>;
}

async function AccessLevelsPanel() {
	return <><div className="flex justify-end mb-3"><Link href="/admin/access-levels/create" className="btn btn-primary">ساخت سطح دسترسی</Link></div><CollectionTable collection="access-levels" label="سطح‌های دسترسی" /></>;
}
async function FormPage({ form, path }: { form?: RoutePage["form"]; path?: string }) {
	const fieldsByForm: Record<string, AuthField[]> = {
		department: [{ name: "name", label: "نام واحد", required: true }, { name: "code", label: "کد واحد", required: true }, { name: "managerUserId", label: "شناسه مدیر", type: "number" }],
		kpi: [{ name: "departmentId", label: "شناسه واحد", type: "number", required: true }, { name: "code", label: "کد شاخص", required: true }, { name: "name", label: "نام شاخص", required: true }, { name: "direction", label: "جهت مطلوب", type: "select", options: ["higher", "lower", "range"], required: true }, { name: "targetValue", label: "مقدار هدف", type: "number", required: true }, { name: "ownerUserId", label: "شناسه مسئول", type: "number" }, { name: "description", label: "شرح شاخص", type: "textarea" }],
		checkin: [{ name: "kpiId", label: "شناسه شاخص", type: "number", required: true }, { name: "period", label: "دوره گزارش (شمسی)", placeholder: "۱۴۰۵-W۱۵", required: true }, { name: "actualValue", label: "مقدار واقعی", type: "number", required: true }, { name: "note", label: "توضیحات", type: "textarea" }, { name: "blockers", label: "موانع", type: "textarea" }],
		action: [{ name: "departmentId", label: "شناسه واحد", type: "number", required: true }, { name: "alertId", label: "شناسه هشدار مرتبط", type: "number" }, { name: "title", label: "عنوان اقدام", required: true }, { name: "description", label: "شرح", type: "textarea" }, { name: "successMetric", label: "معیار موفقیت", required: true }, { name: "ownerUserId", label: "شناسه مسئول", type: "number", required: true }, { name: "priority", label: "اولویت", required: true }, { name: "dueAt", label: "موعد شمسی", placeholder: "۱۴۰۵/۰۷/۳۰", required: true }],
		priority: [{ name: "name", label: "عنوان اولویت", required: true }],
		"settings-general": [{ name: "companyName", label: "نام سازمان", required: true }, { name: "logoPath", label: "مسیر نشان" }],
		sms: [{ name: "apiKey", label: "کلید API", type: "password" }, { name: "sender", label: "شماره فرستنده", required: true }],
		"profile-personal": [{ name: "firstName", label: "نام" }, { name: "lastName", label: "نام خانوادگی" }, { name: "jobTitle", label: "عنوان شغلی" }, { name: "address", label: "نشانی", type: "textarea" }],
		"access-level": [{ name: "name", label: "نام سطح دسترسی", required: true }, { name: "departmentId", label: "شناسه واحد (اختیاری)", type: "number" }, { name: "permissions", label: "مجوزها (با Ctrl انتخاب کنید)", type: "multiselect", options: ["manage-modules", "manage-settings", "manage-users", "manage-roles", "view-audit-log", "manage-departments", "access-all-departments", "alerts.view", "alerts.acknowledge", "alerts.resolve", "actions.view", "actions.manage", "actions.update-own", "kpi.view", "kpi.manage", "kpi.submit"] }],
		"profile-security": [{ name: "current_password", label: "رمز عبور فعلی", type: "password", required: true }, { name: "password", label: "رمز عبور جدید", type: "password", required: true }, { name: "password_confirmation", label: "تکرار رمز عبور جدید", type: "password", required: true }],
		"profile-photo": [{ name: "avatar", label: "انتخاب تصویر (JPG, PNG, WebP؛ ۵۰ تا ۲۰۰ پیکسل؛ حداکثر ۲۰۰ کیلوبایت)", type: "file", required: true }],

	};
	const endpoints: Record<string, { endpoint: string; method: "POST" | "PATCH" }> = {
		department: { endpoint: "/api/departments", method: "POST" },
		kpi: { endpoint: "/api/kpis", method: "POST" },
		checkin: { endpoint: "/api/checkins", method: "POST" },
		action: { endpoint: "/api/actions", method: "POST" },
		priority: { endpoint: "/api/actions/priorities", method: "POST" },
		"settings-general": { endpoint: "/api/settings/branding", method: "PATCH" },
		sms: { endpoint: "/api/sms/settings", method: "PATCH" },
		"profile-personal": { endpoint: "/api/users/me", method: "PATCH" },
		"access-level": { endpoint: path?.match(/\/admin\/access-levels\/(\d+)\/edit$/) ? `/api/authorization/access-levels/${path.match(/\/admin\/access-levels\/(\d+)\/edit$/)?.[1]}` : "/api/authorization/access-levels", method: path?.endsWith("/edit") ? "PATCH" : "POST" },
		"profile-security": { endpoint: "/api/users/me/password", method: "POST" },
		"profile-photo": { endpoint: "/api/users/me/avatar", method: "POST" },

	};
	let fields = fieldsByForm[form ?? ""] ?? [];
	const editMatch = form === "access-level" ? path?.match(/\/admin\/access-levels\/(\d+)\/edit$/) : null;
	if (editMatch) { const result = await serverApi<RecordValue[]>("authorization/access-levels"); const level = result.data?.find((row) => String(row.id) === editMatch[1]); if (level) fields = fields.map((field) => ({ ...field, value: field.name === "name" ? String(level.name ?? "") : field.name === "departmentId" ? String(level.departmentId ?? "") : field.name === "permissions" ? Array.isArray(level.permissions) ? level.permissions.map(String).join(",") : "" : field.value })); }
	const config = form ? endpoints[form] : undefined;
	return <div className="card card-bordered"><div className="card-inner"><h2 className="title">{form ?? "فرم"}</h2>{config ? <><DemoForm fields={fields} submitLabel="ذخیره" endpoint={config.endpoint} method={config.method} />{form === "profile-photo" && <AvatarRemoveButton />}</> : <p className="text-soft mt-3">فرم این عملیات هنوز به مسیر API متصل نشده است.</p>}</div></div>;
}

export async function WorkspacePage({ page, tab }: { page: RoutePage; tab?: string }) {
	let content: React.ReactNode;
	if (page.kind === "dashboard") content = await Dashboard();
	else if (page.kind === "table" && page.collection) content = <CollectionTable collection={page.collection} label={page.title} />;
	else if (page.kind === "form" || page.kind === "profile") content = <FormPage form={page.form} path={page.path} />;
	else if (page.kind === "settings" && page.form === "settings-roles") content = <AccessLevelsPanel />;
	else if (page.kind === "settings") content = <div className="card card-bordered"><div className="card-inner"><h2 className="title">{page.title}</h2><p className="text-soft mt-3">{page.description}</p>{page.form && <FormPage form={page.form} path={page.path} />}{tab && <p className="form-note mt-3">{tab}</p>}</div></div>;
	else content = <CollectionTable collection="checkins" label={page.title} />;
	const createLink = page.collection === "access-levels" ? "/admin/access-levels/create" : undefined;
	return <><PageHeading page={page} action={page.actionLabel && createLink ? <Link href={createLink} className="btn btn-primary">{page.actionLabel}</Link> : undefined} />{content}</>;
}

export function routeForUi(segments: string[] = []) { return getRoutePage(segments); }
