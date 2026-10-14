import type { UseCase } from '@spamtools/shared-kernel';
import { MigrationPlan } from '../domain/index.js';
import type { MigrationJournal, MigrationSource } from './ports/index.js';

export interface MigrateDatabaseResult {
  readonly applied: string[];
}

export class MigrateDatabase implements UseCase<void, MigrateDatabaseResult> {
  constructor(
    private readonly source: MigrationSource,
    private readonly journal: MigrationJournal,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<MigrateDatabaseResult> {
    const plan = MigrationPlan.build(await this.source.list(), await this.journal.appliedVersions());
    const applied: string[] = [];

    for (const migration of plan.pending) {
      await this.source.apply(migration);
      await this.journal.record(migration.version, this.clock());
      applied.push(migration.name);
    }

    return { applied };
  }
}
