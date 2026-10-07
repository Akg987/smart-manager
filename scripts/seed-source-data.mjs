import { config } from "dotenv";
import postgres from "postgres";
import { hash } from "../apps/api/node_modules/bcryptjs/index.js";

config({ path: ".env.local" });
const sql = postgres(process.env.DATABASE_URL, { max: 1 });

await sql`
	insert into modules (slug, name, version, is_active, settings, activated_at, created_at, updated_at)
	values
		('kpi-management', 'مدیریت شاخص‌ها', '1.0.0', true, null, '2026-08-26 21:22:26+00', '2026-08-26 21:22:26+00', '2026-08-26 21:22:26+00'),
		('corrective-actions', 'اقدام اصلاحی', '1.0.0', true, null, '2026-08-26 21:22:29+00', '2026-08-26 21:22:29+00', '2026-08-26 21:22:29+00'),
		('sms-ippanel-hub', 'پیامک IPPanel', '1.0.0', false, null, null, '2026-08-26 21:22:32+00', '2026-08-26 21:22:32+00')
	on conflict (slug) do update set name = excluded.name, is_active = excluded.is_active
`;

await sql`
	insert into action_priorities (name, position, created_at, updated_at)
	values
		('کم', 1, '2026-08-26 21:22:29+00', '2026-08-26 21:22:29+00'),
		('متوسط', 2, '2026-08-26 21:22:29+00', '2026-08-26 21:22:29+00'),
		('زیاد', 3, '2026-08-26 21:22:29+00', '2026-08-26 21:22:29+00'),
		('فوری', 4, '2026-08-26 21:22:29+00', '2026-08-26 21:22:29+00')
	on conflict (name) do update set position = excluded.position
`;

await sql`
	insert into kpi_studio_options ("group", name, slug, position, created_at, updated_at)
	values
		('input_mode', 'مقدار مستقیم', 'direct', 1, now(), now()),
		('input_mode', 'اجرای فرمول', 'formula', 2, now(), now()),
		('input_mode', 'چک‌لیست', 'checklist', 3, now(), now()),
		('direction', 'بیشتر بهتر', 'higher', 1, now(), now()),
		('direction', 'کمتر بهتر', 'lower', 2, now(), now()),
		('direction', 'بازه مطلوب', 'range', 3, now(), now()),
		('frequency', 'هفتگی', 'weekly', 1, now(), now()),
		('frequency', 'روزانه', 'daily', 2, now(), now()),
		('frequency', 'ماهانه', 'monthly', 3, now(), now())
	on conflict ("group", slug) do update set name = excluded.name, position = excluded.position
`;

const settingsCount =
  await sql`select count(*)::int as count from site_settings`;
if (settingsCount[0].count === 0) {
  await sql`insert into site_settings (company_name, logo_path, created_at, updated_at) values ('اسمارت‌ منیجر', null, now(), now())`;
}

const localPassword = await hash("Admin123", 10);
await sql`
	insert into users (first_name, last_name, mobile, password, role, approved_at, created_at, updated_at)
	values ('ادمین', 'سیستم', '09121112233', ${localPassword}, 'admin', now(), now(), now())
	on conflict (mobile) do update set
		password = excluded.password,
		role = 'admin',
		approved_at = now()
`;

await sql`
	insert into users (mobile, password, role, approved_at, created_at, updated_at)
	values ('09137132592', '$2y$12$c./DNqQKHl0t8lDHhAVio.QMPu6PtvmTIs5nUL6qBk5eTtyre1wci', 'admin', '2026-08-26 21:21:59+00', '2026-08-26 21:21:59+00', '2026-08-26 21:21:59+00')
	on conflict (mobile) do nothing
`;

const users = await sql`select id, mobile, role from users order by id`;
console.log(
  JSON.stringify(
    users,
    (_, value) => (typeof value === "bigint" ? value.toString() : value),
    2,
  ),
);
await sql.end();
