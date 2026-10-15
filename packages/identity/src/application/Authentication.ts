import { UnauthenticatedError, type UseCase } from '@spamtools/shared-kernel';
import { AccountId, isExpired, normalizeUsername } from '../domain/index.js';
import { toAccountView, type AccountView, type OpenedSession } from './AccountView.js';
import { now, openSession, type IdentityDependencies } from './Dependencies.js';

const INVALID_CREDENTIALS = 'Identifiant ou mot de passe incorrect';

export interface LoginInput {
  readonly username: string;
  readonly password: string;
}

/**
 * Connexion par identifiant et mot de passe. Le message d'échec ne dit pas si l'identifiant existe,
 * et un compte inconnu coûte le même calcul qu'un mot de passe faux.
 */
export class Login implements UseCase<LoginInput, OpenedSession> {
  private decoy: Promise<string> | undefined;

  constructor(private readonly deps: IdentityDependencies) {}

  async execute({ username, password }: LoginInput): Promise<OpenedSession> {
    let account;
    try {
      account = await this.deps.accounts.findByUsername(normalizeUsername(username));
    } catch {
      account = undefined;
    }
    const hash = account?.passwordHash ?? (await (this.decoy ??= this.deps.hasher.hash('mot de passe leurre')));
    const valid = await this.deps.hasher.verify(password, hash);
    if (account === undefined || !account.canSignIn || !valid) {
      throw new UnauthenticatedError(INVALID_CREDENTIALS);
    }
    return openSession(this.deps, account);
  }
}

export interface AuthenticatedAccount {
  readonly account: AccountView;
  readonly tokenHash: string;
}

/** Compte d'une session : null si la session est inconnue, expirée, ou le compte désactivé. */
export class Authenticate implements UseCase<{ readonly token: string }, AuthenticatedAccount | null> {
  constructor(private readonly deps: IdentityDependencies) {}

  async execute({ token }: { readonly token: string }): Promise<AuthenticatedAccount | null> {
    const tokenHash = this.deps.tokens.hash(token);
    const session = await this.deps.sessions.find(tokenHash);
    if (session === undefined) {
      return null;
    }
    if (isExpired(session, now(this.deps))) {
      await this.deps.sessions.delete(tokenHash);
      return null;
    }
    const account = await this.deps.accounts.findById(new AccountId(session.accountId));
    if (account === undefined || !account.canSignIn) {
      return null;
    }
    return { account: toAccountView(account), tokenHash };
  }
}

/** Déconnexion de cette session. */
export class Logout implements UseCase<{ readonly token: string }, void> {
  constructor(private readonly deps: IdentityDependencies) {}

  async execute({ token }: { readonly token: string }): Promise<void> {
    await this.deps.sessions.delete(this.deps.tokens.hash(token));
  }
}
