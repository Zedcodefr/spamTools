import { UnauthenticatedError, ForbiddenError } from '@spamtools/shared-kernel';
import type { AccountView } from '@spamtools/identity';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Container } from '../container.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Compte connecté (cookie de session valide), sinon null. */
    account: AccountView | null;
    /** Empreinte du jeton de la session en cours. */
    sessionTokenHash: string | null;
  }
}

export const SESSION_COOKIE = 'spamtools_session';

/** Routes de l'API ouvertes sans connexion ; le front compilé (pages, scripts) l'est aussi. */
const PUBLIC_API = new Set(['/api/health', '/api/auth/login', '/api/auth/password-link', '/api/auth/password-link/inspect']);
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Contrôle d'accès : la session est lue dans un cookie HttpOnly ; toute l'API (images comprises)
 * exige une connexion, sauf les routes de connexion. Les requêtes qui modifient des données doivent
 * venir du site lui-même (cookie SameSite=Strict, et vérification de l'origine).
 */
export function registerAuthentication(app: FastifyInstance, container: Container): void {
  app.decorateRequest('account', null);
  app.decorateRequest('sessionTokenHash', null);

  app.addHook('onRequest', async (request) => {
    const path = request.url.split('?')[0] ?? '';
    if (!path.startsWith('/api/')) {
      return;
    }
    if (!SAFE_METHODS.has(request.method) && !sameOrigin(request)) {
      throw new ForbiddenError('Requête refusée : elle ne vient pas de ce site');
    }
    const token = request.cookies[SESSION_COOKIE];
    if (token !== undefined && token !== '') {
      const authenticated = await container.authenticate.execute({ token });
      request.account = authenticated?.account ?? null;
      request.sessionTokenHash = authenticated?.tokenHash ?? null;
    }
    if (request.account === null && !PUBLIC_API.has(path)) {
      throw new UnauthenticatedError();
    }
  });
}

/** Compte connecté (les routes protégées sont garanties d'en avoir un). */
export function accountOf(request: FastifyRequest): AccountView {
  if (request.account === null) {
    throw new UnauthenticatedError();
  }
  return request.account;
}

export function setSessionCookie(reply: FastifyReply, container: Container, token: string, expiresAt: Date): void {
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: container.config.secureCookies ?? false,
    expires: expiresAt,
  });
}

export function clearSessionCookie(reply: FastifyReply, container: Container): void {
  reply.clearCookie(SESSION_COOKIE, { path: '/', httpOnly: true, sameSite: 'strict', secure: container.config.secureCookies ?? false });
}

/** Origine du navigateur : absente (outils, même origine sur certains navigateurs) ou égale à l'hôte servi. */
function sameOrigin(request: FastifyRequest): boolean {
  if (request.headers['sec-fetch-site'] === 'cross-site') {
    return false;
  }
  const origin = request.headers.origin;
  if (origin === undefined) {
    return true;
  }
  try {
    const url = new URL(origin);
    // Même normalisation des deux côtés (port par défaut omis).
    return url.host === new URL(`${url.protocol}//${request.headers.host ?? ''}`).host;
  } catch {
    return false;
  }
}
