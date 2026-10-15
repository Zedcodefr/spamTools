import type { Account, Role } from '../domain/index.js';

/** Un compte tel que servi (jamais son empreinte de mot de passe). */
export interface AccountView {
  readonly id: string;
  readonly username: string;
  readonly role: Role;
  readonly disabled: boolean;
  /** false tant que le titulaire n'a pas choisi son mot de passe (lien d'invitation non utilisé). */
  readonly hasPassword: boolean;
  readonly createdAt: string;
}

export function toAccountView(account: Account): AccountView {
  return {
    id: account.id.value,
    username: account.username,
    role: account.role,
    disabled: account.disabled,
    hasPassword: account.passwordHash !== null,
    createdAt: account.createdAt.toISOString(),
  };
}

/** Session ouverte : le jeton est à remettre au navigateur (cookie), une seule fois. */
export interface OpenedSession {
  readonly token: string;
  readonly expiresAt: Date;
  readonly account: AccountView;
}

/** Lien de mot de passe créé : le jeton n'est montré qu'une fois, à l'administrateur. */
export interface IssuedPasswordLink {
  readonly token: string;
  readonly expiresAt: Date;
  readonly account: AccountView;
}
