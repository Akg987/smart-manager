export type ApiEnvelope<T> = {
  success?: boolean;
  statusCode?: number;
  message?: string;
  errors?: Record<string, string[]>;
  data?: T;
};

export function parseApiBody<T>(body: unknown): {
  payload: T;
  message?: string;
  errors?: Record<string, string[]>;
} {
  if (!body || typeof body !== "object") return { payload: body as T };
  const record = body as ApiEnvelope<T> & Record<string, unknown>;
  if ("success" in record && "data" in record) {
    return {
      payload: record.data as T,
      message: record.message,
      errors: record.errors,
    };
  }
  return { payload: body as T, message: record.message, errors: record.errors };
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "same-origin",
      headers: { accept: "application/json", "accept-language": "fa" },
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const request = new Request(input, { ...init, credentials: "same-origin" });
  const first = await fetch(request.clone());
  const path =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.pathname
        : input.url;
  if (
    first.status !== 401 ||
    /\/auth\/(?:login|register|refresh|logout)(?:\?|$)/.test(path)
  )
    return first;
  if (!(await refreshSession())) return first;
  return fetch(request.clone());
}
