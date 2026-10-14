import type { ImportSource } from '../../domain/index.js';
import type { RawRecord } from './RawRecord.js';

/**
 * Port : lit les enregistrements bruts d'une source (fichier, API...).
 */
export interface SourceReader {
  supports(source: ImportSource): boolean;
  read(source: ImportSource): AsyncIterable<RawRecord>;
}
