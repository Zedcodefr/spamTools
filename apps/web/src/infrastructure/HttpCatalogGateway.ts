import type { CatalogGateway } from '../application/ports/CatalogGateway.ts';
import type { Card } from '../domain/Card.ts';
import type { CardLayout } from '../domain/CardLayout.ts';
import type { CatalogOverview } from '../domain/Catalog.ts';
import { apiFetch } from './apiFetch.ts';

/**
 * Adaptateur : implémente le port en appelant l'API (apps/api).
 */
export class HttpCatalogGateway implements CatalogGateway {
  private readonly baseUrl: string;

  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
  }

  getCatalog(version?: string): Promise<CatalogOverview> {
    return this.get<CatalogOverview>('/catalog', version);
  }

  async listCards(version?: string): Promise<readonly Card[]> {
    return (await this.get<{ cards: Card[] }>('/cards', version)).cards;
  }

  getCardLayout(): Promise<CardLayout> {
    return this.get<CardLayout>('/card-layout');
  }

  assetUrl(path: string): string {
    return `${this.baseUrl}/assets/${path}`;
  }

  private async get<T>(path: string, version?: string): Promise<T> {
    const query = version === undefined ? '' : `?${new URLSearchParams({ version })}`;
    const response = await apiFetch(`${this.baseUrl}${path}${query}`);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `Erreur serveur (${response.status})`);
    }
    return (await response.json()) as T;
  }
}
