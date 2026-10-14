import type { CatalogSource, FetchedCatalog } from '../../application/index.js';
import type { AssetPath, CardLayout, CatalogVersion } from '../../domain/index.js';
import { InvalidSourceDataError } from './JsonReader.js';
import { parseCatalog, parseIndex, parseLayout, type SpamGameIndex } from './parseSpamGameDocuments.js';

export const SPAMGAME_DATA_URL = 'https://spamgame.com/data/';

const USER_AGENT = 'spamTools (projet fan non officiel)';
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Adaptateur : données publiques des cartes publiées sur spamgame.com/data
 * (conditions : https://spamgame.com/conditions-donnees-cartes).
 */
export class SpamGameCatalogSource implements CatalogSource {
  constructor(
    private readonly baseUrl: string = SPAMGAME_DATA_URL,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  fetchIndex(): Promise<SpamGameIndex> {
    return this.fetchText('index.json').then(parseIndex);
  }

  async fetchCatalog(version: CatalogVersion, language: string): Promise<FetchedCatalog> {
    const { cardsPathTemplate } = await this.fetchIndex();
    const path = cardsPathTemplate.replaceAll('{version}', version.value).replaceAll('{language}', language);
    const rawDocument = await this.fetchText(path);
    return { catalog: parseCatalog(rawDocument), rawDocument };
  }

  async fetchLayout(): Promise<CardLayout> {
    const { layoutPath } = await this.fetchIndex();
    return parseLayout(await this.fetchText(layoutPath));
  }

  async fetchAsset(path: AssetPath): Promise<Uint8Array> {
    return new Uint8Array(await (await this.request(path.value)).arrayBuffer());
  }

  private async fetchText(path: string): Promise<string> {
    return (await this.request(path)).text();
  }

  private async request(path: string): Promise<Response> {
    const url = new URL(path, this.baseUrl);
    // Les chemins viennent de l'index distant : on refuse toute sortie du dossier de données.
    if (!url.href.startsWith(new URL(this.baseUrl).href)) {
      throw new InvalidSourceDataError(`Chemin hors du dossier de données : "${path}"`);
    }
    const response = await this.fetchImpl(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`${url.href} : HTTP ${response.status}`);
    }
    return response;
  }
}
