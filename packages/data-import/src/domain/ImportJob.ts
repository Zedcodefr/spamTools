import { AggregateRoot, DomainError } from '@spamtools/shared-kernel';
import { ImportJobId } from './ImportJobId.js';
import type { ImportSource } from './ImportSource.js';

export type ImportStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Agrégat : un import de données et son cycle de vie.
 * pending -> running -> completed | failed
 */
export class ImportJob extends AggregateRoot<ImportJobId> {
  private _status: ImportStatus = 'pending';
  private _importedCount = 0;
  private _rejectedCount = 0;
  private _failureReason: string | undefined;

  private constructor(
    id: ImportJobId,
    readonly source: ImportSource,
  ) {
    super(id);
  }

  static create(source: ImportSource, id: ImportJobId = new ImportJobId()): ImportJob {
    return new ImportJob(id, source);
  }

  get status(): ImportStatus {
    return this._status;
  }

  get importedCount(): number {
    return this._importedCount;
  }

  get rejectedCount(): number {
    return this._rejectedCount;
  }

  get failureReason(): string | undefined {
    return this._failureReason;
  }

  start(): void {
    this.assertStatus('pending', 'démarrer');
    this._status = 'running';
  }

  recordImported(): void {
    this.assertStatus('running', 'enregistrer une donnée');
    this._importedCount++;
  }

  recordRejected(): void {
    this.assertStatus('running', 'rejeter une donnée');
    this._rejectedCount++;
  }

  complete(): void {
    this.assertStatus('running', 'terminer');
    this._status = 'completed';
    this.addEvent({ name: 'ImportCompleted', occurredAt: new Date() });
  }

  fail(reason: string): void {
    this.assertStatus('running', 'mettre en échec');
    this._status = 'failed';
    this._failureReason = reason;
    this.addEvent({ name: 'ImportFailed', occurredAt: new Date() });
  }

  private assertStatus(expected: ImportStatus, action: string): void {
    if (this._status !== expected) {
      throw new DomainError(`Impossible de ${action} un import au statut "${this._status}"`);
    }
  }
}
