import type { MigrationJournal } from '../application/index.js';
import { MigrationVersion } from '../domain/index.js';
import type { SqliteDatabase } from './SqliteDatabase.js';

/**
 * Historique des migrations dans la table `schema_migrations` (créée au besoin).
 */
export class SqliteMigrationJournal implements MigrationJournal {
  constructor(private readonly database: SqliteDatabase) {}

  async appliedVersions(): Promise<MigrationVersion[]> {
    this.ensureTable();
    return this.database.connection
      .prepare('SELECT version FROM schema_migrations ORDER BY version')
      .all()
      .map((row) => MigrationVersion.of(Number(row['version'])));
  }

  async record(version: MigrationVersion, appliedAt: Date): Promise<void> {
    this.ensureTable();
    this.database.connection
      .prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
      .run(version.value, appliedAt.toISOString());
  }

  private ensureTable(): void {
    this.database.connection.exec(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)',
    );
  }
}
