import type { MigrationJournal } from '../application/index.js';
import type { MigrationVersion } from '../domain/index.js';

/**
 * Adaptateur en mémoire (tests / dev) en attendant le choix du driver BDD.
 */
export class InMemoryMigrationJournal implements MigrationJournal {
  private readonly versions: MigrationVersion[] = [];

  async appliedVersions(): Promise<MigrationVersion[]> {
    return [...this.versions];
  }

  async record(version: MigrationVersion): Promise<void> {
    this.versions.push(version);
  }
}
