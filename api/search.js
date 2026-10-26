// GET /api/search?q=Jim%20Reeves — resolves a typed favourite to Qloo entities.
import { searchEntity } from '../lib/qloo.js';

export default async function handler(req, res) {
  const q = new URL(req.url, 'http://x').searchParams.get('q')?.trim();
  if (!q || q.length > 80) return res.writeHead(400).end();
  try {
    const results = await searchEntity({ query: q });
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(results));
  } catch (err) {
    console.error(err);
    res.writeHead(502).end();
  }
}
