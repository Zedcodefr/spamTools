import type { CardLayout, Catalog, CatalogVersion } from '../../domain/index.js';

/**
 * Port : persistance des catalogues. Chaque version est conservée.
 */
export interface CatalogRepository {
  has(version: CatalogVersion, language: string): Promise<boolean>;
  save(catalog: Catalog, rawDocument: string): Promise<void>;
  /** Sans version : le catalogue le plus récent dans cette langue. */
  find(language: string, version?: CatalogVersion): Promise<Catalog | undefined>;
  saveLayout(layout: CardLayout): Promise<void>;
  findLayout(): Promise<CardLayout | undefined>;
}
