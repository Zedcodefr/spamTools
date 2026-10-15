import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DomainError } from '@spamtools/shared-kernel';
import { InMemoryCollectionRepository } from '../infrastructure/InMemoryCollectionRepository.js';
import { GetCollection, SetCardsOwned } from './CollectionUseCases.js';

describe('Collection', () => {
  it('ajoute et retire des cartes, une ou plusieurs à la fois', async () => {
    const repository = new InMemoryCollectionRepository();
    const set = new SetCardsOwned(repository);

    await set.execute({ ownerId: 'zed', cardIds: ['b', 'a', 'c'], owned: true });
    await set.execute({ ownerId: 'zed', cardIds: ['a'], owned: true });
    assert.deepEqual((await set.execute({ ownerId: 'zed', cardIds: ['c', 'z'], owned: false })).cardIds, ['a', 'b']);
    assert.deepEqual((await new GetCollection(repository).execute({ ownerId: 'zed' })).cardIds, ['a', 'b']);
  });

  it('donne à chaque compte sa propre collection', async () => {
    const repository = new InMemoryCollectionRepository();
    await new SetCardsOwned(repository).execute({ ownerId: 'zed', cardIds: ['a'], owned: true });
    await new SetCardsOwned(repository).execute({ ownerId: 'alice', cardIds: ['b'], owned: true });
    assert.deepEqual((await new GetCollection(repository).execute({ ownerId: 'alice' })).cardIds, ['b']);
  });

  it('refuse un identifiant vide', async () => {
    await assert.rejects(new SetCardsOwned(new InMemoryCollectionRepository()).execute({ ownerId: 'zed', cardIds: [' '], owned: true }), DomainError);
  });
});
