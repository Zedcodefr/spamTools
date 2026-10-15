/**
 * Session ouverte par une connexion. Le jeton n'est connu que du navigateur (cookie) : seule son
 * empreinte est conservée, une fuite de la base ne permet donc pas de se connecter.
 */
export interface Session {
  readonly tokenHash: string;
  readonly accountId: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

/** Lien à usage unique pour choisir son mot de passe (invitation) ou le réinitialiser. */
export interface PasswordLink {
  readonly tokenHash: string;
  readonly accountId: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
export const PASSWORD_LINK_DURATION_MS = 3 * 24 * 60 * 60 * 1000;

export function isExpired(credential: { readonly expiresAt: Date }, now: Date): boolean {
  return credential.expiresAt.getTime() <= now.getTime();
}
