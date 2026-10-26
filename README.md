# Common Ground

**An AI agent that finds the shared world between people who have drifted apart, then plans their next time together.**

Built for the [Qloo Agentic Hackathon](https://qloo-agentic-hackathon.devpost.com/).

**Live demo:** _link added once deployed_. Click **Watch a live example** to see the agent plan Sunday lunch for Gogo Thandi and her three grandkids, no typing needed. Then try it with your own people.

A gogo who loves Jim Reeves. Grandkids who love Burna Boy, Lucky Dube and Ladysmith Black Mambazo. They love each other, but Sunday lunch runs out of things to say. About 1 in 6 people worldwide experience loneliness (WHO, 2025), and often the people we love are right there. We've just run out of things to share.

Common Ground takes a few favourites from each person and uses **Qloo's taste graph** to find:

- **Bridges**: films, music, shows, books and places the whole group is likely to enjoy, from one blended taste signal of everyone's favourites.
- **Swaps**: from each person's world, the thing the *others* are most likely to love. ("Gogo, play them Sibongile Khumalo first.")
- **Surprises**: non-obvious cultural links the data shows.
- **A plan for the next visit**: a song swap, something to watch together, a real place nearby, and conversation starters that grow out of what they'll share.

After the visit you tap what landed. The agent folds that into everyone's taste and plans the next visit.

Works for 2 to 5 people: grandparent and grandchildren, couples who've grown distant, parents and teens, carers and residents, and two people about to go on a first date who want something to talk about.

## Why it needs Qloo

A plain LLM guesses at what a 75-year-old Jim Reeves fan and a 16-year-old Burna Boy fan might both enjoy. Qloo knows. Four Qloo calls do the work:

| What | Qloo call |
|---|---|
| Resolve "Brenda Fassie" to a real entity | `GET /search` |
| Bridges: one blended signal from everyone's favourites | `GET /v2/insights` with `signal.interests.entities=A,B,C` |
| Swaps: take person A's world, re-rank it by everyone else's taste | `GET /v2/insights` with `filter.results.entities` |
| Real places nearby | `GET /v2/insights` with `filter.type=urn:entity:place`, `filter.location=POINT(lon lat)` and a 15 km `filter.location.radius` |

**Evidence is enforced in code, not just in the prompt.** Every bridge and swap must point at an entity id that a Qloo call actually returned during that run, or it is dropped before anyone sees it. Things the people already love are dropped too, so every suggestion is a discovery. Everything on screen is labelled *From Qloo data* or *Agent's idea*.

**Places are searched by exact coordinates.** Qloo matches place names loosely (a text search for "Durban" returned cafés in Durbanville, Cape Town), so the location box suggests real towns as you type and sends the chosen town's coordinates.

## How the agent works

`lib/agent.js` runs a tool-calling loop on Gemini:

1. The model gets the people, their favourites, the city and any past-visit feedback.
2. It chooses which Qloo tools to call (`find_bridges`, `find_swaps`, `find_places`, `search_entity`), usually several at once, across categories and from every person's side.
3. Results come back slimmed down; the agent checks for gaps (e.g. bridges leaning to one person's world) and calls more tools.
4. It finishes by calling `submit_plan`. The server attaches the real Qloo entities and drops anything without evidence.

Each step streams to the browser, so you watch the agent research.

**Built to survive a free tier.** Gemini's free quota is per model per day, so the agent walks a list of six models and hands over when one is busy or out of quota. Identical requests (like the live example) replay the last plan from memory in a few seconds instead of spending quota. Qloo calls retry once and are cached per server instance.

## Run it locally

Needs Node 20+, a [Qloo hackathon API key](https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide#getting-your-api-key) and a [Gemini API key](https://aistudio.google.com/apikey).

```bash
cp .env.example .env    # then fill in QLOO_API_KEY and GEMINI_API_KEY
npm run dev             # http://localhost:3100
npm test                # offline unit tests (agent loop, evidence rule, model fallback, input checks)
npm run test:live       # live smoke check against Qloo
```

No build step and no dependencies: plain HTML/CSS/JS in `public/`, two serverless functions in `api/`.

## Deploy

Import the repo into [Vercel](https://vercel.com), add `QLOO_API_KEY` and `GEMINI_API_KEY` as environment variables, deploy. `vercel.json` gives the agent up to 5 minutes per run.

## Privacy and safety

- No accounts. What you type stays in your browser (localStorage) and is sent only to plan your visit.
- Qloo responses are never stored in the repo; the server keeps recent plans in memory only.
- Town suggestions come straight from the browser to [Photon](https://photon.komoot.io) (OpenStreetMap data). Picking one sends exact coordinates so Qloo searches within 15 km.
- The couples flow says plainly that this isn't counselling and points to the GBV Command Centre (0800 428 428) and FAMSA.
- The first-date flow reminds people to meet somewhere public, tell a friend, and plan their own way home.

## Credits

- Taste data: [Qloo](https://www.qloo.com) Taste AI.
- Agent: Google Gemini.
- Town suggestions: [Photon](https://photon.komoot.io) by komoot, using [OpenStreetMap](https://www.openstreetmap.org/copyright) data.
- Photos: AI-generated for this project.

MIT licensed. See [LICENSE](LICENSE).
