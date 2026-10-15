import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Container } from '../container.js';
import { catalogSnapshots, headTags, robotsTxt, seoFor, sitemapXml } from './seo.js';

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
 * route inconnue (hors /api) renvoie index.html, que le front interprète (/deck, /collection...),
 * complété pour le référencement (voir seo.ts) ; robots.txt et sitemap.xml sont générés.
 */
export async function webRoutes(
  app: FastifyInstance,
  { webDirectory, container }: { webDirectory: string; container: Container },
): Promise<void> {
  const root = path.resolve(webDirectory);
  const index = path.join(root, 'index.html');
  const catalog = catalogSnapshots(container);
  let template: Promise<string> | undefined;
  const baseUrl = (request: FastifyRequest) => container.config.publicUrl ?? `${request.protocol}://${request.host}`;

  app.get('/robots.txt', (request, reply) =>
    reply.type('text/plain; charset=utf-8').header('Cache-Control', 'public, max-age=3600').send(robotsTxt(baseUrl(request))),
  );

  app.get('/sitemap.xml', async (request, reply) =>
    reply
      .type('application/xml; charset=utf-8')
      .header('Cache-Control', 'public, max-age=3600')
      .send(sitemapXml(baseUrl(request), await catalog())),
  );

  /** index.html avec le titre, la description et le contenu sans JavaScript de la page demandée. */
  const page = async (request: FastifyRequest, reply: FastifyReply) => {
    template ??= readFile(index, 'utf8');
    const url = new URL(request.url, 'http://localhost');
    const base = baseUrl(request);
    const seo = seoFor(url.pathname, url.searchParams.get('card'), await catalog(), base);
    const html = (await template)
      .replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/, () => headTags(seo, base))
      .replace('<!--seo:body-->', () => (seo.noscript === '' ? '' : `<noscript><main class="noscript">${seo.noscript}</main></noscript>`));
    return reply
      .type('text/html; charset=utf-8')
      .header('Cache-Control', 'no-cache')
      .header('X-Content-Type-Options', 'nosniff')
      .send(html);
  };

  app.get('/*', async (request, reply) => {
    const requested = decodeURIComponent(request.url.split('?')[0] ?? '/');
    if (requested.startsWith('/api/')) {
      return reply.code(404).send({ error: 'Route inconnue' });
    }
    const file = path.resolve(root, `.${requested}`);
    // Jamais en dehors du dossier du front.
    const inside = file === root || file.startsWith(root + path.sep);
    if (file === index) {
      return page(request, reply);
    }
    if (inside && (await isFile(file))) {
      const immutable = requested.startsWith('/assets/');
      return send(reply, file, immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
    }
    return page(request, reply);
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
