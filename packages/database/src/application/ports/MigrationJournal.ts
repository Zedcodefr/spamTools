import type { MigrationVersion } from '../../domain/index.js';

/**
 * Port : historique des migrations déjà appliquées.
 */
export interface MigrationJournal {
  appliedVersions(): Promise<MigrationVersion[]>;
  record(version: MigrationVersion, appliedAt: Date): Promise<void>;
}
