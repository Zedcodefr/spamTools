import type { UseCase } from '@spamtools/shared-kernel';
import { ImportJob, ImportSource, type ImportSourceKind } from '../domain/index.js';
import type { ImportJobRepository, RecordSink, SourceReader } from './ports/index.js';

export interface RunImportInput {
  readonly kind: ImportSourceKind;
  readonly location: string;
}

export interface RunImportOutput {
  readonly jobId: string;
  readonly status: ImportJob['status'];
  readonly importedCount: number;
  readonly rejectedCount: number;
  readonly failureReason?: string;
}

export class RunImport implements UseCase<RunImportInput, RunImportOutput> {
  constructor(
    private readonly readers: readonly SourceReader[],
    private readonly sink: RecordSink,
    private readonly jobs: ImportJobRepository,
  ) {}

  async execute(input: RunImportInput): Promise<RunImportOutput> {
    const source = ImportSource.of(input.kind, input.location);
    const job = ImportJob.create(source);
    job.start();
    await this.jobs.save(job);

    try {
      const reader = this.readers.find((candidate) => candidate.supports(source));
      if (reader === undefined) {
        throw new Error(`Aucun lecteur pour les sources de type "${source.kind}"`);
      }

      for await (const record of reader.read(source)) {
        try {
          await this.sink.write(record);
          job.recordImported();
        } catch {
          job.recordRejected();
        }
      }
      job.complete();
    } catch (error) {
      job.fail(error instanceof Error ? error.message : String(error));
    }

    await this.jobs.save(job);
    return {
      jobId: job.id.value,
      status: job.status,
      importedCount: job.importedCount,
      rejectedCount: job.rejectedCount,
      ...(job.failureReason !== undefined && { failureReason: job.failureReason }),
    };
  }
}
