import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EMPTY_DRAFT, isFull, removeCard, setTalent, toggleCard, toggleDps } from './Deck.ts';

const ids = (draft: typeof EMPTY_DRAFT) => draft.slots.map((slot) => slot.cardId);

describe('composition de deck', () => {
  it('ajoute une carte sans talent, et la retire au second clic', () => {
    const draft = toggleCard(EMPTY_DRAFT, 'a');
    assert.deepEqual(draft.slots, [{ cardId: 'a', talentSlot: null }]);
    assert.deepEqual(ids(toggleCard(draft, 'a')), []);
  });

  it("n'ajoute rien au-delà de 4 cartes", () => {
    const full = ['a', 'b', 'c', 'd'].reduce(toggleCard, EMPTY_DRAFT);
    assert.equal(isFull(full), true);
    assert.deepEqual(ids(toggleCard(full, 'e')), ['a', 'b', 'c', 'd']);
  });

  it('désigne un DPS parmi les cartes du deck, et le libère si la carte est retirée', () => {
    const draft = toggleDps(['a', 'b'].reduce(toggleCard, EMPTY_DRAFT), 'b');
    assert.equal(draft.dpsCardId, 'b');
    assert.equal(toggleDps(draft, 'b').dpsCardId, null);
    assert.equal(toggleDps(draft, 'z').dpsCardId, 'b');
    assert.equal(removeCard(draft, 'b').dpsCardId, null);
  });

  it('change le talent ou retire une carte précise', () => {
    const draft = ['a', 'b'].reduce(toggleCard, EMPTY_DRAFT);
    assert.deepEqual(setTalent(draft, 'b', 3).slots[1], { cardId: 'b', talentSlot: 3 });
    assert.deepEqual(setTalent(setTalent(draft, 'b', 3), 'b', null).slots[1], { cardId: 'b', talentSlot: null });
    assert.deepEqual(ids(removeCard(draft, 'a')), ['b']);
  });
});
