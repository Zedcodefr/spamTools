import { createContainer } from './container.js';
import { createServer } from './http/createServer.js';

const port = Number(process.env.PORT ?? 3000);
const server = createServer(createContainer());

server.listen({ port, host: '127.0.0.1' }).catch((error: unknown) => {
  server.log.error(error);
  process.exit(1);
});
