import type { MigrationSource } from '../application/index.js';
import { MigrationVersion, type MigrationDescriptor } from '../domain/index.js';
import type { SqliteDatabase } from './SqliteDatabase.js';

/** Migration écrite en SQL, déclarée par l'application qui possède le schéma. */
export interface SqlMigration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
}

/**
 * Migrations SQL fournies en code ; chacune est appliquée dans une transaction.
 */
export class SqlMigrationSource implements MigrationSource {
  constructor(
    private readonly database: SqliteDatabase,
    private readonly migrations: readonly SqlMigration[],
  ) {}

  async list(): Promise<MigrationDescriptor[]> {
    return this.migrations.map((migration) => ({ version: MigrationVersion.of(migration.version), name: migration.name }));
  }

  async apply(descriptor: MigrationDescriptor): Promise<void> {
    const migration = this.migrations.find((candidate) => candidate.version === descriptor.version.value);
    if (migration === undefined) {
      throw new Error(`Migration inconnue : ${descriptor.version.value}`);
    }
    this.database.transaction((connection) => connection.exec(migration.sql));
  }
}
