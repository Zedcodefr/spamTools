import type { Deck, DeckId } from '../../domain/index.js';

/**
 * Port : persistance des decks.
 */
export interface DeckRepository {
  save(deck: Deck): Promise<void>;
  findById(id: DeckId): Promise<Deck | undefined>;
  /** Du plus récemment modifié au plus ancien. */
  list(): Promise<Deck[]>;
  delete(id: DeckId): Promise<boolean>;
}
