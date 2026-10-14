import { GetCard, ListCards, SyncCatalog } from '@spamtools/card-catalog';
import { FileSystemAssetStore, SpamGameCatalogSource } from '@spamtools/card-catalog/infrastructure';
import { RunImport } from '@spamtools/data-import';
import { InMemoryImportJobRepository, JsonFileSourceReader } from '@spamtools/data-import/infrastructure';
import { MigrateDatabase } from '@spamtools/database';
import { SqlMigrationSource, SqliteDatabase, SqliteMigrationJournal } from '@spamtools/database/infrastructure';
import { InMemoryRecordSink } from './adapters/InMemoryRecordSink.js';
import { SqliteCatalogRepository } from './adapters/catalog/SqliteCatalogRepository.js';
import type { AppConfig } from './config.js';
import { migrations } from './migrations.js';

/**
 * Racine de composition : seul endroit où les implémentations techniques
 * sont branchées sur les ports métier. Ouvre la base et applique les migrations.
 */
export async function createContainer(config: AppConfig) {
  const database = new SqliteDatabase(config.databasePath);
  await database.open();
  await new MigrateDatabase(new SqlMigrationSource(database, migrations), new SqliteMigrationJournal(database)).execute();

  const catalogs = new SqliteCatalogRepository(database);
  const syncCatalog = new SyncCatalog(
    new SpamGameCatalogSource(),
    catalogs,
    new FileSystemAssetStore(config.assetsDirectory),
  );

  const runImport = new RunImport(
    [new JsonFileSourceReader()],
    new InMemoryRecordSink(),
    new InMemoryImportJobRepository(),
  );

  return {
    syncCatalog,
    listCards: new ListCards(catalogs),
    getCard: new GetCard(catalogs),
    runImport,
    close: () => database.close(),
  };
}

export type Container = Awaited<ReturnType<typeof createContainer>>;
