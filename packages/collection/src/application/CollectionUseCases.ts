import type { UseCase } from '@spamtools/shared-kernel';
import type { CollectionRepository } from './ports/index.js';

export interface CollectionView {
  readonly cardIds: readonly string[];
}

/** Collection d'un compte : chacun a la sienne. */
export class GetCollection implements UseCase<{ readonly ownerId: string }, CollectionView> {
  constructor(private readonly repository: CollectionRepository) {}

  async execute({ ownerId }: { readonly ownerId: string }): Promise<CollectionView> {
    return { cardIds: (await this.repository.load(ownerId)).cardIds };
  }
}

export interface SetCardsOwnedInput {
  readonly ownerId: string;
  readonly cardIds: readonly string[];
  readonly owned: boolean;
}

/** Ajoute des cartes à la collection ou les en retire (une carte, ou plusieurs d'un coup). */
export class SetCardsOwned implements UseCase<SetCardsOwnedInput, CollectionView> {
  constructor(private readonly repository: CollectionRepository) {}

  async execute(input: SetCardsOwnedInput): Promise<CollectionView> {
    const collection = await this.repository.load(input.ownerId);
    const changed = collection.set(input.cardIds, input.owned);
    if (changed.length > 0) {
      await this.repository.saveChanges(input.ownerId, changed, input.owned);
    }
    return { cardIds: collection.cardIds };
  }
}
