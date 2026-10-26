// Local dev server: serves public/ and the api/ functions the same way Vercel does.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
const PORT = process.env.PORT || 3100;

createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  if (path.startsWith('/api/')) {
    const name = path.slice(5).replace(/[^a-z]/g, '');
    try {
      const { default: handler } = await import(`./api/${name}.js`);
      let raw = '';
      for await (const chunk of req) raw += chunk;
      req.body = raw ? JSON.parse(raw) : undefined;
      return handler(req, res);
    } catch (err) {
      console.error(err);
      return res.writeHead(404).end();
    }
  }
  const file = join('public', normalize(path === '/' ? 'index.html' : path).replace(/^(\.\.[/\\])+/, ''));
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(PORT, () => console.log(`Common Ground on http://localhost:${PORT}`));
