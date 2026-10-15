import { DomainError, NotFoundError, UnauthenticatedError, type UseCase } from '@spamtools/shared-kernel';
import { AccountId, isExpired, validatePassword } from '../domain/index.js';
import type { OpenedSession } from './AccountView.js';
import { actor, now, openSession, type IdentityDependencies } from './Dependencies.js';

export interface ChangePasswordInput {
  readonly accountId: string;
  readonly currentPassword: string;
  readonly newPassword: string;
  /** Session en cours, gardée ouverte ; les autres sont fermées. */
  readonly currentTokenHash: string;
}

export class ChangePassword implements UseCase<ChangePasswordInput, void> {
  constructor(private readonly deps: IdentityDependencies) {}

  async execute(input: ChangePasswordInput): Promise<void> {
    const account = await actor(this.deps, input.accountId);
    const hash = account.passwordHash;
    if (hash === null || !(await this.deps.hasher.verify(input.currentPassword, hash))) {
      throw new DomainError('Mot de passe actuel incorrect');
    }
    validatePassword(input.newPassword);
    account.changePassword(await this.deps.hasher.hash(input.newPassword), now(this.deps));
    await this.deps.accounts.save(account);
    await this.deps.sessions.deleteForAccount(account.id.value, input.currentTokenHash);
  }
}

/** Déconnexion de tous les appareils (session en cours comprise). */
export class LogoutEverywhere implements UseCase<{ readonly accountId: string }, void> {
  constructor(private readonly deps: IdentityDependencies) {}

  async execute({ accountId }: { readonly accountId: string }): Promise<void> {
    await this.deps.sessions.deleteForAccount(accountId);
  }
}

async function validLink(deps: IdentityDependencies, token: string) {
  const tokenHash = deps.tokens.hash(token);
  const link = await deps.passwordLinks.find(tokenHash);
  const account = link === undefined ? undefined : await deps.accounts.findById(new AccountId(link.accountId));
  if (link === undefined || isExpired(link, now(deps)) || account === undefined || account.disabled) {
    throw new NotFoundError('Lien invalide ou expiré : demandez-en un nouveau à un administrateur');
  }
  return account;
}

/** À qui appartient un lien de mot de passe (pour l'afficher avant de le choisir). */
export class InspectPasswordLink implements UseCase<{ readonly token: string }, { readonly username: string }> {
  constructor(private readonly deps: IdentityDependencies) {}

  async execute({ token }: { readonly token: string }): Promise<{ readonly username: string }> {
    return { username: (await validLink(this.deps, token)).username };
  }
}

export interface RedeemPasswordLinkInput {
  readonly token: string;
  readonly password: string;
}

/**
 * Choix du mot de passe avec un lien d'invitation ou de réinitialisation : le lien ne sert qu'une
 * fois, les autres sessions du compte sont fermées, et une nouvelle est ouverte.
 */
export class RedeemPasswordLink implements UseCase<RedeemPasswordLinkInput, OpenedSession> {
  constructor(private readonly deps: IdentityDependencies) {}

  async execute({ token, password }: RedeemPasswordLinkInput): Promise<OpenedSession> {
    const account = await validLink(this.deps, token).catch((error: unknown) => {
      throw error instanceof NotFoundError ? new UnauthenticatedError(error.message) : error;
    });
    validatePassword(password);
    account.changePassword(await this.deps.hasher.hash(password), now(this.deps));
    await this.deps.accounts.save(account);
    await this.deps.passwordLinks.deleteForAccount(account.id.value);
    await this.deps.sessions.deleteForAccount(account.id.value);
    return openSession(this.deps, account);
  }
}
