import type { ImportJob, ImportJobId } from '../../domain/index.js';

export interface ImportJobRepository {
  save(job: ImportJob): Promise<void>;
  findById(id: ImportJobId): Promise<ImportJob | undefined>;
}
