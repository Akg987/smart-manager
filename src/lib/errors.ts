export class AppError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorMessage(error: unknown, fallback = "درخواست انجام نشد.") {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
