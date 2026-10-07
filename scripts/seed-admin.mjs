import { readFileSync } from "node:fs";
import { config } from "dotenv";
import postgres from "postgres";
import { hash } from "../apps/api/node_modules/bcryptjs/index.js";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is missing.");
}

const sql = postgres(url, { max: 1 });
const [{ exists }] = await sql`
	select exists (
		select 1 from information_schema.tables
		where table_schema = 'public' and table_name = 'users'
	) as exists
`;

if (!exists) {
  const files = [
    "drizzle/0000_youthful_deadpool.sql",
    "drizzle/0001_redundant_nehzno.sql",
    "drizzle/0002_wonderful_master_chief.sql",
  ];
  for (const file of files) {
    const statements = readFileSync(file, "utf8")
      .split("--> statement-breakpoint")
      .map((item) => item.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await sql.unsafe(statement);
    }
    console.log(`applied ${file}`);
  }
}

const password = await hash("Admin123", 10);
const rows = await sql`
	insert into users (first_name, last_name, mobile, password, role, approved_at, created_at, updated_at)
	values ('ادمین', 'سیستم', '09121112233', ${password}, 'admin', now(), now(), now())
	on conflict (mobile) do update set
		password = excluded.password,
		role = 'admin',
		first_name = excluded.first_name,
		last_name = excluded.last_name,
		approved_at = now(),
		updated_at = now()
	returning id, mobile, role, approved_at
`;
console.log(
  JSON.stringify(
    rows,
    (_, value) => (typeof value === "bigint" ? value.toString() : value),
    2,
  ),
);
await sql.end();
