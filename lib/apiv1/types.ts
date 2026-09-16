import type { ZodType } from "zod";
import type { Principal } from "./principal.ts";

export type AuthMode = "client" | "admin" | "none";

export type OperationMeta = {
  operationId: string;
  summary: string;
  tag: string;
  response: ZodType;
};

export type ApiConfig<B = unknown, Q = unknown> = {
  auth: AuthMode;
  scopes?: string[];
  idempotent?: boolean;
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

export type HandlerResult = { data: unknown; meta?: Record<string, unknown>; status?: number; headers?: Record<string, string> };

export type ApiHandler<B, Q> = (args: HandlerArgs<B, Q>) => Promise<HandlerResult>;

export type RouteContext = { params: Promise<Record<string, string>> };
export type RouteHandler = (request: Request, ctx: RouteContext) => Promise<Response>;
