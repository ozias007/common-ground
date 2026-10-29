// Common Ground front end: plain JS, one state object, screens re-rendered from it.
import { encodeInvite, decodeInvite } from './invite.js';
const KEY = 'commonground.v1';
const SAVED_KEY = 'commonground.connections'; // every connection with a plan, newest first
const MAX_SAVED = 12;
const MAX_PEOPLE = 5;
const MAX_FAVS = 8;

const GROUPS = {
  grandparent: { title: 'Grandparent & grandchild', line: 'Find something to share on Sunday.', names: ['Gogo', 'Grandchild'], tint: 's1', icon: 'people' },
  couple: { title: 'Couple', line: 'Rediscover what brought you together.', names: ['', ''], tint: 's2', icon: 'heart' },
  parent_teen: { title: 'Parent & teen', line: "Get into each other's world.", names: ['Mum', 'Teen'], tint: 's3', icon: 'people' },
  carer: { title: 'Carer & resident', line: 'Know who they were before they came here.', names: ['Carer', 'Resident'], tint: 's4', icon: 'user' },
  first_date: { title: 'First date', line: 'Know what to talk about before you say hello.', names: ['You', 'Your date'], tint: 's5', icon: 'spark' },
  friends: { title: 'Old friends', line: 'Pick up where you left off.', names: ['', ''], tint: 's5', icon: 'people', hidden: true },
};

const TYPE_LABEL = { artist: 'Music', movie: 'Film', tv_show: 'TV show', book: 'Book', podcast: 'Podcast', place: 'Place', destination: 'Destination', brand: 'Brand', person: 'Public figure', video_game: 'Game' };
const TINTS = ['s1', 's2', 's3', 's4', 's5'];
// Category buttons above each interest box; keys match CATEGORIES in api/search.js.
const CATS = [
  ['', 'All', 'e.g. Brenda Fassie, Black Panther, Kaizer Chiefs'],
  ['music', 'Music', 'e.g. Brenda Fassie, Burna Boy'],
  ['films', 'Films', 'e.g. Sarafina!, Black Panther'],
  ['tv', 'TV shows', 'e.g. Skeem Saam, Generations'],
  ['books', 'Books', 'e.g. Long Walk to Freedom'],
  ['podcasts', 'Podcasts', 'e.g. a podcast they never miss'],
  ['places', 'Food & places', "e.g. Nando's, a favourite restaurant"],
  ['travel', 'Travel', 'e.g. Zanzibar, Cape Town, Paris'],
  ['sport', 'Sport & brands', 'e.g. Kaizer Chiefs, Springboks, Nike'],
  ['people', 'Famous people', 'e.g. Trevor Noah, Siya Kolisi'],
];
const cats = {}; // person index -> chosen category key
const PAIRS = ['couple', 'first_date']; // always exactly two people
const TYPE_ICON = { artist: 'music', movie: 'film', tv_show: 'film', book: 'book', podcast: 'music', place: 'pin', destination: 'pin', brand: 'spark' };

// One-click demo: Sunday lunch at Gogo's with three grandkids who all like different things.
const EXAMPLE = {
  groupType: 'grandparent',
  city: 'Johannesburg, Gauteng, South Africa',
  point: { lat: -26.2041, lon: 28.0473 },
  people: [
    { name: 'Gogo Thandi', favourites: [{ id: 'E36D3B36-915A-470B-ACC7-82BF4849E93C', name: 'Jim Reeves', type: 'artist' }, { id: 'AFC7571E-5679-4362-8643-697BA0F60D0B', name: 'Miriam Makeba', type: 'artist' }] },
    { name: 'Sipho', favourites: [{ id: '4A322BDD-04A3-4369-8234-B38A7FB485D9', name: 'Burna Boy', type: 'artist' }] },
    { name: 'Lerato', favourites: [{ id: '2AB15936-73EA-43B8-8A00-26BAA2EF4314', name: 'Lucky Dube', type: 'artist' }] },
    { name: 'Ayanda', favourites: [{ id: '4DD7CAFC-DDA3-4434-B7AC-43346E4DA168', name: 'Ladysmith Black Mambazo', type: 'artist' }] },
  ],
};

const ICON = {
  user: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3 6"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
  spark: '<path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7Z"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  play: '<path d="M7 5v14l11-7L7 5Z"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  pin: '<path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11Z"/><circle cx="12" cy="10" r="2.2"/>',
  music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9.5h4M17 9.5h4M3 14.5h4M17 14.5h4"/>',
  food: '<path d="M4 4v6a3 3 0 0 0 6 0V4M7 4v16M16 4c-2 2-2 6 0 8v8"/>',
  book: '<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z"/><path d="M5 17a3 3 0 0 1 3-3h10"/>',
  swap: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
  home: '<path d="M4 11 12 4l8 7v9H4v-9Z"/><path d="M10 20v-5h4v5"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  check: '<path d="m5 12 4 4 10-10"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  chat: '<path d="M4 5h16v11H8l-4 4V5Z"/>',
};
const svg = name => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fresh = () => ({ id: newId(), screen: 'home', groupType: null, people: [], city: '', point: null, history: [], plan: null, trail: [] });
let state = load();
let trail = [];
let error = '';
let feedback = {}; // entity id -> 'yes' | 'no'
let expanded = {}; // dashboard column -> show all

function load() {
  try { return { ...fresh(), ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return fresh(); }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ ...state, screen: state.screen === 'exploring' ? 'people' : state.screen })); } catch { /* private mode: app still works */ }
}

// ---------- my connections (kept on this device only, no account needed) ----------
function savedConnections() {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY)) || []; } catch { return []; }
}
function writeSaved(list) {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(list.slice(0, MAX_SAVED))); } catch { /* storage full or blocked: the current plan still works */ }
}
// Called whenever a plan arrives, so every visit and what the agent learned is kept.
function rememberConnection() {
  if (!state.plan) return;
  const { screen, invitedBy, ...keep } = state;
  writeSaved([{ ...keep, savedAt: Date.now() }, ...savedConnections().filter(c => c.id !== state.id)]);
}
const ago = t => {
  const days = Math.floor((Date.now() - t) / 864e5);
  return days < 1 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
};

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = document.getElementById('app');
const names = () => state.people.map(p => p.name.trim()).filter(Boolean);
const enjoys = name => !name.trim() ? 'What they enjoy' : name.trim().toLowerCase() === 'you' ? 'What you enjoy' : `What ${esc(name.trim())} enjoys`;
const listOf = ns => ns.length > 1 ? `${ns.slice(0, -1).join(', ')} and ${ns.at(-1)}` : ns[0] || '';

function go(screen) {
  state.screen = screen;
  save();
  render();
  window.scrollTo(0, 0);
  app.focus({ preventScroll: true });
}

function toast(text) {
  const el = Object.assign(document.createElement('div'), { className: 'toast', textContent: text });
  el.setAttribute('role', 'status');
  document.body.append(el);
  setTimeout(() => el.remove(), 2600);
}

// ---------- landing ----------

const HOW = [
  ['people', 's1', '1. Share', 'Tell us about the people. Add a few favourites each: music, films, food, places, books and more.'],
  ['search', 's2', '2. Explore', "Our agent uses Qloo's taste graph to find connections, new possibilities and surprising facts."],
  ['spark', 's3', '3. Discover', 'See your shared interests, swaps between your worlds and cultural surprises, all backed by real Qloo data.'],
  ['calendar', 's4', '4. Plan', 'Get a plan for your next time together: a film, a song swap, a place or meal, plus conversation starters.'],
  ['heart', 's5', '5. Learn', 'Tell us what worked. The agent adapts and plans your next visit, getting to know you better over time.'],
];

// The agent's view of Qloo: one taste graph linking every category.
function hub() {
  const nodes = [
    ['music', 'Music', 150, 62, '#e58fc4'],
    ['film', 'Film & TV', 360, 52, '#4ea3f0'],
    ['food', 'Food & Drink', 400, 172, '#f5a142'],
    ['book', 'Books', 290, 286, '#b98be6'],
    ['pin', 'Places', 104, 212, '#46b07a'],
  ];
  return `
  <svg class="hub" viewBox="0 0 540 330" role="img" aria-label="Qloo's taste graph connects music, film and TV, food and drink, books and places">
    ${nodes.map(([, , x, y]) => `<line x1="270" y1="168" x2="${x}" y2="${y}" stroke="#3a4588" stroke-width="1.5"/>`).join('')}
    <circle cx="270" cy="168" r="70" fill="none" stroke="#3a3f8f" stroke-width="1" opacity=".6"/>
    <circle cx="270" cy="168" r="50" fill="#141c4a" stroke="#8f7cf0" stroke-width="2.5"/>
    <text x="270" y="165" text-anchor="middle" fill="#fff" font-size="22" font-weight="800">Qloo</text>
    <text x="270" y="184" text-anchor="middle" fill="#aeb4d0" font-size="10">taste graph</text>
    ${nodes.map(([icon, label, x, y, color]) => `
      <g>
        <rect x="${x + 4}" y="${y - 15}" width="${label.length * 7.4 + 44}" height="30" rx="15" fill="#18214d" stroke="#2c3770"/>
        <circle cx="${x}" cy="${y}" r="22" fill="${color}"/>
        <g transform="translate(${x - 11} ${y - 11}) scale(.92)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[icon]}</g>
        <text x="${x + 32}" y="${y + 4.5}" fill="#e6e8f6" font-size="13" font-weight="600">${label}</text>
      </g>`).join('')}
  </svg>`;
}

function home() {
  return `
  <section class="hero dark">
    <div class="hero-photo"><img src="img/hero.jpg" alt="A grandfather and his teenage grandson walking through a street market, sharing earphones and laughing" width="1264" height="848"></div>
    <div class="wrap">
      <div class="hero-text">
        <p class="eyebrow">Common Ground</p>
        <h1>Different worlds.<br><span class="grad">Shared moments.</span></h1>
        <p class="lead">An AI companion that finds the shared world between people, using their unique tastes, interests and experiences.</p>
        <p>Whether it's a grandparent and grandchild, a couple, a parent and teen, a carer and resident, or two people on a first date, Common Ground helps you discover what you can enjoy together.</p>
        <div class="hero-actions">
          <button class="btn" data-action="scroll" data-to="who">Get started ${svg('arrow')}</button>
          <button class="btn ghost" data-action="example">Watch a live example</button>
        </div>
        <p class="why">${svg('people')}<span><b>Because connection matters.</b><br>1 in 6 people worldwide experience loneliness (WHO, 2025).</span></p>
      </div>
    </div>
  </section>
  ${myConnections()}
  <section class="how" id="how">
    <div class="wrap">
      <h2>How it works</h2>
      <p class="sub">From different tastes to real-life plans, in 5 simple steps.</p>
      <div class="steps5">
        ${HOW.map(([icon, tint, title, text]) => `
        <div class="step">
          <div class="icon" style="background:var(--${tint})">${svg(icon)}</div>
          <h3>${title}</h3>
          <p>${text}</p>
        </div>`).join('')}
      </div>
    </div>
  </section>

  <section class="who wrap" id="who">
    <h2>Who is it for?</h2>
    <p class="sub">Different relationships. The same goal: connection.</p>
    <div class="cards4">
      ${Object.entries(GROUPS).filter(([, g]) => !g.hidden).map(([key, g]) => `
      <button class="who-card" data-action="group" data-group="${key}">
        <img src="img/${key}.jpg" alt="" width="800" height="447">
        <span class="body">
          <span class="icon" style="background:var(--${g.tint})">${svg(g.icon)}</span>
          <strong>${g.title}</strong>
          <em>"${g.line}"</em>
          <span class="arrow">${svg('arrow')}</span>
        </span>
      </button>`).join('')}
    </div>
  </section>

  <section class="agent-band dark" id="agent">
    <div class="wrap">
      <div class="inner">
        <div>
          <p class="eyebrow">Meet the agent</p>
          <h2>Powered by Qloo.<br>Built for real life.</h2>
          <p>Our agent uses Qloo's cultural intelligence to bring different worlds together, across music, film, food, places, books and more. It decides what to look up, compares what it finds, and shows you which suggestions came straight from Qloo's data.</p>
        </div>
        ${hub()}
      </div>
      <div class="demo-card">
        <div>
          <p class="eyebrow">Live example</p>
          <h3>Sunday lunch at Gogo's</h3>
          <p>Gogo Thandi and her three grandkids love each other, but not the same music. See what the agent finds for them in Johannesburg.</p>
        </div>
        <ul class="demo-people">
          ${examplePeople()}
        </ul>
        <button class="btn" data-action="example">Run the live example ${svg('arrow')}</button>
      </div>

      <div class="trust">
        <span>${svg('check')} Real taste data</span>
        <span>${svg('link')} Cross-category insights</span>
        <span>${svg('heart')} Meaningful connections</span>
      </div>
    </div>
  </section>`;
}

function myConnections() {
  const list = savedConnections();
  if (!list.length) return '';
  return `
  <section class="mine wrap" id="mine" aria-labelledby="mine-title">
    <h2 id="mine-title">Your connections</h2>
    <p class="sub">Saved on this device. Open one to see your plan and carry on where you left off.</p>
    <ul class="mine-list">
      ${list.map(c => `
      <li class="card">
        <span class="icon" style="background:var(--${GROUPS[c.groupType]?.tint || 's3'})">${svg(GROUPS[c.groupType]?.icon || 'people')}</span>
        <div class="mine-text">
          <strong>${esc(listOf(c.people.map(p => p.name.trim()).filter(Boolean)))}</strong>
          <span class="meta">${esc(c.demo ? 'Live example' : GROUPS[c.groupType]?.title || '')} · Visit ${Math.min(c.history.length + 1, 5)} · planned ${ago(c.savedAt)}</span>
          <span class="meta">${esc(c.plan.visit.title)}</span>
        </div>
        <div class="mine-actions">
          <button class="btn small" data-action="open-saved" data-id="${esc(c.id)}">Open</button>
          <button class="link" data-action="delete-saved" data-id="${esc(c.id)}" aria-label="Delete the connection with ${esc(listOf(c.people.map(p => p.name)))}">Delete</button>
        </div>
      </li>`).join('')}
    </ul>
  </section>`;
}

// ---------- create a connection ----------

const STEPS = ['People', 'Explore', 'Plan', 'Review'];
const stepper = now => `<ol class="stepper" aria-label="Progress">${STEPS.map((s, i) => `<li class="${i < now ? 'done' : i === now ? 'now' : ''}"${i === now ? ' aria-current="step"' : ''}>${s}</li>`).join('')}</ol>`;
const venn = '<svg class="venn" viewBox="0 0 150 100" aria-hidden="true"><circle cx="55" cy="50" r="45" fill="#d9c9fb" opacity=".7"/><circle cx="95" cy="50" r="45" fill="#b8e6e3" opacity=".7"/></svg>';

function people() {
  const g = GROUPS[state.groupType];
  const max = PAIRS.includes(state.groupType) ? 2 : MAX_PEOPLE;
  return `
  ${venn}
  ${state.plan ? `<button class="link back" data-action="plan">${svg('back')} Back to your plan</button>` : `<button class="link back" data-action="home">${svg('back')} Back</button>`}
  ${stepper(0)}
  <h1>${state.plan ? 'Edit your people' : 'Create a connection'}</h1>
  ${state.plan ? `<p class="invite-note">${svg('spark')} <span>Changed your mind about something, or learned something new? Edit the favourites below, then tap <b>Update our plan</b>. The agent keeps everything it learned from your past visits.</span></p>` : ''}
  ${state.plan ? '' : `<p class="lead">${esc(g.title)}. Tell us about the people. Add a few favourites each, about 3 works best: anything from music and films to food, places and books. You can fill in for someone else.</p>`}
  ${state.invitedBy ? `<p class="invite-note">${svg('people')} <span><b>${esc(state.invitedBy)}</b> already added their favourites. Add yours below, then tap <b>Next</b>.</span></p>` : ''}
  ${state.groupType === 'first_date' ? `<p class="safety">${state.invitedBy ? '' : 'Add what you know about your date (or ask them for a few favourites). '}Stay safe: meet somewhere public, tell a friend where you're going, and plan your own way home.</p>` : ''}
  ${state.groupType === 'couple' ? `<p class="safety">Common Ground helps couples who've grown distant find things to enjoy together. It isn't counselling. If you feel unsafe at home, please reach out: in South Africa call the GBV Command Centre on <a href="tel:0800428428">0800 428 428</a>, or find a counsellor through <a href="https://famsa.org.za" target="_blank" rel="noopener">FAMSA</a>.</p>` : ''}
  <div class="people">
    ${state.people.map((p, i) => `
    <div class="card">
      <div class="person-head">
        <span class="avatar" style="background:var(--${TINTS[i % TINTS.length]})" aria-hidden="true">${esc((p.name.trim()[0] || i + 1).toString().toUpperCase())}</span>
        <label>Person ${i + 1}<input class="field" placeholder="Their first name" value="${esc(p.name)}" data-name="${i}" maxlength="40"></label>
        ${state.people.length > 2 ? `<button class="remove" data-action="remove-person" data-i="${i}" aria-label="Remove ${esc(p.name || 'this person')}">×</button>` : ''}
      </div>
      <p class="label" data-enjoys="${i}">${enjoys(p.name)}</p>
      <ul class="chips">
        ${p.favourites.map((f, j) => `<li class="chip">${esc(f.name)} <em>${TYPE_LABEL[f.type] || ''}</em><button data-action="remove-fav" data-i="${i}" data-j="${j}" aria-label="Remove ${esc(f.name)}">×</button></li>`).join('')}
      </ul>
      ${p.favourites.length >= MAX_FAVS - 2 ? `<p class="limit" role="status">${p.favourites.length >= MAX_FAVS ? `That's the maximum of ${MAX_FAVS}. Remove one to add another.` : `${MAX_FAVS - p.favourites.length} more allowed (${MAX_FAVS} max).`}</p>` : ''}
      <p class="label">Add ${p.favourites.length ? 'more ' : ''}interests</p>
      <div class="cats" role="group" aria-label="Kind of interest">
        ${CATS.map(([key, label]) => `<button class="cat" data-action="cat" data-i="${i}" data-cat="${key}" aria-pressed="${(cats[i] || '') === key}">${label}</button>`).join('')}
      </div>
      <div class="add-row">
        <div class="search">
          <input class="field" data-search="${i}" placeholder="${esc(CATS.find(([key]) => key === (cats[i] || ''))[2])}" aria-label="Add an interest for ${esc(p.name || `person ${i + 1}`)}" autocomplete="off" ${p.favourites.length >= MAX_FAVS ? 'disabled' : ''}>
          <ul class="results" data-results="${i}" hidden></ul>
        </div>
        <button class="plus" data-action="search-now" data-i="${i}" aria-label="Search">+</button>
      </div>
    </div>`).join('')}
  </div>
  ${state.people.length < max ? `<button class="btn ghost small" data-action="add-person">+ Add someone</button>${state.people.length === max - 1 ? ` <span class="limit">You can add 1 more person (${max} max).</span>` : ''}` : max > 2 ? `<p class="limit">That's the maximum of ${max} people.</p>` : ''}
  <div class="location">
    <span class="pin">${svg('pin')}</span>
    <div>
      <p class="label">Optional: add a location</p>
      <div class="search">
        <input class="field" placeholder="Start typing a town or city, e.g. Durban" value="${esc(state.city)}" data-city aria-label="Location" autocomplete="off" maxlength="100">
        <ul class="results" data-places hidden></ul>
      </div>
    </div>
  </div>
  ${error ? `<p class="error" role="alert">${esc(error)}</p>` : ''}
  <div class="actions">
    ${state.people.some(p => p.favourites.length) ? `<button class="btn ghost" data-action="invite">${svg('link')} Invite them to add theirs</button>
    <span class="hint">Your picks travel inside the link, so only send it to them.</span>` : ''}
    <span class="spacer"></span>
    ${state.plan ? `<button class="btn ghost" data-action="plan">Back to your plan</button>` : ''}
    <button class="btn" data-action="run">${state.plan ? 'Update our plan' : 'Next: Explore'} ${svg('arrow')}</button>
  </div>`;
}

const examplePeople = () => EXAMPLE.people.map((p, i) => `<li><span class="avatar" style="background:var(--${TINTS[i]})">${esc(p.name[0])}</span><span><strong>${esc(p.name)}</strong>${p.favourites.map(f => esc(f.name)).join(', ')}</span></li>`).join('');

function exploring() {
  return `
  ${stepper(1)}
  <h1 style="text-align:center">Exploring your tastes…</h1>
  <p class="agent-line">${svg('spark')} This is an AI agent. It decides which Qloo searches to run, reads what comes back, and keeps going until it has a plan. Each step below says why it made that move.</p>
  ${state.demo ? `<div class="card demo-live">
    <p class="eyebrow">Live example · Sunday lunch at Gogo's, Johannesburg</p>
    <ul class="demo-people">${examplePeople()}</ul>
  </div>` : ''}
  <p class="lead" style="text-align:center;margin:0 auto">The agent is searching Qloo's taste graph for ${esc(listOf(names().map(n => /^(you|your date)$/i.test(n) ? n.toLowerCase() : n)))}. This takes about a minute.</p>
  <div class="card explore-card">
    <div class="bar"><svg class="logo" viewBox="0 0 52 36" aria-hidden="true"><path d="M26 6.51A14 14 0 0 1 26 29.49A14 14 0 0 1 26 6.51Z" fill="url(#cg-lens)"/><circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" stroke-width="2.6"/><circle cx="34" cy="18" r="14" fill="none" stroke="currentColor" stroke-width="2.6"/></svg><span>Exploring your tastes…</span></div>
    <ul class="trail" aria-live="polite">
      ${trailHtml(trail)}
      ${error ? '' : '<li class="thinking">Thinking…</li>'}
    </ul>
    ${error ? `<p class="error" role="alert">${esc(error)}</p><button class="btn" data-action="people">Try again</button>` : ''}
  </div>`;
}

// ---------- results dashboard ----------

const badge = source => source === 'qloo'
  ? '<span class="badge qloo" title="This came back from Qloo\'s taste graph">From Qloo data</span>'
  : '<span class="badge agent" title="Suggested by the agent, not from Qloo data">Agent\'s idea</span>';
// One tap from the plan to actually doing it. Plain search links: no extra keys or accounts.
const ACT = {
  artist: ['Listen', 'play', e => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${e.name} songs`)}`],
  person: ['Listen', 'play', e => `https://www.youtube.com/results?search_query=${encodeURIComponent(e.name)}`],
  movie: ['Watch trailer', 'play', e => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${e.name} trailer`)}`],
  tv_show: ['Watch trailer', 'play', e => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${e.name} trailer`)}`],
  podcast: ['Listen', 'play', e => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${e.name} podcast`)}`],
  book: ['Look inside', 'book', e => `https://www.google.com/search?tbm=bks&q=${encodeURIComponent(e.name)}`],
  place: ['Directions', 'pin', e => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([e.name, e.address].filter(Boolean).join(', '))}`],
  destination: ['Explore', 'pin', e => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.name)}`],
};
const act = e => {
  const [label, icon, url] = ACT[e?.type] || [];
  return label ? `<a class="act" href="${esc(url(e))}" target="_blank" rel="noopener">${svg(icon)} ${label}<span class="sr-only"> ${esc(e.name)} (opens in a new tab)</span></a>` : '';
};
// Research trail: rounds, each lookup with the agent's own reason, and what came back.
// Each step and its results share an id, so "found" lines can sit under the lookup that produced them.
const trailHtml = list => {
  const found = new Map(list.filter(t => t.type === 'found' && t.id !== undefined).map(t => [t.id, t.text]));
  return list.filter(t => t.type !== 'found' || t.id === undefined)
    .map(t => trailItem(t.type === 'step' && found.has(t.id) ? { ...t, result: found.get(t.id) } : t)).join('');
};
const trailItem = t => t.type === 'round'
  ? `<li class="round">Round ${t.n} · ${esc(t.text)}</li>`
  : `<li class="${t.type}">${esc(t.text)}${t.reason ? `<span class="reason">${esc(t.reason)}</span>` : ''}${t.result ? `<span class="result">Found: ${esc(t.result)}</span>` : ''}</li>`;
const tagLine = e => [TYPE_LABEL[e.type] || e.type, ...(e.genres?.length ? e.genres : e.tags || []).slice(0, 2)].filter(Boolean).map(esc).join(' · ');
// "King Richard: This film follows…" so a fact never points at an unnamed "this film"
const named = (text, e) => e?.name && !text.includes(e.name) ? `<b>${esc(e.name)}:</b> ${esc(text)}` : esc(text);
const unlessNamed = (text, e) => e?.name && !text.includes(e.name) ? ` (${e.name})` : '';

function row(item, title) {
  const e = item.entity || {};
  return `
  <li class="row-item">
    ${e.image ? `<img src="${esc(e.image)}" alt="" loading="lazy">` : `<span class="thumb round" style="background:var(--s3)">${svg(TYPE_ICON[e.type] || 'spark')}</span>`}
    <div>
      <strong>${title || esc(e.name)}</strong>
      <span class="tags">${tagLine(e)}</span>
      ${e.type === 'place' && e.description ? `<p><i>Qloo: "${esc(e.description)}"</i></p>` : ''}
      <p>${esc(item.why)}</p>
      <div class="acts">${badge(item.source)}${act(e)}</div>
    </div>
  </li>`;
}

function column(key, icon, tint, title, small, items, render) {
  const shown = expanded[key] ? items : items.slice(0, 3);
  return `
  <div class="card">
    <div class="col-head"><span class="icon" style="background:var(--${tint})">${svg(icon)}</span><div><h3>${title}</h3><small>${small}</small></div></div>
    <ul class="rows">${shown.map(render).join('') || '<li class="meta">Nothing this time.</li>'}</ul>
    ${items.length > 3 ? `<button class="link more" data-action="expand" data-col="${key}">${expanded[key] ? 'Show less' : `See all ${items.length}`}</button>` : ''}
  </div>`;
}

function planText() {
  const p = state.plan;
  return [
    `Common Ground plan for ${listOf(names())}`,
    p.headline, '',
    p.visit.title,
    ...p.visit.steps.map((s, i) => `${i + 1}. ${s.what}${unlessNamed(s.what, s.entity)}`), '',
    'Things to talk about:',
    ...p.conversationStarters.map(c => `- ${c.asker ? `${c.asker} asks ${c.to}: ` : ''}${c.question}${c.followUp ? ` (then: ${c.followUp})` : ''}`),
  ].join('\n');
}

function plan() {
  const p = state.plan;
  const visitNo = state.history.length + 1;
  const visitImg = p.visit.steps.find(s => s.entity?.image)?.entity.image;
  const sideItem = (icon, label, action, to, on) => `<button class="${on ? 'on' : ''}" data-action="${action}"${to ? ` data-to="${to}"` : ''}>${svg(icon)} ${label}</button>`;
  return `
  <div class="dash">
    <nav class="side" aria-label="Your connection">
      ${sideItem('home', 'My connection', 'scroll', 'found', true)}
      ${sideItem('people', 'People', 'people')}
      ${sideItem('search', 'Research', 'scroll', 'research')}
      ${sideItem('calendar', 'Next visit', 'scroll', 'next')}
      ${sideItem('clock', 'Past visits', 'scroll', 'past')}
      <div class="journey">
        <strong>Your journey</strong>
        The more you share, the better the suggestions.
        <div class="meter"><i style="width:${Math.min(visitNo, 5) * 20}%"></i></div>
        Visit ${Math.min(visitNo, 5)} of 5
      </div>
    </nav>
    <div class="dash-main">
      <section class="banner">
        <div class="photo"><img src="img/${state.groupType === 'grandparent' || !GROUPS[state.groupType] || GROUPS[state.groupType].hidden ? 'family' : state.groupType}.jpg" alt=""></div>
        <p class="eyebrow">Your connection · ${esc(listOf(names()))}</p>
        <h1>Here's what we found</h1>
        <p>${esc(p.headline)}</p>
      </section>
      ${p.notes?.text ? `<div class="notes card">
        <span class="icon" style="background:var(--s3)">${svg('spark')}</span>
        <div>
          <h3>Agent's notes</h3>
          <p>${esc(p.notes.text)}</p>
          ${p.notes.feedback ? `<p class="learned"><b>What I changed after your last visit:</b> ${esc(p.notes.feedback)}</p>` : ''}
          <p class="meta">${p.notes.lookups} Qloo lookups in ${p.notes.rounds} round${p.notes.rounds === 1 ? '' : 's'} · <button class="link" data-action="scroll" data-to="research">See every step</button></p>
        </div>
      </div>` : ''}
      ${state.demo ? `<div class="demo-strip"><span>${svg('spark')} That was the live example. Common Ground works the same way for your own people.</span><button class="btn small" data-action="scroll" data-to="who">Try it with your own people ${svg('arrow')}</button></div>` : ''}
      <div class="dash-body">
        <div class="visit" id="next">
          <div class="card">
            <div class="col-head"><span class="icon" style="background:var(--s4)">${svg('calendar')}</span><div><h3>Your next visit</h3><small>A simple plan to bring you closer</small></div></div>
            <div class="visit-main">
              ${visitImg ? `<img src="${esc(visitImg)}" alt="">` : '<span class="thumb"></span>'}
              <div>
                <strong style="color:var(--ink)">${esc(p.visit.title)}</strong>
                <ol class="vsteps">
                  ${p.visit.steps.map((s, i) => `<li><span class="n">${i + 1}</span><span><strong>${esc(s.what)}</strong>${unlessNamed(s.what, s.entity) ? ` <span class="meta">${esc(unlessNamed(s.what, s.entity))}</span>` : ''}<br>${esc(s.why || '')}<span class="acts">${badge(s.source)}${act(s.entity)}</span></span></li>`).join('')}
                </ol>
              </div>
            </div>
          </div>
          <div class="card starters">
            <div class="col-head"><span class="icon" style="background:var(--card)">${svg('chat')}</span><div><h3>${p.conversationStarters.length} conversation starters</h3></div></div>
            <ol class="starters-list">${p.conversationStarters.map(c => `<li>
              ${c.asker ? `<span class="asker">${esc(c.asker)} ${svg('arrow')} ${esc(c.to)}</span>` : ''}
              ${c.hook && c.entity ? `<span class="hook">${named(c.hook, c.entity)}</span>` : ''}
              <strong>${esc(c.question)}</strong>
              ${c.followUp ? `<span class="follow">If they light up: ${esc(c.followUp)}</span>` : ''}
            </li>`).join('')}</ol>
            <button class="btn small" data-action="save-plan">Save plan</button>
          </div>
        </div>

        <div class="cols3" id="found">
          ${column('bridges', 'spark', 's3', 'Bridges', `Things you'd ${names().length === 2 ? 'both' : 'all'} enjoy`, p.bridges, b => row(b))}
          ${column('swaps', 'swap', 's5', 'Swaps', "Each person's world, for the others", p.swaps, s => row(s, `${/^you$/i.test(s.from) ? 'You share' : `${esc(s.from)} shares`} ${esc(s.entity?.name)}`))}
          ${column('surprises', 'heart', 's2', 'Surprises', 'Interesting facts from the data', p.surprises || [], s => `
            <li class="row-item"><span class="thumb round" style="background:var(--s2)">${svg('spark')}</span><div><p style="margin:0;color:var(--ink)">${named(s.text, s.entity)}</p>${badge(s.source)}</div></li>`)}
        </div>

        <div class="card after">
          <span class="icon" style="background:var(--s3)">${svg('heart')}</span>
          <div><h3>After your visit</h3><p>Tell us what worked. The agent will learn and plan your next visit.</p></div>
          <button class="btn ghost small" data-action="feedback">Give feedback ${svg('arrow')}</button>
        </div>

        <div class="section-title" id="research"><h2>How the agent got here</h2></div>
        <details class="card">
          <summary>Every step the agent took, with its reasons</summary>
          <ul class="trail" style="margin-top:12px">${trailHtml(state.trail)}</ul>
        </details>

        <div class="section-title" id="past"><h2>Past visits</h2></div>
        <div class="card">
          ${state.history.length ? `<ul class="past">${state.history.map((h, i) => `<li><strong>Visit ${i + 1}: ${esc(h.title)}</strong><br><span class="meta">Loved: ${esc(h.worked.join(', ') || '—')} · Not for us: ${esc(h.didnt.join(', ') || '—')}</span></li>`).join('')}</ul>` : '<p class="meta" style="margin:0">No past visits yet. After your first visit, tap "Give feedback" and they\'ll appear here.</p>'}
        </div>

        <div class="actions"><button class="link" data-action="reset">Start a new connection</button></div>
      </div>
    </div>
  </div>`;
}

// Everything in the plan that points at a real Qloo entity can be rated after the visit.
function rateable() {
  const p = state.plan;
  const seen = new Set();
  return [...p.visit.steps, ...p.bridges, ...p.swaps]
    .filter(i => i.entity && !seen.has(i.entity.id) && seen.add(i.entity.id))
    .map(i => i.entity);
}

function feedbackScreen() {
  return `
  <button class="link back" data-action="plan">${svg('back')} Back to the plan</button>
  ${stepper(3)}
  <h1>How did it go?</h1>
  <p class="lead">Tap what landed and what didn't. The agent uses this to plan your next time together.</p>
  <div class="feedback">
    ${rateable().map(e => `
    <div class="card row">
      <span><strong style="color:var(--ink)">${esc(e.name)}</strong> <span class="meta">${esc(TYPE_LABEL[e.type] || '')}</span></span>
      <span class="opts">
        <button class="toggle yes" aria-pressed="${feedback[e.id] === 'yes'}" data-action="rate" data-id="${e.id}" data-v="yes">Loved it</button>
        <button class="toggle no" aria-pressed="${feedback[e.id] === 'no'}" data-action="rate" data-id="${e.id}" data-v="no">Not for us</button>
      </span>
    </div>`).join('')}
  </div>
  <div class="actions"><span class="spacer"></span><button class="btn" data-action="next">Plan our next visit ${svg('arrow')}</button></div>`;
}

const SCREENS = { home, people, exploring, plan, feedback: feedbackScreen };

function render() {
  if (!SCREENS[state.screen] || (state.screen === 'plan' && !state.plan) || (state.screen !== 'home' && !state.groupType)) state.screen = 'home';
  document.body.dataset.screen = state.screen;
  const html = SCREENS[state.screen]();
  app.innerHTML = ['home', 'plan'].includes(state.screen) ? html : `<div class="screen">${html}</div>`;
}

// ---------- actions ----------

const actions = {
  home: () => go('home'),
  scroll: el => {
    if (!document.getElementById(el.dataset.to)) go('home');
    document.getElementById(el.dataset.to)?.scrollIntoView();
  },
  people: () => { error = ''; go('people'); },
  plan: () => { rememberConnection(); go('plan'); },
  reset: () => { // you've seen the welcome already: go straight to choosing who it's for
    state = fresh();
    go('home');
    document.getElementById('who')?.scrollIntoView();
  },
  'open-saved': el => {
    const c = savedConnections().find(x => x.id === el.dataset.id);
    if (!c) return render();
    state = { ...fresh(), ...c, screen: 'plan' };
    feedback = {};
    expanded = {};
    go('plan');
  },
  'delete-saved': el => {
    const c = savedConnections().find(x => x.id === el.dataset.id);
    if (!c || !confirm(`Delete the connection with ${listOf(c.people.map(p => p.name))}? Its plans and past visits will be gone.`)) return;
    writeSaved(savedConnections().filter(x => x.id !== c.id));
    if (state.id === c.id) state = fresh();
    save();
    render();
  },
  example: () => {
    state = { ...fresh(), ...structuredClone(EXAMPLE), id: 'live-example', demo: true }; // one slot, however often it's run
    run();
  },
  group: el => {
    const g = el.dataset.group;
    state = { ...fresh(), groupType: g, people: GROUPS[g].names.map(name => ({ name, favourites: [] })) };
    go('people');
  },
  'add-person': () => { state.people.push({ name: '', favourites: [] }); save(); render(); app.querySelector(`[data-name="${state.people.length - 1}"]`)?.focus(); },
  'remove-person': el => { state.people.splice(+el.dataset.i, 1); save(); render(); },
  'remove-fav': el => { state.people[+el.dataset.i].favourites.splice(+el.dataset.j, 1); save(); render(); },
  cat: el => {
    const i = el.dataset.i;
    cats[i] = el.dataset.cat;
    el.parentElement.querySelectorAll('.cat').forEach(b => b.setAttribute('aria-pressed', b === el));
    const input = app.querySelector(`[data-search="${i}"]`);
    input.placeholder = CATS.find(([key]) => key === cats[i])[2];
    input.focus();
    if (input.value.trim().length >= 2) searchSoon(+i, input.value.trim(), 0);
  },
  invite: async () => {
    const filled = state.people.filter(p => p.favourites.length).length;
    const url = `${location.origin}${location.pathname}#invite=${encodeInvite(state)}`;
    const text = `I've added ${filled > 1 ? 'our' : 'my'} favourites on Common Ground. Add yours and let's see what we have in common:`;
    try {
      if (navigator.share) await navigator.share({ title: 'Common Ground', text, url });
      else { await navigator.clipboard.writeText(`${text} ${url}`); toast('Invite link copied. Paste it into WhatsApp or a message.'); }
    } catch { /* share sheet closed */ }
  },
  'search-now': el => {
    const input = app.querySelector(`[data-search="${el.dataset.i}"]`);
    if (input.value.trim().length < 2) return input.focus();
    searchSoon(+el.dataset.i, input.value.trim(), 0);
  },
  expand: el => { expanded[el.dataset.col] = !expanded[el.dataset.col]; render(); document.getElementById('found')?.scrollIntoView(); },
  'save-plan': async () => {
    const text = planText();
    try {
      if (navigator.share) await navigator.share({ title: 'Our Common Ground plan', text });
      else { await navigator.clipboard.writeText(text); toast('Plan copied. Paste it into WhatsApp or a note.'); }
    } catch { /* share sheet closed */ }
  },
  run: () => run(),
  feedback: () => { feedback = {}; go('feedback'); },
  rate: el => {
    const { id, v } = el.dataset;
    feedback[id] = feedback[id] === v ? undefined : v;
    render();
  },
  next: () => {
    const items = rateable();
    const pick = v => items.filter(e => feedback[e.id] === v);
    state.history = [...state.history, { title: state.plan.visit.title, worked: pick('yes').map(e => e.name), didnt: pick('no').map(e => e.name) }].slice(-5);
    // What everyone loved becomes part of everyone's taste for the next plan.
    for (const e of pick('yes')) for (const p of state.people) {
      if (p.favourites.length < MAX_FAVS && !p.favourites.some(f => f.id === e.id)) p.favourites.push({ id: e.id, name: e.name, type: e.type });
    }
    run();
  },
};

function validate() {
  const ns = names();
  if (ns.length !== state.people.length) return 'Give everyone a name.';
  if (new Set(ns.map(n => n.toLowerCase())).size !== ns.length) return 'Give everyone a different name.';
  const empty = state.people.find(p => !p.favourites.length);
  if (empty) return `Add at least one interest for ${empty.name.trim().toLowerCase() === 'you' ? 'yourself' : empty.name}.`;
  return '';
}

async function run() {
  error = validate();
  if (error) {
    state.screen = 'people';
    render();
    return app.querySelector('.error')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  trail = [];
  expanded = {};
  go('exploring');
  try {
    const res = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupType: state.groupType,
        city: state.city.trim() || undefined,
        point: state.point || undefined,
        people: state.people.map(p => ({ name: p.name.trim(), favourites: p.favourites })),
        history: state.history,
      }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Something went wrong. Please try again.');
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines.filter(Boolean)) {
        const event = JSON.parse(line);
        if (event.type === 'plan') { state.plan = event.plan; state.trail = trail; rememberConnection(); return go('plan'); }
        if (event.type === 'error') throw new Error(event.text);
        trail.push(event);
        if (state.screen === 'exploring') {
          render();
          app.querySelector('.trail li:last-child')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
    }
    throw new Error('The agent stopped before finishing. Please try again.');
  } catch (err) {
    error = err instanceof TypeError ? 'Lost the connection to the agent. Please try again.' : err.message;
    render();
  }
}

// ---------- events ----------

document.addEventListener('click', e => { // header buttons live outside #app
  const pick = e.target.closest('[data-pick]');
  if (pick) return addFavourite(pick);
  const place = e.target.closest('[data-place]');
  if (place) {
    const { label, lat, lon } = JSON.parse(place.dataset.place);
    Object.assign(state, { city: label, point: { lat, lon } });
    save();
    return render();
  }
  const el = e.target.closest('[data-action]');
  if (!el) return;
  e.preventDefault();
  actions[el.dataset.action]?.(el);
});

app.addEventListener('input', e => {
  const t = e.target;
  if (error && state.screen === 'people') { error = ''; app.querySelector('.error')?.remove(); }
  if (t.dataset.name !== undefined) {
    state.people[+t.dataset.name].name = t.value;
    const avatar = t.closest('.person-head').querySelector('.avatar');
    avatar.textContent = (t.value.trim()[0] || +t.dataset.name + 1).toString().toUpperCase();
    app.querySelector(`[data-enjoys="${t.dataset.name}"]`).innerHTML = enjoys(t.value);
    save();
  }
  if (t.dataset.city !== undefined) { state.city = t.value; state.point = null; save(); placesSoon(t.value.trim()); }
  if (t.dataset.search !== undefined) searchSoon(+t.dataset.search, t.value.trim());
});

app.addEventListener('keydown', e => {
  if (e.target.dataset.city !== undefined) {
    if (e.key === 'Escape') app.querySelector('[data-places]').hidden = true;
    if (e.key === 'Enter') { e.preventDefault(); app.querySelector('[data-places] [data-place]')?.click(); }
    return;
  }
  if (e.target.dataset.search === undefined) return;
  if (e.key === 'Escape') app.querySelector(`[data-results="${e.target.dataset.search}"]`).hidden = true;
  if (e.key === 'Enter') { e.preventDefault(); app.querySelector(`[data-results="${e.target.dataset.search}"] [data-pick]`)?.click(); }
});

// Town and city suggestions come from Photon (OpenStreetMap). Picking one gives exact coordinates,
// because Qloo matches place names loosely ("Durban" can land in Durbanville).
let placeTimer;
function placesSoon(q) {
  clearTimeout(placeTimer);
  const list = app.querySelector('[data-places]');
  if (q.length < 2) { list.hidden = true; return; }
  placeTimer = setTimeout(async () => {
    try {
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en&layer=city&layer=district&layer=locality`);
      const seen = new Set();
      const places = (await res.json()).features.map(f => {
        const { name, state: region, country } = f.properties;
        const [lon, lat] = f.geometry.coordinates;
        return { label: [name, region, country].filter(Boolean).join(', '), name, where: [region, country].filter(Boolean).join(', '), lat, lon };
      }).filter(p => !seen.has(p.label) && seen.add(p.label));
      if (app.querySelector('[data-city]')?.value.trim() !== q) return; // the user kept typing
      list.hidden = !places.length;
      list.innerHTML = places.map(p => `<li><button data-place='${esc(JSON.stringify({ label: p.label, lat: p.lat, lon: p.lon }))}'>
        <span class="thumb round">${svg('pin')}</span><span>${esc(p.name)}<small>${esc(p.where)}</small></span></button></li>`).join('');
    } catch {
      list.hidden = true; // suggestions are a nicety; typing a city still works
    }
  }, 250);
}

let timer;
let latest = 0;
function searchSoon(i, q, delay = 300) {
  clearTimeout(timer);
  const list = app.querySelector(`[data-results="${i}"]`);
  if (q.length < 2) { list.hidden = true; return; }
  timer = setTimeout(async () => {
    const ticket = ++latest;
    list.hidden = false;
    list.innerHTML = '<li class="hint">Searching Qloo…</li>';
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}${cats[i] ? `&cat=${cats[i]}` : ''}`);
      const seen = new Set(); // Qloo sometimes lists the same title more than once
      const all = await res.json();
      // Hide a "person" that is the same singer as an artist result, but not a namesake:
      // Tyla the South African singer must survive Tyla the English rock musician.
      const artists = new Map(all.filter(r => r.type === 'artist').map(r => [r.name.toLowerCase(), (r.description || '').toLowerCase()]));
      const sameSinger = r => r.type === 'person' && artists.get(r.name.toLowerCase())?.includes((r.description || '').toLowerCase().split(' ')[0]);
      const found = all.filter(r => TYPE_LABEL[r.type] && !sameSinger(r) && !seen.has(r.type + r.name) && seen.add(r.type + r.name));
      if (ticket !== latest) return;
      list.innerHTML = found.length
        ? found.map(r => `<li><button data-pick='${esc(JSON.stringify({ id: r.id, name: r.name, type: r.type }))}' data-i="${i}">
            ${r.image ? `<img src="${esc(r.image)}" alt="">` : '<span class="thumb"></span>'}
            <span>${esc(r.name)}<small>${TYPE_LABEL[r.type]}${r.description ? ` · ${esc(r.description.slice(0, 70))}` : ''}</small></span></button></li>`).join('')
        : '<li class="hint">Nothing found. Try another spelling, or a related artist or film.</li>';
      list.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); // on phones the keyboard can hide it
    } catch {
      if (ticket === latest) list.innerHTML = '<li class="hint">Search failed. Try again.</li>';
    }
  }, delay);
}

function addFavourite(pick) {
  error = ''; // whatever was missing may be fixed now; Next checks again anyway
  const i = +pick.dataset.i;
  const fav = JSON.parse(pick.dataset.pick);
  const favs = state.people[i].favourites;
  if (!favs.some(f => f.id === fav.id) && favs.length < MAX_FAVS) favs.push(fav);
  save();
  render();
  app.querySelector(`[data-search="${i}"]`)?.focus();
}

// Opened from an invite link: load the picks, then drop them from the address bar.
function openInvite() {
  if (!location.hash.startsWith('#invite=')) return false;
  const invite = decodeInvite(location.hash.slice(8));
  history.replaceState(null, '', location.pathname);
  if (!invite) { toast("That invite link didn't open properly. Ask them to send it again."); return false; }
  // Default first-date names are written from the sender's side; flip them for the person opening the link.
  const flip = { you: 'Your date', 'your date': 'You' };
  for (const p of invite.people) p.name = flip[p.name.trim().toLowerCase()] || p.name;
  state = { ...fresh(), ...invite, screen: 'people', invitedBy: listOf(invite.people.filter(p => p.favourites.length).map(p => p.name)) };
  save();
  return true;
}
// A link pasted into a tab where the app is already open only changes the #part, so listen for that too.
window.addEventListener('hashchange', () => { if (openInvite()) go('people'); });

if (state.plan && !savedConnections().some(c => c.id === state.id)) rememberConnection();
const invited = openInvite();
render();
if (invited) window.scrollTo(0, 0);
