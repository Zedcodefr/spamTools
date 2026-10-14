import type { CollectionRepository } from '../application/index.js';
import { Collection } from '../domain/index.js';

export class InMemoryCollectionRepository implements CollectionRepository {
  private readonly owned = new Set<string>();

  async load(): Promise<Collection> {
    return Collection.of(this.owned);
  }

  async saveChanges(cardIds: readonly string[], owned: boolean): Promise<void> {
    for (const id of cardIds) {
      if (owned) {
        this.owned.add(id);
      } else {
        this.owned.delete(id);
      }
    }
  }
}
