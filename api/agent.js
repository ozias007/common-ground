// POST /api/agent — streams the agent's research trail as NDJSON, ending with the plan.
import { runAgent, GROUP_TONE } from '../lib/agent.js';

const ID = /^[0-9A-F-]{36}$/i;
const SIX_HOURS = 6 * 60 * 60 * 1000;
const recent = new Map(); // ponytail: per-instance memory, never persisted (Qloo data stays out of storage); KV if cold starts hurt

function validate(body) {
  const person = p => p && typeof p.name === 'string' && p.name.trim() && p.name.length <= 40
    && Array.isArray(p.favourites) && p.favourites.length >= 1 && p.favourites.length <= 8
    && p.favourites.every(f => ID.test(f.id) && typeof f.name === 'string' && typeof f.type === 'string');
  if (!body || !(body.groupType in GROUP_TONE)) return 'Pick who the people are.';
  const people = body.people;
  if (!Array.isArray(people) || people.length < 2 || people.length > 5) return 'Add 2 to 5 people.';
  if (body.groupType === 'couple' && people.length !== 2) return 'A couple is two people.';
  if (!people.every(person)) return 'Each person needs a name and 1 to 8 favourites.';
  if (new Set(people.map(p => p.name.trim().toLowerCase())).size !== people.length) return 'Give everyone a different name.';
  if (body.city && (typeof body.city !== 'string' || body.city.length > 60)) return 'City is too long.';
  if (body.history && (!Array.isArray(body.history) || body.history.length > 5)) return 'Too much history.';
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.writeHead(405).end();
  const problem = validate(req.body);
  if (problem) return res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: problem }));

  res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' });
  const emit = event => res.write(JSON.stringify(event) + '\n');
  const key = JSON.stringify(req.body);
  const hit = recent.get(key);
  if (hit && Date.now() - hit.at < SIX_HOURS) { // same people, same favourites: replay instead of spending free-tier quota
    for (const event of hit.events) { emit(event); await new Promise(r => setTimeout(r, 120)); }
    return res.end();
  }
  const events = [];
  try {
    const plan = await runAgent(req.body, event => { events.push(event); emit(event); });
    events.push({ type: 'plan', plan });
    emit(events.at(-1));
    recent.set(key, { at: Date.now(), events });
    if (recent.size > 50) recent.delete(recent.keys().next().value);
  } catch (err) {
    console.error(err);
    emit({ type: 'error', text: 'The agent hit a problem. Please try again in a minute.' });
  }
  res.end();
}
