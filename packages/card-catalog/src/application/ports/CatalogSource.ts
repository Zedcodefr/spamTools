import type { AssetPath, CardLayout, Catalog, CatalogVersion } from '../../domain/index.js';

/** Ce que la source publie : versions disponibles et langues. */
export interface CatalogIndex {
  readonly latest: CatalogVersion;
  readonly versions: readonly CatalogVersion[];
  readonly languages: readonly string[];
}

export interface FetchedCatalog {
  readonly catalog: Catalog;
  /** Document tel que reçu, conservé pour pouvoir rejouer un import ou comparer des versions. */
  readonly rawDocument: string;
}

/**
 * Port : source officielle des données de cartes (spamgame.com).
 */
export interface CatalogSource {
  fetchIndex(): Promise<CatalogIndex>;
  fetchCatalog(version: CatalogVersion, language: string): Promise<FetchedCatalog>;
  fetchLayout(): Promise<CardLayout>;
  fetchAsset(path: AssetPath): Promise<Uint8Array>;
}
