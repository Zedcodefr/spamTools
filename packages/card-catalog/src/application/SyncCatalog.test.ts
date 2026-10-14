import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { DomainError } from '@spamtools/shared-kernel';
import type { AssetPath, CardLayout, CatalogVersion } from '../domain/index.js';
import { InMemoryCatalogRepository } from '../infrastructure/InMemoryCatalogRepository.js';
import { parseCatalog, parseIndex, parseLayout } from '../infrastructure/spamgame/parseSpamGameDocuments.js';
import { cardsDocument, indexDocument, layoutDocument } from '../test-support/spamGameFixtures.js';
import { GetCard } from './GetCard.js';
import { GetCardLayout } from './GetCardLayout.js';
import { GetCatalogOverview } from './GetCatalogOverview.js';
import { ListCards } from './ListCards.js';
import { NotFoundError } from './errors.js';
import type { AssetStore, CatalogIndex, CatalogSource, FetchedCatalog } from './ports/index.js';
import { SyncCatalog } from './SyncCatalog.js';

class FakeSource implements CatalogSource {
  readonly missingAssets = new Set<string>();
  readonly fetchedAssets: string[] = [];

  async fetchIndex(): Promise<CatalogIndex> {
    return parseIndex(JSON.stringify(indexDocument()));
  }

  async fetchCatalog(version: CatalogVersion, language: string): Promise<FetchedCatalog> {
    const rawDocument = JSON.stringify(cardsDocument({ version: version.value, language }));
    return { catalog: parseCatalog(rawDocument), rawDocument };
  }

  async fetchLayout(): Promise<CardLayout> {
    return parseLayout(JSON.stringify(layoutDocument()));
  }

  async fetchAsset(path: AssetPath): Promise<Uint8Array> {
    if (this.missingAssets.has(path.value)) {
      throw new Error('HTTP 404');
    }
    this.fetchedAssets.push(path.value);
    return new Uint8Array([1]);
  }
}

class FakeAssetStore implements AssetStore {
  readonly stored = new Set<string>();

  async has(path: AssetPath): Promise<boolean> {
    return this.stored.has(path.value);
  }

  async put(path: AssetPath): Promise<void> {
    this.stored.add(path.value);
  }
}

describe('SyncCatalog', () => {
  let source: FakeSource;
  let repository: InMemoryCatalogRepository;
  let assets: FakeAssetStore;
  let sync: SyncCatalog;

  beforeEach(() => {
    source = new FakeSource();
    repository = new InMemoryCatalogRepository();
    assets = new FakeAssetStore();
    sync = new SyncCatalog(source, repository, assets);
  });

  it('importe la dernière version avec ses images et le plan de carte', async () => {
    const result = await sync.execute({ language: 'fr' });

    assert.equal(result.status, 'imported');
    assert.equal(result.version, '1.21');
    assert.equal(result.cardCount, 2);
    assert.deepEqual(result.assets.failures, []);
    assert.equal(result.assets.downloaded, assets.stored.size);
    assert.ok(assets.stored.has('img/illustrations/1024/esprit_feu.webp'));
    assert.ok(assets.stored.has('img/frame/body-water.webp'));
    assert.ok(await repository.findLayout());
    assert.equal(new Set(source.fetchedAssets).size, source.fetchedAssets.length, 'chaque image une seule fois');
  });

  it('ne réimporte pas une version présente et ne retélécharge que les images manquantes', async () => {
    await sync.execute({ language: 'fr' });
    assets.stored.delete('img/elements/fire.webp');
    source.fetchedAssets.length = 0;

    const result = await sync.execute({ language: 'fr' });

    assert.equal(result.status, 'unchanged');
    assert.deepEqual(source.fetchedAssets, ['img/elements/fire.webp']);
    assert.equal(result.assets.alreadyPresent, assets.stored.size - 1);
  });

  it("signale les images indisponibles sans bloquer l'import", async () => {
    source.missingAssets.add('img/frame/rarity-divine.webp');

    const result = await sync.execute({ language: 'fr' });

    assert.equal(result.status, 'imported');
    assert.deepEqual(result.assets.failures, [{ path: 'img/frame/rarity-divine.webp', reason: 'HTTP 404' }]);
    assert.deepEqual(result.assets.unavailableFrameVariants, []);
  });

  it('distingue une variante de cadre non publiée d\'une image manquante', async () => {
    source.missingAssets.add('img/frame/body-water.webp');

    const result = await sync.execute({ language: 'fr' });

    assert.deepEqual(result.assets.failures, []);
    assert.deepEqual(result.assets.unavailableFrameVariants, [{ path: 'img/frame/body-water.webp', reason: 'HTTP 404' }]);
  });

  it('conserve chaque version importée', async () => {
    await sync.execute({ language: 'fr', version: '1.20' });
    await sync.execute({ language: 'fr' });

    const listCards = new ListCards(repository);
    assert.equal((await listCards.execute({ language: 'fr' })).version, '1.21');
    assert.equal((await listCards.execute({ language: 'fr', version: '1.20' })).version, '1.20');
  });

  it('refuse une version ou une langue non publiée', async () => {
    await assert.rejects(sync.execute({ language: 'fr', version: '1.5' }), DomainError);
    await assert.rejects(sync.execute({ language: 'ja' }), /Langue non publiée/);
  });
});

describe('ListCards / GetCard', () => {
  it('signale un catalogue ou une carte absents', async () => {
    const repository = new InMemoryCatalogRepository();
    await assert.rejects(new ListCards(repository).execute({ language: 'fr' }), NotFoundError);

    await new SyncCatalog(new FakeSource(), repository, new FakeAssetStore()).execute({ language: 'fr' });
    const found = await new GetCard(repository).execute({ language: 'fr', id: '6428d28c-4897-46e4-bcc5-5165484fda2b' });
    assert.equal(found.card.name, 'Hibernatus');
    await assert.rejects(new GetCard(repository).execute({ language: 'fr', id: 'inconnue' }), NotFoundError);
  });

  it('filtre les cartes', async () => {
    const repository = new InMemoryCatalogRepository();
    await new SyncCatalog(new FakeSource(), repository, new FakeAssetStore()).execute({ language: 'fr' });
    const { cards } = await new ListCards(repository).execute({ language: 'fr', element: 'fire' });
    assert.deepEqual(cards.map((card) => card.name), ['Esprit Feu']);
  });
});

describe('GetCatalogOverview / GetCardLayout', () => {
  it('décrit la version demandée et liste les versions importées', async () => {
    const repository = new InMemoryCatalogRepository();
    const sync = new SyncCatalog(new FakeSource(), repository, new FakeAssetStore());
    await sync.execute({ language: 'fr', version: '1.20' });
    await sync.execute({ language: 'fr' });

    const overview = await new GetCatalogOverview(repository).execute({ language: 'fr' });

    assert.equal(overview.version, '1.21');
    assert.deepEqual(overview.availableVersions, ['1.21', '1.20']);
    assert.equal(overview.cardCount, 2);
    assert.deepEqual(overview.elements.map((element) => element.id), ['fire', 'water']);
    assert.equal((await new GetCatalogOverview(repository).execute({ language: 'fr', version: '1.20' })).version, '1.20');
    assert.equal((await new GetCardLayout(repository).execute())['width'], 961);
  });

  it('signale un catalogue ou un plan absents', async () => {
    const repository = new InMemoryCatalogRepository();
    await assert.rejects(new GetCatalogOverview(repository).execute({ language: 'fr' }), NotFoundError);
    await assert.rejects(new GetCardLayout(repository).execute(), NotFoundError);
  });
});
