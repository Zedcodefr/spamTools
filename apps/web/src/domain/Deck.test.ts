import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EMPTY_DRAFT, isFull, removeCard, setTalent, toggleCard } from './Deck.ts';

const ids = (draft: typeof EMPTY_DRAFT) => draft.slots.map((slot) => slot.cardId);

describe('composition de deck', () => {
  it('ajoute une carte avec le talent 1, et la retire au second clic', () => {
    const draft = toggleCard(EMPTY_DRAFT, 'a');
    assert.deepEqual(draft.slots, [{ cardId: 'a', talentSlot: 1 }]);
    assert.deepEqual(ids(toggleCard(draft, 'a')), []);
  });

  it("n'ajoute rien au-delà de 4 cartes", () => {
    const full = ['a', 'b', 'c', 'd'].reduce(toggleCard, EMPTY_DRAFT);
    assert.equal(isFull(full), true);
    assert.deepEqual(ids(toggleCard(full, 'e')), ['a', 'b', 'c', 'd']);
  });

  it('change le talent ou retire une carte précise', () => {
    const draft = ['a', 'b'].reduce(toggleCard, EMPTY_DRAFT);
    assert.deepEqual(setTalent(draft, 'b', 3).slots[1], { cardId: 'b', talentSlot: 3 });
    assert.deepEqual(ids(removeCard(draft, 'a')), ['b']);
  });
});
