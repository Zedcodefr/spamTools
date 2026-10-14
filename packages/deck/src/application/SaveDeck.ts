import { NotFoundError, type UseCase } from '@spamtools/shared-kernel';
import { Deck, DeckId, type DeckContent } from '../domain/index.js';
import { toDeckView, type DeckView } from './DeckView.js';
import type { DeckCardStatsProvider, DeckRepository } from './ports/index.js';

export interface SaveDeckInput extends DeckContent {
  /** Absent : création d'un nouveau deck. */
  readonly id?: string | undefined;
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
    const content: DeckContent = { name: input.name, version: input.version, language: input.language, slots: input.slots };
    let deck: Deck;
    if (input.id === undefined) {
      deck = Deck.create(content, this.clock());
    } else {
      const existing = await this.decks.findById(new DeckId(input.id));
      if (existing === undefined) {
        throw new NotFoundError(`Deck introuvable : ${input.id}`);
      }
      existing.update(content, this.clock());
      deck = existing;
    }
    await this.cards.statsFor(deck.version, deck.language, deck.slots);
    await this.decks.save(deck);
    return toDeckView(deck);
  }
}
