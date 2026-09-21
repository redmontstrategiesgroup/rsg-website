import type { ZodType } from "zod";
import type { AuthMode, OperationMeta } from "./types.ts";

export type RegisteredOperation = OperationMeta & {
  method: string;
  auth: AuthMode;
  scopes: string[];
  idempotent: boolean;
  body?: ZodType;
  query?: ZodType;
  rateLimit?: { limit: number; windowMs: number };
};

/** Non-enumerable slot `withApi` stamps on the handler it returns, so `buildOpenApi` can read a route module's exports. */
export const OPERATION_KEY = Symbol.for("rsg.apiv1.operation");

const operations: RegisteredOperation[] = [];

export function registerOperation(op: RegisteredOperation): void {
  const i = operations.findIndex((o) => o.operationId === op.operationId);
  if (i >= 0) operations[i] = op; // hot reload re-registers
  else operations.push(op);
}
export function listOperations(): RegisteredOperation[] {
  return [...operations];
}
export function resetOperations(): void {
  operations.length = 0;
}

export function attachOperation<T extends object>(fn: T, op: RegisteredOperation): T {
  Object.defineProperty(fn, OPERATION_KEY, { value: op, enumerable: false });
  return fn;
}

export function operationOf(fn: unknown): RegisteredOperation | null {
  if (typeof fn !== "function") return null;
  const op = (fn as unknown as Record<symbol, unknown>)[OPERATION_KEY];
  return op && typeof op === "object" ? (op as RegisteredOperation) : null;
}
