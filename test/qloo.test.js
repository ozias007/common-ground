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

test('only places you could spend an afternoon at are kept', async () => {
  const { visitable } = await import('../lib/qloo.js');
  const place = (name, ...categories) => visitable({ name, categories });
  for (const ok of [place('Goldbar', 'Bar'), place('Robben Island Museum', 'History museum'), place('Neighbourgoods', 'Farmers market'), place('Zoo Lake', 'Park')]) assert.equal(ok, true);
  for (const no of [
    place('Glenwood High School', 'Boys high school'),
    place('University of KwaZulu-Natal'), // no categories at all
    place('Olive Convention Centre', 'Catering food and drink supplier'),
    place('Roots Butchery', 'Supermarket'),
    place('Sharp Cuts', 'Barbershop'), // "bar" must be a whole word
    place('Car Park', 'Parking lot'),
    place('Vuse', 'Vaporizer store'),
  ]) assert.equal(no, false);
});
