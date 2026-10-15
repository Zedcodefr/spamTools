import type { Deck, DeckId } from '../../domain/index.js';

/**
 * Port : persistance des decks.
 */
export interface DeckRepository {
  save(deck: Deck): Promise<void>;
  findById(id: DeckId): Promise<Deck | undefined>;
  /** Decks d'un compte, du plus récemment modifié au plus ancien. */
  list(ownerId: string): Promise<Deck[]>;
  delete(id: DeckId): Promise<boolean>;
}
