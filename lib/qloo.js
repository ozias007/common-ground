// Qloo tools the agent can call. Hackathon keys only work against this host.
const BASE = 'https://hackathon.api.qloo.com';
const cache = new Map(); // ponytail: per-instance memory cache; move to KV if cold starts hurt

// The hackathon key rate-limits bursts, and the agent asks for ~10 lookups at once, so queue them.
const MAX_IN_FLIGHT = 4;
let inFlight = 0;
const waiting = [];
async function slot() {
  if (inFlight >= MAX_IN_FLIGHT) await new Promise(resolve => waiting.push(resolve));
  inFlight++;
}
function release() {
  inFlight--;
  waiting.shift()?.();
}

async function get(path, params, retry = 2) {
  const url = `${BASE}${path}?${new URLSearchParams(params)}`;
  if (cache.has(url)) return cache.get(url);
  let res;
  await slot();
  try {
    res = await fetch(url, { headers: { 'X-Api-Key': process.env.QLOO_API_KEY }, signal: AbortSignal.timeout(15000) });
  } catch (err) { // Qloo's hackathon host drops connections now and then
    if (retry) return get(path, params, retry - 1);
    throw new Error(`Qloo unreachable on ${path}: ${err.cause?.code || err.name}`);
  } finally {
    release();
  }
  if (res.status === 429 && retry) { // rate limited: back off briefly and try again
    await new Promise(resolve => setTimeout(resolve, 1500));
    return get(path, params, retry - 1);
  }
  if (!res.ok) throw new Error(`Qloo ${res.status} on ${path}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  cache.set(url, json);
  return json;
}

const slim = e => ({
  id: e.entity_id,
  name: e.name,
  type: (e.subtype || e.types?.[0] || e.type)?.replace('urn:entity:', ''), // insights put the real type in subtype
  description: e.properties?.short_description || e.properties?.description || e.disambiguation || '',
  image: e.properties?.image?.url,
  address: e.properties?.address,
  tags: [...new Set((e.tags || []).map(t => t.name))].slice(0, 10),
  affinity: e.query?.affinity && +e.query.affinity.toFixed(3),
});

export const CATEGORIES = ['artist', 'movie', 'tv_show', 'book', 'podcast', 'place', 'brand', 'destination', 'video_game', 'person'];

// Resolve a name ("Jim Reeves", "pap and wors") to Qloo entities.
export async function searchEntity({ query, type, types = type && [type], take = 5 }) {
  const params = { query, take };
  if (types?.length) params.types = types.map(t => `urn:entity:${t}`).join(',');
  const { results = [] } = await get('/search', params);
  return results.map(slim);
}

// Core insight call. seedIds = whose taste; scoreIds = only rank these; location = only results near here,
// either a place name or exact { lat, lon } (names are matched loosely: "Durban" can find Durbanville).
export async function insights({ seedIds, category, location, scoreIds, take = 10 }) {
  const params = { 'filter.type': `urn:entity:${category}`, 'signal.interests.entities': seedIds.join(','), take };
  if (scoreIds?.length) params['filter.results.entities'] = scoreIds.join(',');
  if (location?.lat !== undefined) Object.assign(params, { 'filter.location': `POINT(${location.lon} ${location.lat})`, 'filter.location.radius': 15000 });
  else if (location) params['filter.location.query'] = location;
  const { results } = await get('/v2/insights', params);
  return (results?.entities || []).map(slim);
}

// From A's world, what is B most likely to enjoy? Take A's world, rank it by B's taste.
export async function swaps({ fromSeeds, toSeeds, category }) {
  const world = await insights({ seedIds: fromSeeds, category, take: 30 });
  const known = new Set(fromSeeds);
  const candidates = world.filter(e => !known.has(e.id));
  if (!candidates.length) return [];
  return insights({ seedIds: toSeeds, category, scoreIds: candidates.map(e => e.id), take: 5 });
}

// Places near a city where people with this taste go.
export const nearby = ({ seeds, location }) => insights({ seedIds: seeds, category: 'place', location, take: 8 });
