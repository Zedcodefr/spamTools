import type { Deck, DeckSlot } from '../domain/index.js';

/** Un deck tel que servi. */
export interface DeckView {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly language: string;
  readonly slots: readonly DeckSlot[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toDeckView(deck: Deck): DeckView {
  return {
    id: deck.id.value,
    name: deck.name,
    version: deck.version,
    language: deck.language,
    slots: deck.slots,
    createdAt: deck.createdAt.toISOString(),
    updatedAt: deck.updatedAt.toISOString(),
  };
}
