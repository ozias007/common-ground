// POST /api/agent — streams the agent's research trail as NDJSON, ending with the plan.
import { runAgent, GROUP_TONE } from '../lib/agent.js';

const ID = /^[0-9A-F-]{36}$/i;
const SIX_HOURS = 6 * 60 * 60 * 1000;
const recent = new Map(); // ponytail: per-instance memory, never persisted (Qloo data stays out of storage); KV if cold starts hurt

export function validate(body) {
  const person = p => p && typeof p.name === 'string' && p.name.trim() && p.name.length <= 40
    && Array.isArray(p.favourites) && p.favourites.length >= 1 && p.favourites.length <= 8
    && p.favourites.every(f => ID.test(f.id) && typeof f.name === 'string' && typeof f.type === 'string');
  if (!body || !(body.groupType in GROUP_TONE)) return 'Pick who the people are.';
  const people = body.people;
  if (!Array.isArray(people) || people.length < 2 || people.length > 5) return 'Add 2 to 5 people.';
  if (body.groupType === 'couple' && people.length !== 2) return 'A couple is two people.';
  if (body.groupType === 'first_date' && people.length !== 2) return 'A first date is two people.';
  if (!people.every(person)) return 'Each person needs a name and 1 to 8 favourites.';
  if (new Set(people.map(p => p.name.trim().toLowerCase())).size !== people.length) return 'Give everyone a different name.';
  if (body.city && (typeof body.city !== 'string' || body.city.length > 100)) return 'City is too long.';
  const { point } = body;
  const coord = (v, max) => typeof v === 'number' && Math.abs(v) <= max; // numbers only: they go straight into Qloo's POINT()
  if (point !== undefined && !(coord(point?.lat, 90) && coord(point?.lon, 180) && Object.keys(point).length === 2)) return 'That location could not be read.';
  if (body.history && (!Array.isArray(body.history) || body.history.length > 5)) return 'Too much history.';
  return null;
}

// Say what kind of problem it was, without passing on internal details.
export function explain(err) {
  const m = String(err?.message || err);
  if (/busy or out of quota/.test(m)) return "The AI that plans your visit is busy right now. Please try again in a minute.";
  if (/^Qloo/.test(m)) return "Qloo's taste data isn't responding right now. Please try again in a minute.";
  if (/ran out of steps/.test(m)) return "The agent couldn't finish a plan this time. Try again, or add one more favourite each.";
  return 'The agent hit a problem. Please try again in a minute.';
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
    emit({ type: 'error', text: explain(err) });
  }
  res.end();
}
