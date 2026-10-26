// GET /api/search?q=Jim%20Reeves&cat=music — resolves a typed favourite to Qloo entities.
import { searchEntity } from '../lib/qloo.js';

// Category buttons in the UI map onto Qloo entity types. Musicians and sports stars are often
// Qloo "person" entities, so person sits in more than one group.
export const CATEGORIES = {
  music: ['artist', 'person'],
  films: ['movie'],
  tv: ['tv_show'],
  books: ['book'],
  podcasts: ['podcast'],
  places: ['place'],
  travel: ['destination'],
  sport: ['brand', 'person'],
  people: ['person'],
};

export default async function handler(req, res) {
  const params = new URL(req.url, 'http://x').searchParams;
  const q = params.get('q')?.trim();
  const cat = params.get('cat');
  if (!q || q.length > 80 || (cat && !CATEGORIES[cat])) return res.writeHead(400).end();
  try {
    const results = await searchEntity({ query: q, types: CATEGORIES[cat], take: cat ? 8 : 6 });
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(results));
  } catch (err) {
    console.error(err);
    res.writeHead(502).end();
  }
}
