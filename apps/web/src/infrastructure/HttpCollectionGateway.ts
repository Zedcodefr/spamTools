import type { CollectionGateway } from '../application/ports/CollectionGateway.ts';
import { apiFetch } from './apiFetch.ts';

/**
 * Adaptateur : implémente le port en appelant l'API (apps/api).
 */
export class HttpCollectionGateway implements CollectionGateway {
  private readonly baseUrl: string;

  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
  }

  async get(): Promise<readonly string[]> {
    return (await this.request('GET', '/collection')).cardIds;
  }

  async set(cardIds: readonly string[], owned: boolean): Promise<readonly string[]> {
    return (await this.request('PUT', '/collection/cards', { cardIds, owned })).cardIds;
  }

  private async request(method: string, path: string, body?: unknown): Promise<{ cardIds: string[] }> {
    const response = await apiFetch(`${this.baseUrl}${path}`, {
      method,
      ...(body !== undefined && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(error?.error ?? `Erreur serveur (${response.status})`);
    }
    return (await response.json()) as { cardIds: string[] };
  }
}
