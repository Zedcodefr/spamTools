import { DomainError, type UseCase } from '@spamtools/shared-kernel';
import { ANALYSIS_VERSION, CatalogVersion, type AssetPath, type Catalog } from '../domain/index.js';
import { forEachConcurrently } from './forEachConcurrently.js';
import type { AssetStore, CatalogRepository, CatalogSource } from './ports/index.js';

const ASSET_DOWNLOAD_CONCURRENCY = 6;

export interface SyncCatalogInput {
  readonly language: string;
  /** Par défaut : la dernière version publiée. */
  readonly version?: string | undefined;
}

export interface AssetFailure {
  readonly path: string;
  readonly reason: string;
}

export interface AssetSyncReport {
  readonly downloaded: number;
  readonly alreadyPresent: number;
  /** Images référencées par les données mais non récupérées. */
  readonly failures: readonly AssetFailure[];
  /**
   * Variantes du cadre que la source ne publie pas : le plan de carte décline certaines
   * images pour chaque élément ou rareté (ex. `skill-line-{rarity}`), sans que toutes existent.
   */
  readonly unavailableFrameVariants: readonly AssetFailure[];
}

export interface SyncCatalogOutput {
  readonly version: string;
  readonly language: string;
  /**
   * `unchanged` : cette version était déjà en base (les images manquantes sont tout de même récupérées) ;
   * `reanalyzed` : déjà en base, mais ses caractéristiques ont été recalculées (règles d'analyse modifiées).
   */
  readonly status: 'imported' | 'unchanged' | 'reanalyzed';
  readonly cardCount: number;
  readonly assets: AssetSyncReport;
}

/**
 * Importe une version du catalogue depuis la source officielle, avec ses images.
 * Idempotent : relancer la synchro ne réimporte pas une version déjà présente
 * et ne télécharge que les images manquantes.
 */
export class SyncCatalog implements UseCase<SyncCatalogInput, SyncCatalogOutput> {
  constructor(
    private readonly source: CatalogSource,
    private readonly repository: CatalogRepository,
    private readonly assets: AssetStore,
  ) {}

  async execute(input: SyncCatalogInput): Promise<SyncCatalogOutput> {
    const index = await this.source.fetchIndex();
    if (!index.languages.includes(input.language)) {
      throw new DomainError(`Langue non publiée : "${input.language}" (disponibles : ${index.languages.join(', ')})`);
    }
    const version = input.version === undefined ? index.latest : CatalogVersion.of(input.version);
    if (!index.versions.some((published) => published.equals(version))) {
      throw new DomainError(`Version non publiée : "${version.value}"`);
    }

    const { catalog, rawDocument } = await this.source.fetchCatalog(version, input.language);
    if (!catalog.version.equals(version) || catalog.language !== input.language) {
      throw new DomainError(
        `La source a renvoyé ${catalog.version.value}/${catalog.language} au lieu de ${version.value}/${input.language}`,
      );
    }
    const layout = await this.source.fetchLayout();

    // Images d'abord : un catalogue enregistré ne doit pas référencer d'images absentes
    // (hors celles que la source n'a pas pu fournir, signalées dans le rapport).
    const assets = await this.syncAssets(catalog.assetPaths(), layout.assetPaths(catalog));

    // Les caractéristiques des cartes sont calculées ici, une fois, puis enregistrées.
    const status = await this.store(catalog, rawDocument);
    await this.repository.saveLayout(layout);

    return {
      version: version.value,
      language: input.language,
      status,
      cardCount: catalog.cards.length,
      assets,
    };
  }

  private async store(catalog: Catalog, rawDocument: string): Promise<SyncCatalogOutput['status']> {
    if (!(await this.repository.has(catalog.version, catalog.language))) {
      await this.repository.save(catalog, rawDocument);
      return 'imported';
    }
    if ((await this.repository.analysisVersion(catalog.version, catalog.language)) !== ANALYSIS_VERSION) {
      await this.repository.saveTraits(catalog);
      return 'reanalyzed';
    }
    return 'unchanged';
  }

  private async syncAssets(
    required: readonly AssetPath[],
    frameVariants: readonly AssetPath[],
  ): Promise<AssetSyncReport> {
    const requiredPaths = new Set(required.map((path) => path.value));
    const unique = [...new Map([...required, ...frameVariants].map((path) => [path.value, path])).values()];
    let downloaded = 0;
    let alreadyPresent = 0;
    const failures: AssetFailure[] = [];
    const unavailableFrameVariants: AssetFailure[] = [];

    await forEachConcurrently(unique, ASSET_DOWNLOAD_CONCURRENCY, async (path) => {
      if (await this.assets.has(path)) {
        alreadyPresent++;
        return;
      }
      try {
        await this.assets.put(path, await this.source.fetchAsset(path));
        downloaded++;
      } catch (error) {
        const failure = { path: path.value, reason: error instanceof Error ? error.message : String(error) };
        (requiredPaths.has(path.value) ? failures : unavailableFrameVariants).push(failure);
      }
    });

    const byPath = (a: AssetFailure, b: AssetFailure) => a.path.localeCompare(b.path);
    return {
      downloaded,
      alreadyPresent,
      failures: failures.sort(byPath),
      unavailableFrameVariants: unavailableFrameVariants.sort(byPath),
    };
  }
}
