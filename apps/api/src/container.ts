import { RunImport } from '@spamtools/data-import';
import { InMemoryImportJobRepository, JsonFileSourceReader } from '@spamtools/data-import/infrastructure';
import { InMemoryRecordSink } from './adapters/InMemoryRecordSink.js';

/**
 * Racine de composition : seul endroit où les implémentations techniques
 * sont branchées sur les ports métier.
 */
export function createContainer() {
  const runImport = new RunImport(
    [new JsonFileSourceReader()],
    new InMemoryRecordSink(),
    new InMemoryImportJobRepository(),
  );

  return { runImport };
}

export type Container = ReturnType<typeof createContainer>;
