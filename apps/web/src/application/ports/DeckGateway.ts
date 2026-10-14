import type { DeckAnalysis, DeckSlot, DeckView } from '../../domain/Deck.ts';

export interface DeckToSave {
  readonly id: string | null;
  readonly name: string;
  readonly version: string;
  readonly slots: readonly DeckSlot[];
  readonly dpsCardId: string | null;
}

/**
 * Port : decks enregistrés et analyse d'une composition.
 */
export interface DeckGateway {
  list(): Promise<readonly DeckView[]>;
  save(deck: DeckToSave): Promise<DeckView>;
  delete(id: string): Promise<void>;
  analyze(version: string, slots: readonly DeckSlot[], turns: number, dpsCardId: string | null): Promise<DeckAnalysis>;
}
