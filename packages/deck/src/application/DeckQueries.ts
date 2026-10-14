import { NotFoundError, type UseCase } from '@spamtools/shared-kernel';
import { analyzeDeck, DeckId, type DeckAnalysis, type DeckSlot } from '../domain/index.js';
import { toDeckView, type DeckView } from './DeckView.js';
import type { DeckCardStatsProvider, DeckRepository } from './ports/index.js';

export class ListDecks implements UseCase<void, DeckView[]> {
  constructor(private readonly decks: DeckRepository) {}

  async execute(): Promise<DeckView[]> {
    return (await this.decks.list()).map(toDeckView);
  }
}

export class GetDeck implements UseCase<{ readonly id: string }, DeckView> {
  constructor(private readonly decks: DeckRepository) {}

  async execute({ id }: { readonly id: string }): Promise<DeckView> {
    const deck = await this.decks.findById(new DeckId(id));
    if (deck === undefined) {
      throw new NotFoundError(`Deck introuvable : ${id}`);
    }
    return toDeckView(deck);
  }
}

export class DeleteDeck implements UseCase<{ readonly id: string }, void> {
  constructor(private readonly decks: DeckRepository) {}

  async execute({ id }: { readonly id: string }): Promise<void> {
    if (!(await this.decks.delete(new DeckId(id)))) {
      throw new NotFoundError(`Deck introuvable : ${id}`);
    }
  }
}

export interface AnalyzeDeckInput {
  readonly version: string;
  readonly language: string;
  readonly slots: readonly DeckSlot[];
  /** Nombre de tours de la projection (bonus accumulés). */
  readonly turns?: number | undefined;
}

/**
 * Analyse une composition, enregistrée ou non : résistances moyennes, dégâts et
 * éléments par tour, bonus de départ, effets non chiffrés.
 */
export class AnalyzeDeck implements UseCase<AnalyzeDeckInput, DeckAnalysis> {
  constructor(private readonly cards: DeckCardStatsProvider) {}

  async execute(input: AnalyzeDeckInput): Promise<DeckAnalysis> {
    return analyzeDeck(await this.cards.statsFor(input.version, input.language, input.slots), input.turns);
  }
}
