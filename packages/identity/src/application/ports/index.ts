import type { Account, AccountId, PasswordLink, Session } from '../../domain/index.js';

/** Port : persistance des comptes. */
export interface AccountRepository {
  save(account: Account): Promise<void>;
  findById(id: AccountId): Promise<Account | undefined>;
  findByUsername(username: string): Promise<Account | undefined>;
  /** Par identifiant de connexion. */
  list(): Promise<Account[]>;
  /** Supprime le compte et tout ce qui lui appartient (sessions, liens, decks, collection). */
  delete(id: AccountId): Promise<boolean>;
}

/** Port : sessions ouvertes. */
export interface SessionRepository {
  create(session: Session): Promise<void>;
  find(tokenHash: string): Promise<Session | undefined>;
  delete(tokenHash: string): Promise<void>;
  /** Ferme toutes les sessions du compte, sauf éventuellement celle-ci. */
  deleteForAccount(accountId: string, keepTokenHash?: string): Promise<void>;
}

/** Port : liens de mot de passe (un seul valide par compte). */
export interface PasswordLinkRepository {
  /** Remplace le lien précédent du compte. */
  replace(link: PasswordLink): Promise<void>;
  find(tokenHash: string): Promise<PasswordLink | undefined>;
  deleteForAccount(accountId: string): Promise<void>;
}

/** Port : empreinte lente des mots de passe. */
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, passwordHash: string): Promise<boolean>;
}

/** Port : jetons secrets (sessions, liens) et leur empreinte stockée. */
export interface SecretTokens {
  generate(): string;
  hash(token: string): string;
}
