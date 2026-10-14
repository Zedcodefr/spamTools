import { AggregateRoot, DomainError } from '@spamtools/shared-kernel';
import { DeckId } from './DeckId.js';

export const DECK_SIZE = 4;

/** Une carte du deck et le talent choisi pour elle (emplacement 1, 2 ou 3). */
export interface DeckSlot {
  readonly cardId: string;
  readonly talentSlot: number;
}

export interface DeckContent {
  readonly name: string;
  /** Version du jeu dont proviennent les cartes (leurs stats changent d'un patch à l'autre). */
  readonly version: string;
  readonly language: string;
  readonly slots: readonly DeckSlot[];
}

/**
 * Agrégat : un deck de 4 cartes au plus, chacune avec un talent, sans doublon.
 */
export class Deck extends AggregateRoot<DeckId> {
  private constructor(
    id: DeckId,
    private content: DeckContent,
    readonly createdAt: Date,
    private _updatedAt: Date,
  ) {
    super(id);
  }

  static create(content: DeckContent, now: Date, id: DeckId = new DeckId()): Deck {
    return new Deck(id, Deck.validate(content), now, now);
  }

  /** Reconstitution depuis la persistance. */
  static restore(id: DeckId, content: DeckContent, createdAt: Date, updatedAt: Date): Deck {
    return new Deck(id, Deck.validate(content), createdAt, updatedAt);
  }

  get name(): string {
    return this.content.name;
  }

  get version(): string {
    return this.content.version;
  }

  get language(): string {
    return this.content.language;
  }

  get slots(): readonly DeckSlot[] {
    return this.content.slots;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  update(content: DeckContent, now: Date): void {
    this.content = Deck.validate(content);
    this._updatedAt = now;
  }

  private static validate(content: DeckContent): DeckContent {
    const name = content.name.trim();
    if (name === '') {
      throw new DomainError('Le nom du deck est obligatoire');
    }
    if (content.slots.length > DECK_SIZE) {
      throw new DomainError(`Un deck compte au plus ${DECK_SIZE} cartes`);
    }
    const cardIds = new Set(content.slots.map((slot) => slot.cardId));
    if (cardIds.size !== content.slots.length) {
      throw new DomainError('Une carte ne peut figurer qu’une fois dans un deck');
    }
    for (const slot of content.slots) {
      if (!Number.isInteger(slot.talentSlot) || slot.talentSlot < 1) {
        throw new DomainError(`Talent invalide pour la carte ${slot.cardId} : ${slot.talentSlot}`);
      }
    }
    return { ...content, name, slots: content.slots.map((slot) => ({ ...slot })) };
  }
}
