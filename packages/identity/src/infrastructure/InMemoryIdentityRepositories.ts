import type { AccountRepository, PasswordLinkRepository, SessionRepository } from '../application/index.js';
import { Account, type AccountId, type PasswordLink, type Session } from '../domain/index.js';

export class InMemoryAccountRepository implements AccountRepository {
  private readonly accounts = new Map<string, Account>();

  constructor(private readonly onDelete: (accountId: string) => void = () => undefined) {}

  async save(account: Account): Promise<void> {
    this.accounts.set(account.id.value, Account.restore(account.id, { ...snapshot(account) }));
  }

  async findById(id: AccountId): Promise<Account | undefined> {
    const account = this.accounts.get(id.value);
    return account === undefined ? undefined : Account.restore(account.id, snapshot(account));
  }

  async findByUsername(username: string): Promise<Account | undefined> {
    const account = [...this.accounts.values()].find((candidate) => candidate.username === username);
    return account === undefined ? undefined : this.findById(account.id);
  }

  async list(): Promise<Account[]> {
    return [...this.accounts.values()].sort((a, b) => a.username.localeCompare(b.username));
  }

  async delete(id: AccountId): Promise<boolean> {
    this.onDelete(id.value);
    return this.accounts.delete(id.value);
  }
}

function snapshot(account: Account) {
  return {
    username: account.username,
    role: account.role,
    passwordHash: account.passwordHash,
    disabled: account.disabled,
    createdAt: account.createdAt,
    passwordChangedAt: account.passwordChangedAt,
  };
}

export class InMemorySessionRepository implements SessionRepository {
  readonly sessions = new Map<string, Session>();

  async create(session: Session): Promise<void> {
    this.sessions.set(session.tokenHash, session);
  }

  async find(tokenHash: string): Promise<Session | undefined> {
    return this.sessions.get(tokenHash);
  }

  async delete(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }

  async deleteForAccount(accountId: string, keepTokenHash?: string): Promise<void> {
    for (const [hash, session] of this.sessions) {
      if (session.accountId === accountId && hash !== keepTokenHash) {
        this.sessions.delete(hash);
      }
    }
  }
}

export class InMemoryPasswordLinkRepository implements PasswordLinkRepository {
  readonly links = new Map<string, PasswordLink>();

  async replace(link: PasswordLink): Promise<void> {
    await this.deleteForAccount(link.accountId);
    this.links.set(link.tokenHash, link);
  }

  async find(tokenHash: string): Promise<PasswordLink | undefined> {
    return this.links.get(tokenHash);
  }

  async deleteForAccount(accountId: string): Promise<void> {
    for (const [hash, link] of this.links) {
      if (link.accountId === accountId) {
        this.links.delete(hash);
      }
    }
  }
}
