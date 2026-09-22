import type { ZodType } from "zod";
import type { Principal } from "./principal.ts";

/** `any` = a key is required (401 without one) but either principal type passes; scopes still apply. */
export type AuthMode = "client" | "admin" | "any" | "none";

export type OperationMeta = {
  operationId: string;
  summary: string;
  tag: string;
  response: ZodType;
  /** Response media type when the handler returns a raw non-JSON body (e.g. `text/csv`). Defaults to `application/json`. */
  contentType?: string;
  /** HTTP status of the documented success response. Defaults to 200. Must match what the handler actually returns. */
  status?: number;
  /** Other statuses the handler returns with the SAME `response` body, keyed by status with a short reason. */
  extraResponses?: Record<string, string>;
};

export type ApiConfig<B = unknown, Q = unknown> = {
  auth: AuthMode;
  scopes?: string[];
  idempotent?: boolean;
  /**
   * The success body carries a secret (e.g. a `whsec_` value shown once). With this set the
   * idempotency row records only the status, so a replay answers 409 `conflict` instead of
   * serving the secret again from `api_idempotency.response_body`.
   */
  sensitiveResponse?: boolean;
  rateLimit?: { limit: number; windowMs: number };
  body?: ZodType<B>;
  query?: ZodType<Q>;
  meta: OperationMeta;
};

export type HandlerArgs<B, Q> = {
  principal: Principal | null;
  body: B;
  query: Q;
  params: Record<string, string>;
  request: Request;
  correlationId: string;
};

export type HandlerResult = { data: unknown; meta?: Record<string, unknown>; status?: number; headers?: Record<string, string>; raw?: Response };

export type ApiHandler<B, Q> = (args: HandlerArgs<B, Q>) => Promise<HandlerResult>;

export type RouteContext = { params: Promise<Record<string, string>> };
export type RouteHandler = (request: Request, ctx: RouteContext) => Promise<Response>;
