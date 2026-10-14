import type { DeckRepository } from '../application/index.js';
import type { Deck, DeckId } from '../domain/index.js';

export class InMemoryDeckRepository implements DeckRepository {
  private readonly decks = new Map<string, Deck>();

  async save(deck: Deck): Promise<void> {
    this.decks.set(deck.id.value, deck);
  }

  async findById(id: DeckId): Promise<Deck | undefined> {
    return this.decks.get(id.value);
  }

  async list(): Promise<Deck[]> {
    return [...this.decks.values()].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async delete(id: DeckId): Promise<boolean> {
    return this.decks.delete(id.value);
  }
}
