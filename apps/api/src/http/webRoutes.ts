import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance, FastifyReply } from 'fastify';

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/**
 * Adaptateur entrant : sert le front compilé (apps/web/dist) en production.
 * Les fichiers de /assets/ ont un nom versionné par Vite : mis en cache longtemps. Toute autre
 * route inconnue (hors /api) renvoie index.html, que le front interprète (/deck, /collection...).
 */
export async function webRoutes(app: FastifyInstance, { webDirectory }: { webDirectory: string }): Promise<void> {
  const root = path.resolve(webDirectory);
  const index = path.join(root, 'index.html');

  app.get('/*', async (request, reply) => {
    const requested = decodeURIComponent(request.url.split('?')[0] ?? '/');
    if (requested.startsWith('/api/')) {
      return reply.code(404).send({ error: 'Route inconnue' });
    }
    const file = path.resolve(root, `.${requested}`);
    // Jamais en dehors du dossier du front.
    const inside = file === root || file.startsWith(root + path.sep);
    if (inside && (await isFile(file))) {
      const immutable = requested.startsWith('/assets/');
      return send(reply, file, immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
    }
    return send(reply, index, 'no-cache');
  });
}

function send(reply: FastifyReply, file: string, cacheControl: string) {
  return reply
    .type(CONTENT_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream')
    .header('Cache-Control', cacheControl)
    .header('X-Content-Type-Options', 'nosniff')
    .send(createReadStream(file));
}

async function isFile(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}
