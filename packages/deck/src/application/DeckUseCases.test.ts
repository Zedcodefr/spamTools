import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotFoundError } from '@spamtools/shared-kernel';
import type { DeckCardStats, DeckSlot, StatContribution } from '../domain/index.js';
import { InMemoryDeckRepository } from '../infrastructure/InMemoryDeckRepository.js';
import { AnalyzeDeck, DeleteDeck, GetDeck, ListDecks } from './DeckQueries.js';
import type { DeckCardStatsProvider } from './ports/index.js';
import { SaveDeck } from './SaveDeck.js';

const empty: StatContribution = {
  resistances: { fire: 10 }, allyResistances: {}, passiveBonusPerTurn: {}, startingBonus: {}, startingBoosts: [],
  boostsPerTurn: [], unquantified: [],
  abilities: [
    {
      name: 'Attaque', period: 1, precision: 100, critChance: 0, critMultiplier: 2, heal: [], bonus: [], cost: {}, boosts: [],
      damage: [{ value: 10, elements: { fire: 1 }, targets: 1, singleTarget: 1, weight: 1 }], growth: { damage: 0, heal: 0, bonus: 0 },
    },
  ],
};

/** Catalogue simulé : cartes c1 à c5, talents 1 à 3. */
const provider: DeckCardStatsProvider = {
  async statsFor(_version: string, _language: string, slots: readonly DeckSlot[]): Promise<DeckCardStats[]> {
    return slots.map((slot) => {
      if (!/^c[1-5]$/.test(slot.cardId) || slot.talentSlot > 3) {
        throw new NotFoundError(`Carte ou talent introuvable : ${slot.cardId}/${slot.talentSlot}`);
      }
      const talent = { ...empty, resistances: {}, abilities: [] };
      return { cardId: slot.cardId, cardName: slot.cardId, talentName: 't', base: empty, talent, bonusFactor: 1 };
    });
  },
};

const slots = (...ids: string[]) => ids.map((cardId) => ({ cardId, talentSlot: 1 }));

describe('Decks', () => {
  it('crée, liste, modifie et supprime un deck', async () => {
    const decks = new InMemoryDeckRepository();
    let tick = 0;
    const save = new SaveDeck(decks, provider, () => new Date(2026, 9, 14, 12, tick++));

    const created = await save.execute({ name: 'Feu', version: '1.21', language: 'fr', slots: slots('c1', 'c2') });
    await save.execute({ name: 'Eau', version: '1.21', language: 'fr', slots: slots('c3') });
    const updated = await save.execute({ id: created.id, name: 'Feu 2', version: '1.21', language: 'fr', slots: slots('c1') });

    assert.equal(updated.id, created.id);
    assert.deepEqual((await new ListDecks(decks).execute()).map((deck) => deck.name), ['Feu 2', 'Eau']);
    assert.equal((await new GetDeck(decks).execute({ id: created.id })).slots.length, 1);

    await new DeleteDeck(decks).execute({ id: created.id });
    await assert.rejects(new GetDeck(decks).execute({ id: created.id }), NotFoundError);
    await assert.rejects(new DeleteDeck(decks).execute({ id: created.id }), NotFoundError);
  });

  it("refuse d'enregistrer une carte ou un talent inconnus", async () => {
    const save = new SaveDeck(new InMemoryDeckRepository(), provider);
    await assert.rejects(save.execute({ name: 'X', version: '1.21', language: 'fr', slots: slots('inconnue') }), NotFoundError);
    await assert.rejects(
      save.execute({ id: 'absent', name: 'X', version: '1.21', language: 'fr', slots: [] }),
      NotFoundError,
    );
  });

  it('analyse une composition non enregistrée', async () => {
    const analysis = await new AnalyzeDeck(provider).execute({ version: '1.21', language: 'fr', slots: slots('c1', 'c2'), turns: 5 });
    assert.equal(analysis.totalDamagePerTurn, 20);
    assert.equal(analysis.turns.length, 5);
  });
});
