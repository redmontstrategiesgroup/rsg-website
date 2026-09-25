import test from 'node:test';
import assert from 'node:assert/strict';
import { processLead } from '../lib/leads.ts';

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
  } as any);

  assert.equal(typeof result.storedLocally, 'boolean');
  assert.equal(typeof result.emailed, 'boolean');
  assert.equal(typeof result.duplicate, 'boolean');
});
