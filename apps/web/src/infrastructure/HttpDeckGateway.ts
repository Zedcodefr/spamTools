import type { DeckGateway, DeckToSave } from '../application/ports/DeckGateway.ts';
import type { DeckAnalysis, DeckSlot, DeckView } from '../domain/Deck.ts';

/**
 * Adaptateur : implémente le port en appelant l'API (apps/api).
 */
export class HttpDeckGateway implements DeckGateway {
  private readonly baseUrl: string;

  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
  }

  list(): Promise<readonly DeckView[]> {
    return this.request<DeckView[]>('GET', '/decks');
  }

  save({ id, ...deck }: DeckToSave): Promise<DeckView> {
    return id === null ? this.request('POST', '/decks', deck) : this.request('PUT', `/decks/${encodeURIComponent(id)}`, deck);
  }

  async delete(id: string): Promise<void> {
    await this.request('DELETE', `/decks/${encodeURIComponent(id)}`);
  }

  analyze(version: string, slots: readonly DeckSlot[], turns: number, dpsCardId: string | null): Promise<DeckAnalysis> {
    return this.request('POST', '/decks/analysis', { version, slots, turns, dpsCardId });
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      ...(body !== undefined && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(error?.error ?? `Erreur serveur (${response.status})`);
    }
    return (response.status === 204 ? undefined : await response.json()) as T;
  }
}
