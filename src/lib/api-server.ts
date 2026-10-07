import { cookies } from "next/headers";
import { parseApiBody } from "@/lib/api";

export async function serverApi<T>(
  path: string,
): Promise<{ data: T | null; error: string | null }> {
  const cookieHeader = (await cookies())
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
  const base = process.env.NEST_API_URL ?? "http://localhost:4000";
  try {
    const response = await fetch(`${base}/api/${path.replace(/^\/+/, "")}`, {
      headers: {
        cookie: cookieHeader,
        accept: "application/json",
        "accept-language": "fa",
      },
      cache: "no-store",
    });
    const body = await response.json().catch(() => null);
    const parsed = parseApiBody<T>(body);
    if (!response.ok)
      return {
        data: null,
        error:
          parsed.message ?? `درخواست با وضعیت ${response.status} پاسخ داد.`,
      };
    return { data: parsed.payload, error: null };
  } catch {
    return { data: null, error: "ارتباط با سرویس برقرار نشد." };
  }
}
