import { loadConfig } from './config.js';
import { createContainer } from './container.js';
import { createServer } from './http/createServer.js';

const port = Number(process.env.PORT ?? 3000);
/** 127.0.0.1 en développement ; 0.0.0.0 dans un conteneur (voir Dockerfile). */
const host = process.env.HOST ?? '127.0.0.1';

const HOUR_MS = 60 * 60 * 1000;
/** Première mise à jour automatique : peu après le démarrage, une fois le serveur prêt. */
const FIRST_SYNC_DELAY_MS = 5 * 60 * 1000;

async function main(): Promise<void> {
  const config = loadConfig();
  const container = await createContainer(config);
  const server = createServer(container);
  await server.listen({ port, host });
  if (config.catalogSyncIntervalHours !== undefined) {
    container.catalogSyncJob.schedule({
      intervalMs: config.catalogSyncIntervalHours * HOUR_MS,
      firstDelayMs: FIRST_SYNC_DELAY_MS,
    });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
