import { readFile } from 'node:fs/promises';
import type { RawRecord, SourceReader } from '../application/index.js';
import type { ImportSource } from '../domain/index.js';

/**
 * Lit un fichier JSON contenant un tableau d'objets.
 */
export class JsonFileSourceReader implements SourceReader {
  supports(source: ImportSource): boolean {
    return source.kind === 'json';
  }

  async *read(source: ImportSource): AsyncIterable<RawRecord> {
    const content: unknown = JSON.parse(await readFile(source.location, 'utf8'));
    if (!Array.isArray(content)) {
      throw new Error(`Le fichier ${source.location} doit contenir un tableau JSON`);
    }
    for (const item of content) {
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        yield item as RawRecord;
      }
    }
  }
}
