/** Decks tels que servis par l'API (/api/decks), et composition en cours d'édition. */

export const DECK_SIZE = 4;

/** Une carte du deck et le talent choisi pour elle (emplacement 1, 2 ou 3). */
export interface DeckSlot {
  readonly cardId: string;
  readonly talentSlot: number;
}

export interface DeckView {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly language: string;
  readonly slots: readonly DeckSlot[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Composition en cours : `id` nul tant que le deck n'est pas enregistré. */
export interface DeckDraft {
  readonly id: string | null;
  readonly name: string;
  readonly slots: readonly DeckSlot[];
}

export const EMPTY_DRAFT: DeckDraft = { id: null, name: '', slots: [] };

export const DEFAULT_TALENT_SLOT = 1;

/** Ajoute la carte (talent 1 par défaut) si le deck n'est pas plein, ou la retire si elle y est déjà. */
export function toggleCard(draft: DeckDraft, cardId: string): DeckDraft {
  if (draft.slots.some((slot) => slot.cardId === cardId)) {
    return removeCard(draft, cardId);
  }
  if (draft.slots.length >= DECK_SIZE) {
    return draft;
  }
  return { ...draft, slots: [...draft.slots, { cardId, talentSlot: DEFAULT_TALENT_SLOT }] };
}

export function removeCard(draft: DeckDraft, cardId: string): DeckDraft {
  return { ...draft, slots: draft.slots.filter((slot) => slot.cardId !== cardId) };
}

export function setTalent(draft: DeckDraft, cardId: string, talentSlot: number): DeckDraft {
  return {
    ...draft,
    slots: draft.slots.map((slot) => (slot.cardId === cardId ? { ...slot, talentSlot } : slot)),
  };
}

export function isFull(draft: DeckDraft): boolean {
  return draft.slots.length >= DECK_SIZE;
}

export type ElementAmounts = Readonly<Record<string, number>>;

export interface TurnProjection {
  readonly turn: number;
  readonly bonusStock: ElementAmounts;
  readonly damage: ElementAmounts;
  readonly heal: ElementAmounts;
  readonly totalDamage: number;
  readonly totalHeal: number;
}

/** Analyse d'un deck (POST /api/decks/analysis) : espérances par tour. */
export interface DeckAnalysis {
  readonly cardCount: number;
  readonly averageResistances: ElementAmounts;
  readonly weaknesses: readonly string[];
  readonly damagePerTurn: ElementAmounts;
  readonly totalDamagePerTurn: number;
  readonly healPerTurn: ElementAmounts;
  readonly totalHealPerTurn: number;
  readonly turns: readonly TurnProjection[];
  readonly averageDamagePerTurn: ElementAmounts;
  readonly averageTotalDamagePerTurn: number;
  readonly averageHealPerTurn: ElementAmounts;
  readonly averageTotalHealPerTurn: number;
  readonly generatedPerTurn: ElementAmounts;
  readonly consumedPerTurn: ElementAmounts;
  readonly netPerTurn: ElementAmounts;
  readonly startingBonus: ElementAmounts;
  readonly cards: readonly {
    readonly cardId: string;
    readonly cardName: string;
    readonly talentName: string;
    readonly resistances: ElementAmounts;
    readonly damagePerTurn: number;
    readonly generatedPerTurn: number;
  }[];
  readonly unquantified: readonly { readonly cardName: string; readonly source: string; readonly reason: string }[];
}
