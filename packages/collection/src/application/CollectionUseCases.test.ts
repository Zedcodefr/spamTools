import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DomainError } from '@spamtools/shared-kernel';
import { InMemoryCollectionRepository } from '../infrastructure/InMemoryCollectionRepository.js';
import { GetCollection, SetCardsOwned } from './CollectionUseCases.js';

describe('Collection', () => {
  it('ajoute et retire des cartes, une ou plusieurs à la fois', async () => {
    const repository = new InMemoryCollectionRepository();
    const set = new SetCardsOwned(repository);

    await set.execute({ cardIds: ['b', 'a', 'c'], owned: true });
    await set.execute({ cardIds: ['a'], owned: true });
    assert.deepEqual((await set.execute({ cardIds: ['c', 'z'], owned: false })).cardIds, ['a', 'b']);
    assert.deepEqual((await new GetCollection(repository).execute()).cardIds, ['a', 'b']);
  });

  it('refuse un identifiant vide', async () => {
    await assert.rejects(new SetCardsOwned(new InMemoryCollectionRepository()).execute({ cardIds: [' '], owned: true }), DomainError);
  });
});
