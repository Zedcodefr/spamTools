import type { Account, PasswordLink, Role } from '../../domain/Account.ts';

/**
 * Port : connexion et compte de l'utilisateur.
 */
export interface AuthGateway {
  /** Compte connecté, ou null sans session. */
  me(): Promise<Account | null>;
  login(username: string, password: string): Promise<Account>;
  logout(): Promise<void>;
  /** Titulaire d'un lien de mot de passe (lève une erreur si le lien est invalide ou expiré). */
  inspectPasswordLink(token: string): Promise<{ readonly username: string }>;
  /** Choisit le mot de passe avec le lien, et connecte. */
  redeemPasswordLink(token: string, password: string): Promise<Account>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  logoutEverywhere(): Promise<void>;
}

/**
 * Port : administration des comptes (réservée aux administrateurs).
 */
export interface AccountsGateway {
  list(): Promise<readonly Account[]>;
  create(username: string, role: Role): Promise<PasswordLink>;
  update(id: string, changes: { readonly role?: Role; readonly disabled?: boolean }): Promise<Account>;
  issuePasswordLink(id: string): Promise<PasswordLink>;
  delete(id: string): Promise<void>;
}
