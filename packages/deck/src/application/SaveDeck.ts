import type { UseCase } from '@spamtools/shared-kernel';
import { Deck, type DeckContent } from '../domain/index.js';
import { findOwnedDeck } from './DeckQueries.js';
import { toDeckView, type DeckView } from './DeckView.js';
import type { DeckCardStatsProvider, DeckRepository } from './ports/index.js';

export interface SaveDeckInput extends DeckContent {
  /** Absent : création d'un nouveau deck. */
  readonly id?: string | undefined;
  /** Compte qui enregistre : propriétaire du nouveau deck, ou qui doit posséder celui modifié. */
  readonly ownerId: string;
}

/**
 * Crée ou met à jour un deck, après avoir vérifié que ses cartes et talents
 * existent dans la version indiquée.
 */
export class SaveDeck implements UseCase<SaveDeckInput, DeckView> {
  constructor(
    private readonly decks: DeckRepository,
    private readonly cards: DeckCardStatsProvider,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(input: SaveDeckInput): Promise<DeckView> {
    const content: DeckContent = {
      name: input.name,
      version: input.version,
      language: input.language,
      slots: input.slots,
      dpsCardId: input.dpsCardId ?? null,
    };
    let deck: Deck;
    if (input.id === undefined) {
      deck = Deck.create(input.ownerId, content, this.clock());
    } else {
      const existing = await findOwnedDeck(this.decks, { id: input.id, ownerId: input.ownerId });
      existing.update(content, this.clock());
      deck = existing;
    }
    await this.cards.statsFor(deck.version, deck.language, deck.slots);
    await this.decks.save(deck);
    return toDeckView(deck);
  }
}
