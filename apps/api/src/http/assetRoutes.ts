import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { AssetPath } from '@spamtools/card-catalog';
import type { FastifyInstance } from 'fastify';

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
};

const ONE_DAY_IN_SECONDS = 86_400;

/**
 * Adaptateur entrant : images des cartes téléchargées par la synchro,
 * servies sous /api/assets/<chemin relatif au dossier data/ du jeu>.
 */
export async function assetRoutes(app: FastifyInstance, { assetsDirectory }: { assetsDirectory: string }): Promise<void> {
  app.get<{ Params: { '*': string } }>('/api/assets/*', async (request, reply) => {
    const file = await resolveImage(assetsDirectory, request.params['*']);
    if (file === undefined) {
      return reply.code(404).send({ error: 'Image introuvable' });
    }
    return reply
      .type(file.contentType)
      .header('Cache-Control', `public, max-age=${ONE_DAY_IN_SECONDS}`)
      .header('X-Content-Type-Options', 'nosniff')
      .send(createReadStream(file.path));
  });
}

async function resolveImage(
  assetsDirectory: string,
  requested: string,
): Promise<{ path: string; contentType: string } | undefined> {
  let asset: AssetPath;
  try {
    // Même validation qu'à l'écriture : aucun chemin ne peut sortir du dossier des images.
    asset = AssetPath.of(requested);
  } catch {
    return undefined;
  }
  const contentType = CONTENT_TYPES[path.extname(asset.value).toLowerCase()];
  if (contentType === undefined) {
    return undefined;
  }
  const file = path.join(assetsDirectory, ...asset.value.split('/'));
  try {
    return (await stat(file)).isFile() ? { path: file, contentType } : undefined;
  } catch {
    return undefined;
  }
}
