import { NotFoundError, type UseCase } from '@spamtools/shared-kernel';
import { analyzeDeck, DeckId, type Deck, type DeckAnalysis, type DeckSlot } from '../domain/index.js';
import { toDeckView, type DeckView } from './DeckView.js';
import type { DeckCardStatsProvider, DeckRepository } from './ports/index.js';

/** Un deck désigné par son identifiant, pour le compte qui le demande. */
export interface OwnedDeckInput {
  readonly id: string;
  readonly ownerId: string;
}

/** Deck du compte ; celui d'un autre compte est « introuvable » (son existence n'est pas révélée). */
export async function findOwnedDeck(decks: DeckRepository, { id, ownerId }: OwnedDeckInput): Promise<Deck> {
  const deck = await decks.findById(new DeckId(id));
  if (deck === undefined || !deck.isOwnedBy(ownerId)) {
    throw new NotFoundError(`Deck introuvable : ${id}`);
  }
  return deck;
}

export class ListDecks implements UseCase<{ readonly ownerId: string }, DeckView[]> {
  constructor(private readonly decks: DeckRepository) {}

  async execute({ ownerId }: { readonly ownerId: string }): Promise<DeckView[]> {
    return (await this.decks.list(ownerId)).map(toDeckView);
  }
}

export class GetDeck implements UseCase<OwnedDeckInput, DeckView> {
  constructor(private readonly decks: DeckRepository) {}

  async execute(input: OwnedDeckInput): Promise<DeckView> {
    return toDeckView(await findOwnedDeck(this.decks, input));
  }
}

export class DeleteDeck implements UseCase<OwnedDeckInput, void> {
  constructor(private readonly decks: DeckRepository) {}

  async execute(input: OwnedDeckInput): Promise<void> {
    const deck = await findOwnedDeck(this.decks, input);
    await this.decks.delete(deck.id);
  }
}

export interface AnalyzeDeckInput {
  readonly version: string;
  readonly language: string;
  readonly slots: readonly DeckSlot[];
  /** Nombre de tours simulés. */
  readonly turns?: number | undefined;
  /** Carte qui reçoit les renforts ciblés (facultatif). */
  readonly dpsCardId?: string | null | undefined;
}

/**
 * Analyse une composition, enregistrée ou non : résistances moyennes, simulation tour par
 * tour (dégâts, soins, éléments, renforts), effets non chiffrés.
 */
export class AnalyzeDeck implements UseCase<AnalyzeDeckInput, DeckAnalysis> {
  constructor(private readonly cards: DeckCardStatsProvider) {}

  async execute(input: AnalyzeDeckInput): Promise<DeckAnalysis> {
    const cards = await this.cards.statsFor(input.version, input.language, input.slots);
    return analyzeDeck(cards, { turns: input.turns, dpsCardId: input.dpsCardId });
  }
}
