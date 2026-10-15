import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import type { Container } from '../container.js';
import { SESSION_COOKIE } from '../http/authentication.js';

export type Inject = (options: InjectOptions) => Promise<LightMyRequestResponse>;

/** Ouvre une session par le lien d'invitation et renvoie un `inject` qui porte son cookie. */
export async function signInAs(app: FastifyInstance, invitationToken: string, password = 'mot de passe de test'): Promise<Inject> {
  const response = await app.inject({ method: 'POST', url: '/api/auth/password-link', payload: { token: invitationToken, password } });
  const session = response.cookies.find((cookie) => cookie.name === SESSION_COOKIE)?.value;
  if (response.statusCode !== 200 || session === undefined) {
    throw new Error(`Connexion impossible (${response.statusCode}) : ${response.body}`);
  }
  return (options) => app.inject({ ...options, cookies: { ...options.cookies, [SESSION_COOKIE]: session } });
}

/** Premier administrateur, connecté. */
export async function signInAdmin(app: FastifyInstance, container: Container, username = 'zed') {
  const { link } = await container.bootstrapAdmin(username);
  return { inject: await signInAs(app, link.token), account: link.account };
}
