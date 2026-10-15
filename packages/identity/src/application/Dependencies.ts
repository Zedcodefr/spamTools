import { ForbiddenError, UnauthenticatedError } from '@spamtools/shared-kernel';
import { AccountId, PASSWORD_LINK_DURATION_MS, SESSION_DURATION_MS, type Account } from '../domain/index.js';
import { toAccountView, type IssuedPasswordLink, type OpenedSession } from './AccountView.js';
import type {
  AccountRepository,
  PasswordHasher,
  PasswordLinkRepository,
  SecretTokens,
  SessionRepository,
} from './ports/index.js';

/** Ports et horloge partagés par les cas d'usage de l'identité. */
export interface IdentityDependencies {
  readonly accounts: AccountRepository;
  readonly sessions: SessionRepository;
  readonly passwordLinks: PasswordLinkRepository;
  readonly hasher: PasswordHasher;
  readonly tokens: SecretTokens;
  readonly clock?: () => Date;
}

export const now = (deps: IdentityDependencies): Date => (deps.clock ?? (() => new Date()))();

export async function openSession(deps: IdentityDependencies, account: Account): Promise<OpenedSession> {
  const token = deps.tokens.generate();
  const createdAt = now(deps);
  const expiresAt = new Date(createdAt.getTime() + SESSION_DURATION_MS);
  await deps.sessions.create({ tokenHash: deps.tokens.hash(token), accountId: account.id.value, createdAt, expiresAt });
  return { token, expiresAt, account: toAccountView(account) };
}

export async function issuePasswordLink(deps: IdentityDependencies, account: Account): Promise<IssuedPasswordLink> {
  const token = deps.tokens.generate();
  const createdAt = now(deps);
  const expiresAt = new Date(createdAt.getTime() + PASSWORD_LINK_DURATION_MS);
  await deps.passwordLinks.replace({ tokenHash: deps.tokens.hash(token), accountId: account.id.value, createdAt, expiresAt });
  return { token, expiresAt, account: toAccountView(account) };
}

/** Le compte qui agit, actif ; administrateur si demandé. */
export async function actor(deps: IdentityDependencies, actorId: string, { admin = false } = {}): Promise<Account> {
  const account = await deps.accounts.findById(new AccountId(actorId));
  if (account === undefined || account.disabled) {
    throw new UnauthenticatedError();
  }
  if (admin && !account.isAdmin) {
    throw new ForbiddenError('Réservé aux administrateurs');
  }
  return account;
}
