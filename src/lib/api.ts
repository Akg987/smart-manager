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
