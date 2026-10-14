import type { CatalogRepository } from '../application/index.js';
import type { CardLayout, Catalog, CatalogVersion } from '../domain/index.js';

export class InMemoryCatalogRepository implements CatalogRepository {
  private readonly catalogs = new Map<string, Catalog>();
  private layout: CardLayout | undefined;

  async has(version: CatalogVersion, language: string): Promise<boolean> {
    return this.catalogs.has(key(version, language));
  }

  async save(catalog: Catalog): Promise<void> {
    this.catalogs.set(key(catalog.version, catalog.language), catalog);
  }

  async analysisVersion(version: CatalogVersion, language: string): Promise<number | undefined> {
    return this.catalogs.get(key(version, language))?.traits.analysisVersion;
  }

  async saveTraits(catalog: Catalog): Promise<void> {
    this.catalogs.set(key(catalog.version, catalog.language), catalog);
  }

  async listVersions(language: string): Promise<CatalogVersion[]> {
    return [...this.catalogs.values()]
      .filter((catalog) => catalog.language === language)
      .map((catalog) => catalog.version)
      .sort((a, b) => b.compareTo(a));
  }

  async find(language: string, version?: CatalogVersion): Promise<Catalog | undefined> {
    if (version !== undefined) {
      return this.catalogs.get(key(version, language));
    }
    return [...this.catalogs.values()]
      .filter((catalog) => catalog.language === language)
      .reduce<Catalog | undefined>(
        (latest, catalog) => (latest === undefined || catalog.version.compareTo(latest.version) > 0 ? catalog : latest),
        undefined,
      );
  }

  async saveLayout(layout: CardLayout): Promise<void> {
    this.layout = layout;
  }

  async findLayout(): Promise<CardLayout | undefined> {
    return this.layout;
  }
}

function key(version: CatalogVersion, language: string): string {
  return `${version.value}/${language}`;
}
