export type ErrorCode =
  | "unauthenticated" | "insufficient_scope" | "not_found" | "validation_failed"
  | "rate_limited" | "idempotency_required" | "idempotency_mismatch"
  | "conflict" | "unavailable" | "internal";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFound(message = "Not found."): ApiError {
  return new ApiError(404, "not_found", message);
}

export function errorBody(err: ApiError, correlationId: string) {
  return {
    error: {
      code: err.code,
      message: err.message,
      ...(err.details === undefined ? {} : { details: err.details }),
      correlation_id: correlationId,
    },
  };
}

/** Anything that is not already an ApiError becomes an opaque 500. */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  // lib/lifecycle/core.ts requireSupabase() throws this when the platform
  // has no Supabase client configured. Checked by name (not `instanceof`)
  // so this file can stay `@/`-free and test-importable without the
  // alias-resolve hook.
  if (err instanceof Error && err.name === "LifecycleUnavailableError") {
    return new ApiError(503, "unavailable", "The API is temporarily unavailable.");
  }
  return new ApiError(500, "internal", "Something went wrong.");
}
