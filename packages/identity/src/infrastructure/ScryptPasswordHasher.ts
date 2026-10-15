import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { PasswordHasher } from '../application/index.js';

const KEY_LENGTH = 32;

/**
 * Empreinte scrypt (node:crypto) : « scrypt:<sel>:<empreinte> », en base64url.
 */
export class ScryptPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await derive(password, salt);
    return `scrypt:${salt.toString('base64url')}:${key.toString('base64url')}`;
  }

  async verify(password: string, passwordHash: string): Promise<boolean> {
    const [scheme, salt, expected] = passwordHash.split(':');
    if (scheme !== 'scrypt' || salt === undefined || expected === undefined) {
      throw new Error('Empreinte de mot de passe invalide (attendu : scrypt:<sel>:<empreinte>)');
    }
    const key = await derive(password, Buffer.from(salt, 'base64url'));
    const expectedKey = Buffer.from(expected, 'base64url');
    return key.length === expectedKey.length && timingSafeEqual(key, expectedKey);
  }
}

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFC'), salt, KEY_LENGTH, (error, key) => (error ? reject(error) : resolve(key)));
  });
}
