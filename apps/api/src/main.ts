import { loadConfig } from './config.js';
import { createContainer } from './container.js';
import { createServer } from './http/createServer.js';

const port = Number(process.env.PORT ?? 3000);
/** 127.0.0.1 en développement ; 0.0.0.0 dans un conteneur (voir Dockerfile). */
const host = process.env.HOST ?? '127.0.0.1';

async function main(): Promise<void> {
  const server = createServer(await createContainer(loadConfig()));
  await server.listen({ port, host });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
