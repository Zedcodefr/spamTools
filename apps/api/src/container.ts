import {
  GetCard,
  GetCardLayout,
  GetCatalogOverview,
  ListCards,
  SyncCatalog,
  type CatalogSource,
} from '@spamtools/card-catalog';
import { FileSystemAssetStore, SpamGameCatalogSource } from '@spamtools/card-catalog/infrastructure';
import { MigrateDatabase } from '@spamtools/database';
import { AnalyzeDeck, DeleteDeck, GetDeck, ListDecks, SaveDeck, SuggestDecks } from '@spamtools/deck';
import { SqlMigrationSource, SqliteDatabase, SqliteMigrationJournal } from '@spamtools/database/infrastructure';
import { SqliteCatalogRepository } from './adapters/catalog/SqliteCatalogRepository.js';
import { CatalogDeckCardStatsProvider } from './adapters/deck/CatalogDeckCardStatsProvider.js';
import { SqliteDeckRepository } from './adapters/deck/SqliteDeckRepository.js';
import type { AppConfig } from './config.js';
import { migrations } from './migrations.js';

/**
 * Racine de composition : seul endroit où les implémentations techniques
 * sont branchées sur les ports métier. Ouvre la base et applique les migrations.
 */
export interface ContainerOverrides {
  /** Remplace spamgame.com (tests). */
  readonly catalogSource?: CatalogSource;
}

export async function createContainer(config: AppConfig, overrides: ContainerOverrides = {}) {
  const database = new SqliteDatabase(config.databasePath);
  await database.open();
  await new MigrateDatabase(new SqlMigrationSource(database, migrations), new SqliteMigrationJournal(database)).execute();

  const catalogs = new SqliteCatalogRepository(database);
  const syncCatalog = new SyncCatalog(
    overrides.catalogSource ?? new SpamGameCatalogSource(),
    catalogs,
    new FileSystemAssetStore(config.assetsDirectory),
  );

  const decks = new SqliteDeckRepository(database);
  const deckCards = new CatalogDeckCardStatsProvider(catalogs);

  return {
    config,
    syncCatalog,
    listCards: new ListCards(catalogs),
    getCard: new GetCard(catalogs),
    getCatalogOverview: new GetCatalogOverview(catalogs),
    getCardLayout: new GetCardLayout(catalogs),
    saveDeck: new SaveDeck(decks, deckCards),
    listDecks: new ListDecks(decks),
    getDeck: new GetDeck(decks),
    deleteDeck: new DeleteDeck(decks),
    analyzeDeck: new AnalyzeDeck(deckCards),
    suggestDecks: new SuggestDecks(deckCards),
    close: () => database.close(),
  };
}

export type Container = Awaited<ReturnType<typeof createContainer>>;
