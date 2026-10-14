import type { RawRecord } from './RawRecord.js';

/**
 * Port : destination des données importées. Typiquement implémenté
 * dans l'app en s'appuyant sur @spamtools/database.
 */
export interface RecordSink {
  write(record: RawRecord): Promise<void>;
}
