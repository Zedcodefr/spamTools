import type { UseCase } from '@spamtools/shared-kernel';
import type { CollectionRepository } from './ports/index.js';

export interface CollectionView {
  readonly cardIds: readonly string[];
}

export class GetCollection implements UseCase<void, CollectionView> {
  constructor(private readonly repository: CollectionRepository) {}

  async execute(): Promise<CollectionView> {
    return { cardIds: (await this.repository.load()).cardIds };
  }
}

export interface SetCardsOwnedInput {
  readonly cardIds: readonly string[];
  readonly owned: boolean;
}

/** Ajoute des cartes à la collection ou les en retire (une carte, ou plusieurs d'un coup). */
export class SetCardsOwned implements UseCase<SetCardsOwnedInput, CollectionView> {
  constructor(private readonly repository: CollectionRepository) {}

  async execute(input: SetCardsOwnedInput): Promise<CollectionView> {
    const collection = await this.repository.load();
    const changed = collection.set(input.cardIds, input.owned);
    if (changed.length > 0) {
      await this.repository.saveChanges(changed, input.owned);
    }
    return { cardIds: collection.cardIds };
  }
}
