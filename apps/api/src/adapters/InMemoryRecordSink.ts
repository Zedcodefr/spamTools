import type { RawRecord, RecordSink } from '@spamtools/data-import';

/**
 * Destination provisoire des imports, à remplacer par un adaptateur
 * s'appuyant sur @spamtools/database une fois les modèles définis.
 */
export class InMemoryRecordSink implements RecordSink {
  readonly records: RawRecord[] = [];

  async write(record: RawRecord): Promise<void> {
    this.records.push(record);
  }
}
