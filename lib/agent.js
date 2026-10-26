// The Common Ground agent: Gemini decides which Qloo tools to call, then submits a plan.
// Every plan item must point at an entity a tool actually returned, or it is labelled as the agent's own idea.
import { insights, swaps, nearby, searchEntity } from './qloo.js';

// Free-tier quotas are per model per day, so fall through a list when one runs out.
// Each model has its own free daily quota; lite models last because their plans are plainer.
const MODELS = (process.env.GEMINI_MODELS || 'gemini-3.5-flash,gemini-3-flash-preview,gemini-3.8-flash,gemini-flash-latest,gemini-3.5-flash-lite,gemini-3.1-flash-lite').split(',');
const exhausted = new Map(); // model -> day it ran out
const MAX_TURNS = 8;
const TASTE_CATEGORIES = ['artist', 'movie', 'tv_show', 'book', 'podcast', 'place', 'destination'];
const PLURAL = { artist: 'artists', movie: 'films', tv_show: 'TV shows', book: 'books', podcast: 'podcasts', place: 'places', destination: 'destinations' };

export const GROUP_TONE = {
  grandparent: 'a grandparent and grandchildren. Aim for a warm visit every generation enjoys.',
  couple: 'a couple who have grown distant (not in conflict). Aim for a relaxed date that helps them rediscover each other. Do not give relationship advice or therapy.',
  parent_teen: 'parents and teenagers. Aim for something the teens will not find embarrassing and the parents will not find baffling.',
  carer: 'a carer and the person they care for. Aim for gentle activities and conversation that honour who the person was and is.',
  first_date: 'two people going on a first date. Aim for a relaxed, low-pressure date in a public place and light, fun conversation about tastes they share. Keep questions easy and not too personal. Do not give dating advice.',
  friends: 'people who have drifted apart.',
};

const SYSTEM = `You are Common Ground, an agent that helps people who have drifted apart (2 to 5 of them) find a shared cultural world and plan their next time together.

You have tools backed by Qloo's taste graph. Rules:
- Ground everything in tool results. Only recommend things a tool returned, and reference them by entityId.
- Explore before planning: call find_bridges for at least 3 categories, find_swaps from EVERY person, and find_places if a city is given. Call several tools in one turn when you can.
- If bridges lean towards one person's world, lean harder on swaps to balance it. Nobody in the group should feel left out.
- Look for surprises: a non-obvious link the data shows (e.g. an old country singer whose fans cluster in Lagos). Only claim what the data shows.
- Describe places only with what the tool result says (name, tags, address). Never invent a cuisine, vibe or history for a place.
- Never recommend something that is already one of their favourites as a bridge or swap; the point is discovery.
- Prefer things the pair can actually do together soon: a film to watch, songs to play each other, a place to go.
- The visit is 3 or 4 steps that mix kinds: a song swap (people play each other one artist), a film or show to watch together, and at most one place.
- Conversation starters must grow out of a recommended item, be gentle, and be easy for everyone to answer.
- If past visits are given, build on what worked and avoid what did not.
- Finish by calling submit_plan exactly once. Write in plain, warm English. Use the people's names.`;

const ITEM = (extra = {}) => ({
  type: 'object',
  properties: { entityId: { type: 'string' }, why: { type: 'string', description: 'One sentence, plain words' }, ...extra },
  required: ['entityId', 'why'],
});

// Tool schemas use the people's names, so the model can only pick someone who is really there.
const toolsFor = names => {
  const PERSON = { type: 'string', enum: names };
  return [{
  functionDeclarations: [
    {
      name: 'find_bridges',
      description: "Things the whole group is likely to enjoy, from one blended taste signal of everyone's favourites.",
      parameters: { type: 'object', properties: { category: { type: 'string', enum: TASTE_CATEGORIES } }, required: ['category'] },
    },
    {
      name: 'find_swaps',
      description: "From one person's world, the items everyone ELSE in the group is most likely to enjoy.",
      parameters: { type: 'object', properties: { from: PERSON, category: { type: 'string', enum: ['artist', 'movie', 'tv_show', 'book', 'podcast'] } }, required: ['from', 'category'] },
    },
    {
      name: 'find_places',
      description: 'Real places in the given city that people with this taste go to.',
      parameters: { type: 'object', properties: { who: { type: 'string', enum: [...names, 'everyone'] } }, required: ['who'] },
    },
    {
      name: 'search_entity',
      description: 'Look up an extra thing by name (an artist, film, place...) to get its entityId.',
      parameters: { type: 'object', properties: { query: { type: 'string' }, type: { type: 'string', enum: TASTE_CATEGORIES } }, required: ['query'] },
    },
    {
      name: 'submit_plan',
      description: 'Submit the final plan. Every entityId must come from a tool result.',
      parameters: {
        type: 'object',
        properties: {
          headline: { type: 'string', description: 'One warm sentence naming what this group shares' },
          bridges: { type: 'array', items: ITEM(), description: '3 to 6 things everyone will enjoy' },
          swaps: { type: 'array', items: ITEM({ from: PERSON }), description: 'At least one from each person' },
          surprises: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, entityId: { type: 'string' } }, required: ['text'] } },
          visit: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              steps: { type: 'array', items: { type: 'object', properties: { what: { type: 'string' }, entityId: { type: 'string' }, why: { type: 'string' } }, required: ['what'] } },
            },
            required: ['title', 'steps'],
          },
          conversationStarters: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, entityId: { type: 'string' } }, required: ['question'] } },
        },
        required: ['headline', 'bridges', 'swaps', 'visit', 'conversationStarters'],
      },
    },
  ],
  }];
};

const WAITS = [2000, 6000]; // brief blips retry here; a model that stays busy hands over to the next one

class OutOfQuota extends Error {}
class Busy extends Error {} // model overloaded right now; another model may not be
const today = () => new Date().toISOString().slice(0, 10);

async function gemini(model, body, attempt = 0) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  }).catch(err => ({ status: 'network', err }));
  const text = res.status === 'network' ? '' : await res.text();
  if (res.status === 429 && text.includes('PerDay')) throw new OutOfQuota(model); // waiting won't help until tomorrow
  if (['network', 429, 503].includes(res.status)) {
    if (attempt >= WAITS.length) throw new Busy(`${model} ${res.status}`);
    console.warn(`${model} ${res.status}, retrying in ${WAITS[attempt] / 1000}s`);
    await new Promise(r => setTimeout(r, WAITS[attempt]));
    return gemini(model, body, attempt + 1);
  }
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${text.slice(0, 300)}`);
  const content = JSON.parse(text).candidates?.[0]?.content;
  if (!content) throw new Error(`Gemini returned no content: ${text.slice(0, 300)}`);
  return content;
}

const describe = p => `${p.name}: ${p.favourites.map(f => `${f.name} (${f.type})`).join(', ')}`;

function brief({ groupType, people, city, history }) {
  const lines = [
    `This group is ${GROUP_TONE[groupType] || GROUP_TONE.friends}`,
    ...people.map(describe),
    city ? `They live in or near ${city}.` : 'No city given, so skip find_places.',
  ];
  for (const [i, h] of (history || []).entries()) {
    lines.push(`Past visit ${i + 1}: "${h.title}". Worked: ${h.worked?.join(', ') || 'nothing noted'}. Did not work: ${h.didnt?.join(', ') || 'nothing noted'}.`);
  }
  return lines.join('\n');
}

// Runs the agent. emit(event) is called for every step so the UI can show the research trail.
export async function runAgent(input, emit) {
  for (const model of MODELS) {
    if (exhausted.get(model) === today()) continue;
    try {
      return await runWith(model, input, emit);
    } catch (err) {
      if (err instanceof OutOfQuota) exhausted.set(model, today());
      else if (!(err instanceof Busy)) throw err;
      console.warn(`${model}: ${err instanceof Busy ? 'busy' : 'out of quota for today'}, trying the next model`);
      emit({ type: 'step', text: 'Switching to a backup model…' });
    }
  }
  throw new Error('Every model is busy or out of quota right now');
}

// What the model sees from a tool: enough to choose and describe, nothing it doesn't need (keeps prompts small).
const forModel = list => list.map(({ id, name, type, affinity, tags, description, address }) => ({
  id, name, type, affinity, tags,
  ...(type === 'place' ? { description: description?.slice(0, 160), area: address?.split(',').slice(-3, -1).join(',').trim() } : {}),
}));

async function runWith(model, input, emit) {
  const { people, city } = input;
  const names = people.map(p => p.name);
  const seeds = Object.fromEntries(people.map(p => [p.name, p.favourites.map(f => f.id)]));
  const all = names.flatMap(n => seeds[n]);
  const others = n => names.filter(o => o !== n).flatMap(o => seeds[o]);
  const list = ns => ns.length > 1 ? `${ns.slice(0, -1).join(', ')} and ${ns.at(-1)}` : ns[0];
  const evidence = new Map(); // entityId -> entity, everything Qloo actually returned
  const remember = list => { for (const e of list) evidence.set(e.id, e); return list; };

  const tools = {
    find_bridges: ({ category }) => insights({ seedIds: all, category }).then(remember),
    find_swaps: ({ from, category }) => swaps({ fromSeeds: seeds[from], toSeeds: others(from), category }).then(remember),
    find_places: ({ who }) => nearby({ seeds: seeds[who] || all, location: city }).then(remember),
    search_entity: args => searchEntity(args).then(remember),
  };
  const label = {
    find_bridges: x => `Finding ${PLURAL[x.category] || x.category} ${list(names)} would ${names.length === 2 ? 'both' : 'all'} enjoy`,
    find_swaps: x => `Ranking ${x.from}'s ${PLURAL[x.category] || x.category} by ${list(names.filter(n => n !== x.from))}'s taste`,
    find_places: x => `Looking for places in ${city} for ${seeds[x.who] ? x.who : 'everyone'}`,
    search_entity: x => `Looking up "${x.query}"`,
  };

  const contents = [{ role: 'user', parts: [{ text: brief(input) }] }];
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const last = turn === MAX_TURNS - 1;
    const started = Date.now();
    const content = await gemini(model, {
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents,
      tools: toolsFor(names),
      toolConfig: { functionCallingConfig: last ? { mode: 'ANY', allowedFunctionNames: ['submit_plan'] } : { mode: 'ANY' } },
      generationConfig: { thinkingConfig: { thinkingLevel: 'low' } }, // judges won't wait minutes; tools carry the knowledge
    });
    console.log(`turn ${turn}: ${model} ${Date.now() - started}ms`);
    contents.push(content); // keep thought signatures intact for the next turn

    const calls = content.parts.filter(p => p.functionCall).map(p => p.functionCall);
    const submit = calls.find(c => c.name === 'submit_plan');
    if (submit) return finalise(submit.args, evidence, new Set(all));

    const responses = await Promise.all(calls.map(async call => {
      emit({ type: 'step', text: label[call.name]?.(call.args) || call.name });
      let result;
      try {
        result = await tools[call.name](call.args);
        emit({ type: 'found', text: result.slice(0, 4).map(e => e.name).join(', ') || 'nothing this time' });
      } catch (err) {
        console.warn(`tool ${call.name} failed:`, err.message);
        result = { error: err.message };
      }
      return { functionResponse: { name: call.name, id: call.id, response: { result: Array.isArray(result) ? forModel(result) : result } } };
    }));
    contents.push({ role: 'user', parts: responses });
  }
  throw new Error('Agent ran out of steps without a plan');
}

// Attach the real Qloo entity to every item, and label where each item came from.
export function finalise(plan, evidence, favourites = new Set()) {
  const attach = item => {
    const entity = item.entityId && evidence.get(item.entityId);
    return { ...item, entity: entity || undefined, source: entity ? 'qloo' : 'agent' };
  };
  // Recommendations without Qloo data behind them are dropped, and so are things the people already love.
  const keep = item => evidence.has(item.entityId) && !favourites.has(item.entityId);
  return {
    headline: plan.headline,
    bridges: (plan.bridges || []).filter(keep).map(attach),
    swaps: (plan.swaps || []).filter(keep).map(attach),
    surprises: (plan.surprises || []).map(attach),
    visit: { title: plan.visit?.title, steps: (plan.visit?.steps || []).map(attach) },
    conversationStarters: (plan.conversationStarters || []).map(attach),
  };
}
