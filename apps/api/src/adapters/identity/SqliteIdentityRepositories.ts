import type { SqliteDatabase } from '@spamtools/database/infrastructure';
import {
  Account,
  AccountId,
  type AccountRepository,
  type PasswordLink,
  type PasswordLinkRepository,
  type Role,
  type Session,
  type SessionRepository,
} from '@spamtools/identity';

/**
 * Adaptateurs : comptes, sessions et liens de mot de passe dans SQLite (migration 9).
 * Supprimer un compte supprime ses sessions, liens, decks et collection (ON DELETE CASCADE).
 */
export class SqliteAccountRepository implements AccountRepository {
  constructor(private readonly database: SqliteDatabase) {}

  async save(account: Account): Promise<void> {
    this.database.connection
      .prepare(
        `INSERT INTO account (id, username, role, password_hash, disabled, created_at, password_changed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET username = excluded.username, role = excluded.role,
           password_hash = excluded.password_hash, disabled = excluded.disabled,
           password_changed_at = excluded.password_changed_at`,
      )
      .run(
        account.id.value,
        account.username,
        account.role,
        account.passwordHash,
        account.disabled ? 1 : 0,
        account.createdAt.toISOString(),
        account.passwordChangedAt?.toISOString() ?? null,
      );
  }

  async findById(id: AccountId): Promise<Account | undefined> {
    return this.restore(this.database.connection.prepare('SELECT * FROM account WHERE id = ?').get(id.value));
  }

  async findByUsername(username: string): Promise<Account | undefined> {
    return this.restore(this.database.connection.prepare('SELECT * FROM account WHERE username = ?').get(username));
  }

  async list(): Promise<Account[]> {
    return this.database.connection
      .prepare('SELECT * FROM account ORDER BY username')
      .all()
      .flatMap((row) => this.restore(row) ?? []);
  }

  async delete(id: AccountId): Promise<boolean> {
    return this.database.connection.prepare('DELETE FROM account WHERE id = ?').run(id.value).changes > 0;
  }

  /** Nombre de comptes administrateurs (le premier reçoit les données d'avant les comptes). */
  countAdmins(): number {
    return Number(this.database.connection.prepare("SELECT COUNT(*) AS n FROM account WHERE role = 'admin'").get()?.['n'] ?? 0);
  }

  private restore(row: Record<string, unknown> | undefined): Account | undefined {
    if (row === undefined) {
      return undefined;
    }
    return Account.restore(new AccountId(String(row['id'])), {
      username: String(row['username']),
      role: String(row['role']) as Role,
      passwordHash: row['password_hash'] === null ? null : String(row['password_hash']),
      disabled: Number(row['disabled']) === 1,
      createdAt: new Date(String(row['created_at'])),
      passwordChangedAt: row['password_changed_at'] === null ? null : new Date(String(row['password_changed_at'])),
    });
  }
}

export class SqliteSessionRepository implements SessionRepository {
  constructor(private readonly database: SqliteDatabase) {}

  async create(session: Session): Promise<void> {
    this.database.connection
      .prepare('INSERT INTO session (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .run(session.tokenHash, session.accountId, session.createdAt.toISOString(), session.expiresAt.toISOString());
  }

  async find(tokenHash: string): Promise<Session | undefined> {
    const row = this.database.connection.prepare('SELECT * FROM session WHERE token_hash = ?').get(tokenHash);
    return row === undefined ? undefined : credential(row);
  }

  async delete(tokenHash: string): Promise<void> {
    this.database.connection.prepare('DELETE FROM session WHERE token_hash = ?').run(tokenHash);
  }

  async deleteForAccount(accountId: string, keepTokenHash?: string): Promise<void> {
    this.database.connection
      .prepare('DELETE FROM session WHERE account_id = ? AND token_hash IS NOT ?')
      .run(accountId, keepTokenHash ?? null);
  }

  /** Ménage des sessions expirées (au démarrage). */
  deleteExpired(now: Date): void {
    this.database.connection.prepare('DELETE FROM session WHERE expires_at <= ?').run(now.toISOString());
  }
}

export class SqlitePasswordLinkRepository implements PasswordLinkRepository {
  constructor(private readonly database: SqliteDatabase) {}

  async replace(link: PasswordLink): Promise<void> {
    this.database.transaction((db) => {
      db.prepare('DELETE FROM password_link WHERE account_id = ?').run(link.accountId);
      db.prepare('INSERT INTO password_link (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
        link.tokenHash,
        link.accountId,
        link.createdAt.toISOString(),
        link.expiresAt.toISOString(),
      );
    });
  }

  async find(tokenHash: string): Promise<PasswordLink | undefined> {
    const row = this.database.connection.prepare('SELECT * FROM password_link WHERE token_hash = ?').get(tokenHash);
    return row === undefined ? undefined : credential(row);
  }

  async deleteForAccount(accountId: string): Promise<void> {
    this.database.connection.prepare('DELETE FROM password_link WHERE account_id = ?').run(accountId);
  }
}

function credential(row: Record<string, unknown>): Session & PasswordLink {
  return {
    tokenHash: String(row['token_hash']),
    accountId: String(row['account_id']),
    createdAt: new Date(String(row['created_at'])),
    expiresAt: new Date(String(row['expires_at'])),
  };
}

/**
 * Données d'avant les comptes (decks et collection sans propriétaire) : données au premier
 * administrateur créé.
 */
export function claimOrphanData(database: SqliteDatabase, accountId: string): { decks: number; cards: number } {
  return database.transaction((db) => ({
    decks: Number(db.prepare('UPDATE deck SET owner_id = ? WHERE owner_id IS NULL').run(accountId).changes),
    cards: Number(db.prepare('UPDATE owned_card SET owner_id = ? WHERE owner_id IS NULL').run(accountId).changes),
  }));
}
