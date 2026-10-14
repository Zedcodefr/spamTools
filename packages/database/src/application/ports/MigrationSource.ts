import type { MigrationDescriptor } from '../../domain/index.js';

/**
 * Port : fournit les migrations disponibles et sait en appliquer une.
 */
export interface MigrationSource {
  list(): Promise<MigrationDescriptor[]>;
  apply(migration: MigrationDescriptor): Promise<void>;
}
