import { DomainError } from '@spamtools/shared-kernel';
import type { MigrationVersion } from './MigrationVersion.js';

export interface MigrationDescriptor {
  readonly version: MigrationVersion;
  readonly name: string;
}

/**
 * Règles métier de l'évolution du schéma :
 * - pas deux migrations avec la même version ;
 * - une migration appliquée doit toujours exister dans le code ;
 * - les migrations en attente sont jouées dans l'ordre croissant.
 */
export class MigrationPlan {
  private constructor(readonly pending: readonly MigrationDescriptor[]) {}

  static build(available: readonly MigrationDescriptor[], applied: readonly MigrationVersion[]): MigrationPlan {
    const sorted = [...available].sort((a, b) => a.version.value - b.version.value);

    sorted.forEach((migration, index) => {
      const previous = sorted[index - 1];
      if (previous !== undefined && previous.version.equals(migration.version)) {
        throw new DomainError(`Version de migration dupliquée : ${migration.version.value}`);
      }
    });

    for (const version of applied) {
      if (!sorted.some((migration) => migration.version.equals(version))) {
        throw new DomainError(`Migration appliquée introuvable : ${version.value}`);
      }
    }

    const pending = sorted.filter((migration) => !applied.some((version) => version.equals(migration.version)));
    return new MigrationPlan(pending);
  }

  get isUpToDate(): boolean {
    return this.pending.length === 0;
  }
}
