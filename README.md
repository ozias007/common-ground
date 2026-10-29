# Common Ground

**An AI agent that finds the shared world between people who have drifted apart, then plans their next time together.**

Built for the [Qloo Agentic Hackathon](https://qloo-agentic-hackathon.devpost.com/).

**Live demo:** https://commonground-agent.vercel.app

Click **Watch a live example** to see the agent plan Sunday lunch for Gogo Thandi and her three grandkids, no typing needed. Then try it with your own people.

A gogo who loves Jim Reeves. Grandkids who love Burna Boy, Lucky Dube and Ladysmith Black Mambazo. They love each other, but Sunday lunch runs out of things to say. About 1 in 6 people worldwide experience loneliness (WHO, 2025), and often the people we love are right there. We've just run out of things to share.

Common Ground takes a few favourites from each person and uses **Qloo's taste graph** to find:

- **Bridges**: films, music, shows, books and places the whole group is likely to enjoy, from one blended taste signal of everyone's favourites.
- **Swaps**: from each person's world, the thing the *others* are most likely to love. ("Gogo, play them Sibongile Khumalo first.")
- **Surprises**: non-obvious cultural links the data shows.
- **A plan for the next visit** that names the actual song, film and place ("Sipho plays Gogo some Davido · Watch King Richard together · Lunch at Roar Bistro"), plus 4 or 5 conversation starters. Each says who asks whom ("Sipho → Gogo"), opens with a fact from Qloo's data about a recommended item, and comes with a follow-up for when they light up. The mix is deliberate: one invites the older person to tell a story from their time, one lets the younger person teach something, one is a playful this-or-that.
- **One tap to do it**: every song, film, show, book and place has a *Listen*, *Watch trailer*, *Look inside* or *Directions* button (YouTube, Google Books and Google Maps search links, no extra accounts).

Adding interests is a search over Qloo: type a name, optionally narrow it with a category button, and pick the right match from the labelled results ("Tyla · Public figure · South African singer-songwriter"). A namesake isn't hidden as a duplicate: Tyla the South African singer still shows next to Tyla the English rock musician.

**Each person can add their own favourites.** After adding yours, tap *Invite them to add theirs*: your picks travel inside a link (no accounts, no database) that you send on WhatsApp. The other person opens it, sees your card filled in, adds theirs and gets the plan. Links are checked strictly when opened, and anything that doesn't look like a genuine invite is ignored.

**Your connections are kept.** Every connection with a plan is saved on your device and listed on the home page ("Gogo Thandi, Sipho, Lerato and Ayanda · Visit 3 · planned 2 days ago"). Open one to go straight back to its plan, past visits and what the agent has learned; starting a new one never wipes the old ones. Tastes change, so you can edit anyone's favourites at any time and either go back to the current plan or tap *Update our plan*; the agent keeps what it learned from past visits.

After the visit you tap what landed. The agent folds that into everyone's taste and plans the next visit.

Works for 2 to 5 people: grandparent and grandchildren, couples who've grown distant, parents and teens, carers and residents, and two people about to go on a first date who want something to talk about.

## Why it needs Qloo

A plain LLM guesses at what a 75-year-old Jim Reeves fan and a 16-year-old Burna Boy fan might both enjoy. Qloo knows. Four Qloo calls do the work:

| What | Qloo call |
|---|---|
| Resolve "Brenda Fassie" to a real entity, optionally within a category (Music, Films, TV shows, Books, Podcasts, Food & places, Travel, Sport & brands, Famous people) | `GET /search` with `types` |
| Bridges: one blended signal from everyone's favourites | `GET /v2/insights` with `signal.interests.entities=A,B,C` |
| Swaps: take person A's world, re-rank it by everyone else's taste | `GET /v2/insights` with `filter.results.entities` |
| Real places nearby | `GET /v2/insights` with `filter.type=urn:entity:place`, `filter.location=POINT(lon lat)` and a 15 km `filter.location.radius` |

**Evidence is enforced in code, not just in the prompt.** Every bridge and swap must point at an entity id that a Qloo call actually returned during that run, or it is dropped before anyone sees it. Things the people already love are dropped too, so every suggestion is a discovery. Everything on screen is labelled *From Qloo data* or *Agent's idea*.

**Places must be somewhere you'd spend an afternoon.** Qloo's nearby results include schools, radio stations and holiday villas, so the server keeps only places whose Qloo categories are restaurants, cafés, bars, venues, museums, parks, markets and the like.

**Places are searched by exact coordinates.** Qloo matches place names loosely (a text search for "Durban" returned cafés in Durbanville, Cape Town), so the location box suggests real towns as you type and sends the chosen town's coordinates.

## How the agent works

`lib/agent.js` runs a tool-calling loop on Gemini, in rounds:

1. **Round 1, explore.** The model gets the people, their favourites, the place and any past-visit feedback, and chooses its Qloo lookups (`find_bridges` across several categories, `find_places`), all at once.
2. **Round 2, react.** It reads what came back, notices whose world the results lean towards, and targets the gaps: `find_swaps` from every person, starting with whoever was served least. A real run: *"The bridges leaned towards classic Afro-jazz and gospel, so I am exploring what from Sipho's modern Afrobeats universe Gogo Thandi and the family would love."*
3. **Plan.** It calls `submit_plan`. The server attaches the real Qloo entities, drops anything without evidence, and adds counts (Qloo lookups, rounds).
4. **Learn.** After the visit, what people loved becomes part of everyone's taste and what they didn't is passed back, and the next plan says what it changed: *"We kept the upbeat African rhythms that worked so well with Davido, while shifting away from sports drama toward The Boy Who Harnessed the Wind."*

**The agent is visible, not hidden behind a spinner.** Every lookup carries the agent's own one-line reason, the trail is grouped into rounds, and the results open with an *Agent's notes* card: what it explored, what it noticed, how it balanced the group, and what it changed after the last visit.

Each step streams to the browser, so you watch the agent research.

**Built to survive a free tier.** Gemini's free quota is per model per day, so the agent walks a list of six models and hands over when one is busy or out of quota. Identical requests (like the live example) replay the last plan from memory in a few seconds instead of spending quota. Qloo lookups are queued (at most 4 at a time, because the hackathon key rate-limits bursts), retried on a rate limit or dropped connection, and cached per server instance.

## Run it locally

Needs Node 20+, a [Qloo hackathon API key](https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide#getting-your-api-key) and a [Gemini API key](https://aistudio.google.com/apikey).

```bash
cp .env.example .env    # then fill in QLOO_API_KEY and GEMINI_API_KEY
npm run dev             # http://localhost:3100
npm test                # offline unit tests (agent loop, evidence rule, model fallback, input checks, Qloo queue, invite links)
npm run test:live       # live smoke check against Qloo
```

No build step and no dependencies: plain HTML/CSS/JS in `public/`, two serverless functions in `api/`.

## Deploy

Import the repo into [Vercel](https://vercel.com), add `QLOO_API_KEY` and `GEMINI_API_KEY` as environment variables, deploy. `vercel.json` sets no framework (so Vercel serves `public/` as static files instead of guessing a Node server) and gives the agent up to 5 minutes per run.

## Privacy and safety

- No accounts. What you type, and your saved connections, stay in your browser (localStorage) and are sent only to plan your visit.
- Invite links carry the sender's picks in the link itself, and the app says so before you share one.
- Qloo responses are never stored in the repo; the server keeps recent plans in memory only.
- Town suggestions come straight from the browser to [Photon](https://photon.komoot.io) (OpenStreetMap data). Picking one sends exact coordinates so Qloo searches within 15 km.
- The couples flow says plainly that this isn't counselling and points to free helplines in any country (findahelpline.com).
- The first-date flow reminds people to meet somewhere public, tell a friend, and plan their own way home.

## Credits

- Taste data: [Qloo](https://www.qloo.com) Taste AI.
- Agent: Google Gemini.
- Town suggestions: [Photon](https://photon.komoot.io) by komoot, using [OpenStreetMap](https://www.openstreetmap.org/copyright) data.
- Photos: AI-generated for this project.

MIT licensed. See [LICENSE](LICENSE).
