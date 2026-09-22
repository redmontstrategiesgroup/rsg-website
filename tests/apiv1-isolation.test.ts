/**
 * Hermetic cross-tenant isolation test for the API-platform v1 resource
 * handlers: a principal from one client must never see a row that belongs
 * to another client, even when it asks for it by id directly (GET .../:id).
 *
 * This drives the REAL handler functions (getTicketHandler, getFileHandler,
 * getInvoiceHandler, getProject) from lib/apiv1/resources/*.ts — not a
 * reimplementation of the ownership check — by mocking only the lifecycle
 * data-access functions each handler calls (node:test's mock.module(), which
 * needs --experimental-test-module-mocks; see package.json's "test" script)
 * to return a row whose client_id belongs to a different client. Everything
 * downstream of that call (requireUuid, ownership check, ApiError mapping)
 * is exercised for real.
 */
import "./_alias-hook.ts";
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import type { ClientPrincipal } from "../lib/apiv1/principal.ts";
import type { ApiError } from "../lib/apiv1/errors.ts";

const OWNER_CLIENT_ID = "test-client";
const OTHER_CLIENT_ID = "other-client";
const SOME_UUID = "11111111-1111-1111-1111-111111111111";

function principalFor(clientId: string): ClientPrincipal {
  return {
    type: "client",
    keyId: "key-1",
    keyName: "test key",
    scopes: ["projects:read", "tickets:read", "files:read", "billing:read"],
    portal: {
      client: { id: clientId, name: "Test Co", company: "Test Co", email: "t@example.com", status: "active" },
      user: { id: "key-1", name: "test key", email: "t@example.com", role: "owner", isLegacyOwner: false },
    },
  };
}

const notImplemented = (name: string) => async () => {
  throw new Error(`${name} should not be called by this test's code path`);
};

// lib/lifecycle/core.requireSupabase() is imported (but never invoked, given
// the throw-before-Supabase-call paths exercised here) by every resource
// file below; stub it so the whole tree stays hermetic even if that
// assumption ever slips.
mock.module("@/lib/lifecycle/core", {
  namedExports: {
    requireSupabase: () => {
      throw new Error("requireSupabase should not be called by this test's code path");
    },
    // Transitively imported (but not invoked on the throw-before-Supabase
    // paths this test exercises) by lib/lifecycle/workspace.ts and others
    // pulled in alongside the mocked resource modules below.
    nowIso: () => new Date().toISOString(),
  },
});

mock.module("@/lib/lifecycle/support", {
  namedExports: {
    getTicket: async (id: string) => ({ id, client_id: OTHER_CLIENT_ID }),
    createTicket: notImplemented("createTicket"),
    confirmTicketClosure: notImplemented("confirmTicketClosure"),
    reopenTicket: notImplemented("reopenTicket"),
  },
});

mock.module("@/lib/lifecycle/files", {
  namedExports: {
    getFile: async (id: string) => ({ id, client_id: OTHER_CLIENT_ID, scan_status: "clean" }),
    getDownloadUrl: notImplemented("getDownloadUrl"),
  },
});

mock.module("@/lib/lifecycle/billing", {
  namedExports: {
    getInvoice: async (id: string) => ({ id, client_id: OTHER_CLIENT_ID }),
  },
});

// tickets.ts imports getProject from here too, so every export it or
// projects.ts pulls from this module must be present.
mock.module("@/lib/lifecycle/projects", {
  namedExports: {
    getProject: notImplemented("getProject"),
    getProjectWithDetail: async (id: string) => ({
      project: { id, client_id: OTHER_CLIENT_ID },
      milestones: [],
      tasks: [],
      members: [],
    }),
    approveMilestone: notImplemented("approveMilestone"),
    requestMilestoneChanges: notImplemented("requestMilestoneChanges"),
    updateTask: notImplemented("updateTask"),
    computeHealth: notImplemented("computeHealth"),
    computeProgress: notImplemented("computeProgress"),
  },
});

const { getTicketHandler } = await import("../lib/apiv1/resources/tickets.ts");
const { getFileHandler } = await import("../lib/apiv1/resources/files.ts");
const { getInvoiceHandler } = await import("../lib/apiv1/resources/billing.ts");
const { getProject } = await import("../lib/apiv1/resources/projects.ts");

function args(principal: ClientPrincipal, id: string) {
  return {
    principal,
    body: undefined,
    query: undefined,
    params: { id },
    request: new Request("http://x/"),
    correlationId: "c-test",
  };
}

async function assertNotFound(promise: Promise<unknown>) {
  await assert.rejects(promise, (err: unknown) => {
    assert.equal((err as ApiError).code, "not_found");
    assert.equal((err as ApiError).status, 404);
    return true;
  });
}

describe("apiv1 cross-tenant isolation (real handlers, mocked lifecycle data access)", () => {
  it("getTicketHandler: a ticket owned by another client 404s, never leaks", async () => {
    await assertNotFound(getTicketHandler(args(principalFor(OWNER_CLIENT_ID), SOME_UUID)));
  });

  it("getFileHandler: a file owned by another client 404s, never leaks", async () => {
    await assertNotFound(getFileHandler(args(principalFor(OWNER_CLIENT_ID), SOME_UUID)));
  });

  it("getInvoiceHandler: an invoice owned by another client 404s, never leaks", async () => {
    await assertNotFound(getInvoiceHandler(args(principalFor(OWNER_CLIENT_ID), SOME_UUID)));
  });

  it("getProject: a project owned by another client 404s, never leaks", async () => {
    await assertNotFound(getProject(args(principalFor(OWNER_CLIENT_ID), SOME_UUID)));
  });
});
