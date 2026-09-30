import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';

// Isolate the file store: without this, every `npm test` appended a
// "Test Lead" to the developer's real data/leads.json, which then showed up
// (with a repeated id) in the admin console.
process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'rsg-smoke-'));
delete process.env.SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
const { processLead } = await import('../lib/leads.ts');

test('processLead can handle a minimal lead payload and still return success', async () => {
  const result = await processLead({
    id: 'smoke-test-id',
    name: 'Test Lead',
    company: 'Test Company',
    email: 'lead-smoke@example.com',
    phone: '555-0100',
    website: 'https://example.com',
    problem: 'Need a better lead flow',
    source: 'website_contact_form',
    status: 'new',
    submittedAt: new Date().toISOString(),
  } as Parameters<typeof processLead>[0]);

  assert.equal(typeof result.storedLocally, 'boolean');
  assert.equal(typeof result.emailed, 'boolean');
  assert.equal(typeof result.duplicate, 'boolean');
});
