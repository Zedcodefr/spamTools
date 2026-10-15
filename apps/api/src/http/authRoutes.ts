import type { Role } from '@spamtools/identity';
import type { FastifyInstance } from 'fastify';
import type { Container } from '../container.js';
import { accountOf, clearSessionCookie, SESSION_COOKIE, setSessionCookie } from './authentication.js';

/** Tentatives par adresse IP : connexion, liens de mot de passe, changement de mot de passe. */
const SENSITIVE = { rateLimit: { max: 10, timeWindow: '1 minute' } } as const;

const password = { type: 'string', minLength: 1, maxLength: 1024 } as const;
const token = { type: 'string', minLength: 1, maxLength: 128 } as const;

/**
 * Adaptateur entrant : connexion, compte de l'utilisateur, et administration des comptes.
 */
export async function authRoutes(app: FastifyInstance, { container }: { container: Container }): Promise<void> {
  // --- Connexion -------------------------------------------------------------------------------
  app.post<{ Body: { username: string; password: string } }>(
    '/api/auth/login',
    {
      config: SENSITIVE,
      schema: {
        body: {
          type: 'object',
          required: ['username', 'password'],
          properties: { username: { type: 'string', maxLength: 64 }, password },
        },
      },
    },
    async (request, reply) => {
      const session = await container.login.execute(request.body);
      setSessionCookie(reply, container, session.token, session.expiresAt);
      return session.account;
    },
  );

  app.post('/api/auth/logout', async (request, reply) => {
    const current = request.cookies[SESSION_COOKIE];
    if (current !== undefined) {
      await container.logout.execute({ token: current });
    }
    clearSessionCookie(reply, container);
    return reply.code(204).send();
  });

  app.get('/api/auth/me', (request) => accountOf(request));

  // --- Liens d'invitation et de réinitialisation (le jeton vient de l'URL du lien) --------------
  app.post<{ Body: { token: string } }>(
    '/api/auth/password-link/inspect',
    { config: SENSITIVE, schema: { body: { type: 'object', required: ['token'], properties: { token } } } },
    (request) => container.inspectPasswordLink.execute(request.body),
  );

  app.post<{ Body: { token: string; password: string } }>(
    '/api/auth/password-link',
    {
      config: SENSITIVE,
      schema: { body: { type: 'object', required: ['token', 'password'], properties: { token, password } } },
    },
    async (request, reply) => {
      const session = await container.redeemPasswordLink.execute(request.body);
      setSessionCookie(reply, container, session.token, session.expiresAt);
      return session.account;
    },
  );

  // --- Mon compte --------------------------------------------------------------------------------
  app.post<{ Body: { currentPassword: string; newPassword: string } }>(
    '/api/account/password',
    {
      config: SENSITIVE,
      schema: {
        body: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: { currentPassword: password, newPassword: password },
        },
      },
    },
    async (request, reply) => {
      await container.changePassword.execute({
        ...request.body,
        accountId: accountOf(request).id,
        currentTokenHash: request.sessionTokenHash ?? '',
      });
      return reply.code(204).send();
    },
  );

  app.post('/api/account/logout-everywhere', async (request, reply) => {
    await container.logoutEverywhere.execute({ accountId: accountOf(request).id });
    clearSessionCookie(reply, container);
    return reply.code(204).send();
  });

  // --- Administration (réservée aux administrateurs, vérifié par les cas d'usage) -----------------
  const role = { enum: ['admin', 'member'] } as const;

  app.get('/api/admin/accounts', (request) => container.listAccounts.execute({ actorId: accountOf(request).id }));

  app.post<{ Body: { username: string; role: Role } }>(
    '/api/admin/accounts',
    {
      schema: {
        body: { type: 'object', required: ['username', 'role'], properties: { username: { type: 'string', maxLength: 64 }, role } },
      },
    },
    async (request, reply) =>
      reply.code(201).send(await container.createAccount.execute({ ...request.body, actorId: accountOf(request).id })),
  );

  app.patch<{ Params: { id: string }; Body: { role?: Role; disabled?: boolean } }>(
    '/api/admin/accounts/:id',
    { schema: { body: { type: 'object', properties: { role, disabled: { type: 'boolean' } } } } },
    (request) =>
      container.updateAccount.execute({ ...request.body, actorId: accountOf(request).id, accountId: request.params.id }),
  );

  app.post<{ Params: { id: string } }>('/api/admin/accounts/:id/password-link', (request) =>
    container.issuePasswordReset.execute({ actorId: accountOf(request).id, accountId: request.params.id }),
  );

  app.delete<{ Params: { id: string } }>('/api/admin/accounts/:id', async (request, reply) => {
    await container.deleteAccount.execute({ actorId: accountOf(request).id, accountId: request.params.id });
    return reply.code(204).send();
  });
}
