import type { CollectionRepository } from '../application/index.js';
import { Collection } from '../domain/index.js';

export class InMemoryCollectionRepository implements CollectionRepository {
  private readonly owned = new Map<string, Set<string>>();

  async load(ownerId: string): Promise<Collection> {
    return Collection.of(this.owned.get(ownerId) ?? []);
  }

  async saveChanges(ownerId: string, cardIds: readonly string[], owned: boolean): Promise<void> {
    const cards = this.owned.get(ownerId) ?? new Set<string>();
    this.owned.set(ownerId, cards);
    for (const id of cardIds) {
      if (owned) {
        cards.add(id);
      } else {
        cards.delete(id);
      }
    }
  }
}
