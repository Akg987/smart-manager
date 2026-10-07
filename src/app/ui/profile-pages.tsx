import Link from "next/link";
import { serverApi } from "@/lib/api-server";
import {
  PersonalForm,
  PhotoForm,
  SecurityForm,
  type ProfileUser,
} from "./profile-client";

type ApiUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  mobile: string;
  role: string;
  nationalCode: string | null;
  birthDate: string | null;
  address: string | null;
  jobTitle: string | null;
  avatarPath: string | null;
  departmentName?: string | null;
};

const sections = [
  {
    id: "personal",
    href: "/profile",
    label: "اطلاعات شخصی",
    icon: "ni-user-alt",
    title: "اطلاعات شخصی",
    lead: "نام، کد ملی، تاریخ تولد و نشانی حساب شما در اسمارت منیجر.",
  },
  {
    id: "photo",
    href: "/profile/photo",
    label: "عکس پروفایل",
    icon: "ni-camera",
    title: "عکس پروفایل",
    lead: "عکس حساب را جدا از اطلاعات شخصی و رمز عبور مدیریت کنید.",
  },
  {
    id: "security",
    href: "/profile/security",
    label: "تنظیمات امنیتی",
    icon: "ni-lock-alt",
    title: "تنظیمات امنیتی",
    lead: "رمز عبور حساب را از اینجا تغییر کنید. نام کاربری ورود تغییر نمی‌کند.",
  },
] as const;

function faDigits(value: string) {
  return value.replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
}

function jalaliBirth(value: string | null) {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const pick = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const year = pick("year");
  const month = pick("month");
  const day = pick("day");
  return year && month && day ? `${year}/${month}/${day}` : "";
}

function present(user: ApiUser): ProfileUser {
  return {
    id: user.id,
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    mobile: faDigits(user.mobile),
    nationalCode: user.nationalCode ?? "",
    birthDate: jalaliBirth(user.birthDate),
    address: user.address ?? "",
    jobTitle: user.jobTitle?.trim() || "تعیین نشده",
    roleLabel: user.role === "admin" ? "مدیر سیستم" : "کاربر",
    departmentLabel: user.departmentName?.trim() || "بدون واحد",
    avatarSrc: user.avatarPath ? `/api/users/${user.id}/avatar` : null,
  };
}

export async function ProfileBoard({
  section,
}: {
  section: "personal" | "photo" | "security";
}) {
  const result = await serverApi<{ user: ApiUser }>("users/me");
  const source = result.data?.user;
  if (!source)
    return (
      <div role="alert" className="alert alert-warning">
        {result.error ?? "پروفایل در دسترس نیست."}
      </div>
    );
  const user = present(source);
  const current = sections.find((item) => item.id === section) ?? sections[0];
  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || "کاربر";
  const initials =
    name
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join("") || "؟";
  const twoFactor = process.env.TWO_FACTOR_ENABLED?.toLowerCase() === "true";
  return (
    <div className="sm-profile">
      <aside className="sm-profile-card">
        <div className="sm-profile-person">
          <div>
            <strong>{name}</strong>
            <small dir="ltr">{user.mobile}</small>
          </div>
          {user.avatarSrc ? (
            <img className="sm-profile-avatar" src={user.avatarSrc} alt="" />
          ) : (
            <span className="sm-profile-avatar">{initials}</span>
          )}
        </div>
        <div className="sm-profile-account">
          <small>حساب سازمانی</small>
          <strong>{user.roleLabel}</strong>
          <span>
            {user.departmentLabel === "بدون واحد"
              ? "بدون واحد تعیین نشده"
              : user.departmentLabel}
          </span>
        </div>
        <nav className="sm-profile-nav" aria-label="بخش‌های پروفایل">
          {sections.map((item) => (
            <Link
              className={item.id === section ? "is-current" : ""}
              href={item.href}
              key={item.id}
            >
              <em className={`icon ni ${item.icon}`} />
              <span>{item.label}</span>
              <em className="icon ni ni-chevron-left" />
            </Link>
          ))}
        </nav>
      </aside>
      <section className="sm-profile-main">
        <h1>{current.title}</h1>
        <p className="sm-profile-lead">{current.lead}</p>
        {section === "personal" && <PersonalForm user={user} />}
        {section === "photo" && <PhotoForm user={user} />}
        {section === "security" && <SecurityForm twoFactor={twoFactor} />}
      </section>
    </div>
  );
}
