import { createHash, randomBytes } from 'node:crypto';
import type { SecretTokens } from '../application/index.js';

/** Jetons de 256 bits aléatoires ; empreinte SHA-256 (suffisante pour un secret de cette entropie). */
export class CryptoSecretTokens implements SecretTokens {
  generate(): string {
    return randomBytes(32).toString('base64url');
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('base64url');
  }
}
