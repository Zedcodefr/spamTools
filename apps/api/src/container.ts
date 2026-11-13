import {
  GetCard,
  GetCardLayout,
  GetCatalogOverview,
  ListCards,
  SyncCatalog,
  type CatalogSource,
} from '@spamtools/card-catalog';
import { FileSystemAssetStore, SpamGameCatalogSource } from '@spamtools/card-catalog/infrastructure';
import { GetCollection, SetCardsOwned } from '@spamtools/collection';
import {
  Authenticate,
  BootstrapAdmin,
  ChangePassword,
  CreateAccount,
  DeleteAccount,
  InspectPasswordLink,
  IssuePasswordReset,
  ListAccounts,
  Login,
  Logout,
  LogoutEverywhere,
  RedeemPasswordLink,
  UpdateAccount,
  type IdentityDependencies,
} from '@spamtools/identity';
import { CryptoSecretTokens, ScryptPasswordHasher } from '@spamtools/identity/infrastructure';
import { MigrateDatabase } from '@spamtools/database';
import { AnalyzeDeck, DeleteDeck, GetDeck, ListDecks, SaveDeck, SuggestDecks } from '@spamtools/deck';
import { SqlMigrationSource, SqliteDatabase, SqliteMigrationJournal } from '@spamtools/database/infrastructure';
import { SqliteCatalogRepository } from './adapters/catalog/SqliteCatalogRepository.js';
import { SqliteCollectionRepository } from './adapters/collection/SqliteCollectionRepository.js';
import { CatalogDeckCardStatsProvider } from './adapters/deck/CatalogDeckCardStatsProvider.js';
import { SqliteDeckRepository } from './adapters/deck/SqliteDeckRepository.js';
import {
  claimOrphanData,
  SqliteAccountRepository,
  SqlitePasswordLinkRepository,
  SqliteSessionRepository,
} from './adapters/identity/SqliteIdentityRepositories.js';
import { CatalogSyncJob } from './CatalogSyncJob.js';
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

  const catalogSyncJob = new CatalogSyncJob(syncCatalog, config.language, {
    info: (message) => console.log(message),
    error: (message, error) => console.error(`${message} :`, error),
  });

  const decks = new SqliteDeckRepository(database);
  const deckCards = new CatalogDeckCardStatsProvider(catalogs);
  const collection = new SqliteCollectionRepository(database);

  const accounts = new SqliteAccountRepository(database);
  const sessions = new SqliteSessionRepository(database);
  sessions.deleteExpired(new Date());
  const identity: IdentityDependencies = {
    accounts,
    sessions,
    passwordLinks: new SqlitePasswordLinkRepository(database),
    hasher: new ScryptPasswordHasher(),
    tokens: new CryptoSecretTokens(),
  };

  return {
    config,
    syncCatalog,
    /** Synchro faite par le serveur : par un administrateur depuis le site, ou automatique. */
    catalogSyncJob,
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
    getCollection: new GetCollection(collection),
    setCardsOwned: new SetCardsOwned(collection),
    login: new Login(identity),
    authenticate: new Authenticate(identity),
    logout: new Logout(identity),
    logoutEverywhere: new LogoutEverywhere(identity),
    changePassword: new ChangePassword(identity),
    inspectPasswordLink: new InspectPasswordLink(identity),
    redeemPasswordLink: new RedeemPasswordLink(identity),
    listAccounts: new ListAccounts(identity),
    createAccount: new CreateAccount(identity),
    updateAccount: new UpdateAccount(identity),
    issuePasswordReset: new IssuePasswordReset(identity),
    deleteAccount: new DeleteAccount(identity),
    /** Ligne de commande : premier administrateur ; il reçoit les données d'avant les comptes. */
    bootstrapAdmin: async (username: string) => {
      const first = accounts.countAdmins() === 0;
      const link = await new BootstrapAdmin(identity).execute({ username });
      return { link, claimed: first ? claimOrphanData(database, link.account.id) : { decks: 0, cards: 0 } };
    },
    close: async () => {
      catalogSyncJob.unschedule();
      await catalogSyncJob.whenIdle();
      await database.close();
    },
  };
}

export type Container = Awaited<ReturnType<typeof createContainer>>;
