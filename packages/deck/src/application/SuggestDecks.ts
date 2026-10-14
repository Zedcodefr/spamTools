import type { UseCase } from '@spamtools/shared-kernel';
import { searchDecks, type DeckSlot, type SearchObjective, type SearchResult } from '../domain/index.js';
import type { DeckCardStatsProvider } from './ports/index.js';

export interface SuggestDecksInput extends SearchObjective {
  readonly version: string;
  readonly language: string;
  /** Cartes déjà choisies, à compléter (vide : deck complet). */
  readonly slots: readonly DeckSlot[];
  readonly turns: number;
  readonly excludedCardIds?: readonly string[] | undefined;
  readonly count?: number | undefined;
}

/**
 * Autocomplétion de deck : complète les cartes choisies pour maximiser les dégâts (totaux ou
 * cible unique), les soins, ou un compromis des deux.
 */
export class SuggestDecks implements UseCase<SuggestDecksInput, SearchResult> {
  constructor(private readonly cards: DeckCardStatsProvider) {}

  async execute(input: SuggestDecksInput): Promise<SearchResult> {
    const candidates = await this.cards.candidates(input.version, input.language);
    return searchDecks(
      candidates,
      { damage: input.damage, healWeight: input.healWeight },
      {
        turns: input.turns,
        locked: input.slots,
        ...(input.excludedCardIds !== undefined && { excludedCardIds: input.excludedCardIds }),
        ...(input.count !== undefined && { count: input.count }),
      },
    );
  }
}
