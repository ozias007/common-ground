// Offline unit tests: Qloo and Gemini are faked, so these run without keys or network.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.GEMINI_MODELS = 'model-a,model-b';
const { runAgent, finalise } = await import('../lib/agent.js');

const GOGO = 'E36D3B36-915A-470B-ACC7-82BF4849E93C';
const SIPHO = '4A322BDD-04A3-4369-8234-B38A7FB485D9';
const FILM = '11111111-1111-1111-1111-111111111111';
const SONG = '22222222-2222-2222-2222-222222222222';
const MADE_UP = '99999999-9999-9999-9999-999999999999';

const entity = (id, name, subtype) => ({ entity_id: id, name, type: 'urn:entity', subtype: `urn:entity:${subtype}`, query: { affinity: 0.9 } });
const json = (body, status = 200) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
const call = (name, args) => ({ functionCall: { name, args, id: name } });

let geminiTurns; // per model: list of responses to hand out in order
let geminiCalls;

beforeEach(() => {
  geminiCalls = [];
  globalThis.fetch = async (url, init) => {
    url = String(url);
    if (url.includes('hackathon.api.qloo.com')) {
      const type = new URL(url).searchParams.get('filter.type');
      return json({ results: { entities: type?.endsWith('movie') ? [entity(FILM, 'King Richard', 'movie')] : [entity(SONG, 'Tems', 'artist'), entity(GOGO, 'Jim Reeves', 'artist')] } });
    }
    const model = url.match(/models\/([^:]+):/)[1];
    geminiCalls.push({ model, body: JSON.parse(init.body) });
    const next = geminiTurns[model].shift();
    return typeof next === 'function' ? next() : json({ candidates: [{ content: { role: 'model', parts: next } }] });
  };
});

const input = {
  groupType: 'grandparent',
  people: [
    { name: 'Gogo', favourites: [{ id: GOGO, name: 'Jim Reeves', type: 'artist' }] },
    { name: 'Sipho', favourites: [{ id: SIPHO, name: 'Burna Boy', type: 'artist' }] },
  ],
};

const plan = {
  headline: 'Music and family stories',
  agentNotes: 'I looked at films and music, then balanced the swaps.',
  bridges: [
    { entityId: FILM, why: 'An uplifting family film' },
    { entityId: MADE_UP, why: 'Invented by the model' },
    { entityId: GOGO, why: "Already Gogo's favourite" },
  ],
  swaps: [{ entityId: SONG, from: 'Sipho', why: 'Smooth vocals Gogo will like' }],
  visit: { title: 'Sunday lunch', steps: [{ what: 'Watch King Richard', entityId: FILM }, { what: 'Bake together' }] },
  conversationStarters: [{ question: 'Which song takes you back?' }],
};

test('agent loop: calls Qloo tools, then returns an evidence-checked plan', async () => {
  geminiTurns = {
    'model-a': [
      [call('find_bridges', { category: 'movie', reason: 'Films can bring both generations together.' }), call('find_swaps', { from: 'Sipho', category: 'artist' })],
      [call('submit_plan', plan)],
    ],
  };
  const events = [];
  const result = await runAgent(input, e => events.push(e));

  assert.deepEqual(result.bridges.map(b => b.entity.name), ['King Richard'], 'made-up and already-loved items are dropped');
  assert.equal(result.bridges[0].source, 'qloo');
  assert.equal(result.swaps[0].entity.name, 'Tems');
  assert.deepEqual(result.visit.steps.map(s => s.source), ['qloo', 'agent'], 'steps without Qloo data are labelled as the agent\'s idea');
  assert.ok(events.some(e => e.text === 'Finding films Gogo and Sipho would both enjoy'));
  assert.ok(events.some(e => e.text === "Ranking Sipho's artists by Gogo's taste"));

  // The agent is visible: rounds, its reason for each lookup, and notes with real counts.
  assert.deepEqual(events.filter(e => e.type === 'round').map(e => e.n), [1]);
  assert.equal(events.find(e => e.text.startsWith('Finding films')).reason, 'Films can bring both generations together.');
  assert.deepEqual(result.notes, { text: 'I looked at films and music, then balanced the swaps.', feedback: '', lookups: 2, rounds: 1 });

  // The model only ever sees names it can pick from.
  const tools = geminiCalls[0].body.tools[0].functionDeclarations;
  assert.deepEqual(tools.find(t => t.name === 'find_swaps').parameters.properties.from.enum, ['Gogo', 'Sipho']);
});

test('finalise keeps only items Qloo returned, labelling the rest', () => {
  const evidence = new Map([[FILM, { id: FILM, name: 'King Richard' }]]);
  const out = finalise({
    headline: 'x',
    bridges: [{ entityId: FILM, why: 'a' }, { entityId: MADE_UP, why: 'b' }],
    swaps: [],
    surprises: [{ text: 'A fact with no entity' }],
    visit: { title: 't', steps: [] },
    conversationStarters: [{ question: 'q', entityId: MADE_UP }],
  }, evidence, new Set());
  assert.equal(out.bridges.length, 1);
  assert.equal(out.surprises[0].source, 'agent');
  assert.equal(out.conversationStarters[0].source, 'agent');
  assert.equal(out.conversationStarters[0].entity, undefined);
});

test('falls back to the next model when one is out of daily quota', async () => {
  geminiTurns = {
    'model-a': [() => json('{"error":{"code":429,"message":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}}', 429)],
    'model-b': [[call('submit_plan', plan)]],
  };
  const events = [];
  const result = await runAgent(input, e => events.push(e));
  assert.equal(result.headline, 'Music and family stories');
  assert.deepEqual(geminiCalls.map(c => c.model), ['model-a', 'model-b']);
  assert.ok(events.some(e => e.text === 'Switching to a backup model…'));
});
