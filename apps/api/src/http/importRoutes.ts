import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { Container } from '../container.js';

/**
 * Adaptateur entrant : traduit les requêtes HTTP en cas d'utilisation.
 * Le fichier envoyé par le navigateur est déposé dans un dossier temporaire
 * pour que le domaine continue de raisonner en "source + emplacement".
 */
export async function importRoutes(app: FastifyInstance, { container }: { container: Container }): Promise<void> {
  app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, (_request, body, done) => {
    done(null, body);
  });

  app.post<{ Body: Buffer }>('/api/imports', async (request, reply) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'spamtools-import-'));
    try {
      const location = path.join(directory, 'upload.json');
      await writeFile(location, request.body);
      const result = await container.runImport.execute({ kind: 'json', location });
      return reply.code(result.status === 'completed' ? 201 : 422).send(result);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}
