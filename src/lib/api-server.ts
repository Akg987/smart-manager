import { cookies } from "next/headers";

export async function serverApi<T>(path: string): Promise<{ data: T | null; error: string | null }> {
	const cookieHeader = (await cookies()).getAll().map(({ name, value }) => `${name}=${value}`).join("; ");
	const base = process.env.NEST_API_URL ?? "http://localhost:4000";
	try {
		const response = await fetch(`${base}/api/${path.replace(/^\/+/, "")}`, { headers: { cookie: cookieHeader, accept: "application/json" }, cache: "no-store" });
		const body = await response.json().catch(() => null) as T | { message?: string } | null;
		if (!response.ok) return { data: null, error: (body && typeof body === "object" && "message" in body && typeof body.message === "string") ? body.message : `درخواست با وضعیت ${response.status} پاسخ داد.` };
		return { data: body as T, error: null };
	} catch { return { data: null, error: "ارتباط با سرویس برقرار نشد." }; }
}
