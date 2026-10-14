import type { ImportJobRepository } from '../application/index.js';
import type { ImportJob, ImportJobId } from '../domain/index.js';

export class InMemoryImportJobRepository implements ImportJobRepository {
  private readonly jobs = new Map<string, ImportJob>();

  async save(job: ImportJob): Promise<void> {
    this.jobs.set(job.id.value, job);
  }

  async findById(id: ImportJobId): Promise<ImportJob | undefined> {
    return this.jobs.get(id.value);
  }
}
