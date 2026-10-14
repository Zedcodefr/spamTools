import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

/**
 * Contrôle d'accès par mot de passe (HTTP Basic) : l'application n'a pas de comptes, et sans
 * protection n'importe qui pourrait modifier les decks et la collection. Le mot de passe est
 * conservé sous forme d'empreinte scrypt « scrypt:<sel>:<empreinte> » (base64url, sans « $ »
 * pour rester recopiable tel quel dans un fichier .env lu par Docker Compose).
 */
export interface AuthConfig {
  readonly user: string;
  readonly passwordHash: string;
}

const KEY_LENGTH = 32;
const REALM = 'spamTools';
/** Seule route laissée ouverte : la sonde de santé du conteneur. */
const PUBLIC_PATHS = new Set(['/api/health']);
/** Identifiants déjà vérifiés : scrypt est volontairement lent, et le navigateur les renvoie à chaque requête. */
const MAX_VERIFIED = 32;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt:${salt.toString('base64url')}:${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const [scheme, salt, expected] = passwordHash.split(':');
  if (scheme !== 'scrypt' || salt === undefined || expected === undefined) {
    throw new Error('Empreinte de mot de passe invalide (attendu : scrypt:<sel>:<empreinte>)');
  }
  const key = await derive(password, Buffer.from(salt, 'base64url'));
  const expectedKey = Buffer.from(expected, 'base64url');
  return key.length === expectedKey.length && timingSafeEqual(key, expectedKey);
}

export function registerBasicAuth(app: FastifyInstance, config: AuthConfig): void {
  const verified = new Set<string>();

  app.addHook('onRequest', async (request, reply) => {
    if (PUBLIC_PATHS.has(request.url.split('?')[0] ?? '')) {
      return;
    }
    const header = request.headers.authorization ?? '';
    if (verified.has(header) || (await isValid(header, config))) {
      if (verified.size >= MAX_VERIFIED) {
        verified.clear();
      }
      verified.add(header);
      return;
    }
    return reply
      .code(401)
      .header('WWW-Authenticate', `Basic realm="${REALM}", charset="UTF-8"`)
      .send({ error: 'Authentification requise' });
  });
}

async function isValid(header: string, config: AuthConfig): Promise<boolean> {
  const match = /^Basic\s+(\S+)$/i.exec(header);
  if (match?.[1] === undefined) {
    return false;
  }
  const decoded = Buffer.from(match[1], 'base64').toString('utf8');
  const separator = decoded.indexOf(':');
  if (separator < 0) {
    return false;
  }
  const user = Buffer.from(decoded.slice(0, separator));
  const expectedUser = Buffer.from(config.user);
  // Le mot de passe est toujours vérifié, même si l'utilisateur est faux : même durée de réponse.
  const passwordOk = await verifyPassword(decoded.slice(separator + 1), config.passwordHash);
  return user.length === expectedUser.length && timingSafeEqual(user, expectedUser) && passwordOk;
}

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFC'), salt, KEY_LENGTH, (error, key) => (error ? reject(error) : resolve(key)));
  });
}
