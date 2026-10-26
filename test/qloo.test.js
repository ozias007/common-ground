// Offline: Qloo is faked to check the request queue and rate-limit retry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insights } from '../lib/qloo.js';

test('never more than 4 Qloo requests at once, and 429s are retried', async () => {
  let open = 0, peak = 0, calls = 0;
  globalThis.fetch = async () => {
    const first = ++calls === 1; // decide before awaiting: other calls bump the counter meanwhile
    open++; peak = Math.max(peak, open);
    await new Promise(r => setTimeout(r, 20));
    open--;
    if (first) return new Response('{"error_msg":"Rate limit exceeded"}', { status: 429 });
    return new Response(JSON.stringify({ results: { entities: [{ entity_id: 'x', name: 'Tems', subtype: 'urn:entity:artist' }] } }));
  };
  // Ten different lookups fired together, like one agent turn.
  const results = await Promise.all(Array.from({ length: 10 }, (_, i) => insights({ seedIds: [`seed-${i}`], category: 'artist' })));
  assert.ok(peak <= 4, `peak concurrency was ${peak}`);
  assert.equal(calls, 11, 'the rate-limited call was retried once');
  assert.ok(results.every(r => r[0].name === 'Tems'));
});
