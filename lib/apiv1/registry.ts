import type { AuthMode, OperationMeta } from "./types.ts";

export type RegisteredOperation = OperationMeta & { method: string; auth: AuthMode; scopes: string[]; idempotent: boolean };

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
