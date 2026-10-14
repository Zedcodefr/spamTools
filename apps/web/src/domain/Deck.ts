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
  readonly dpsCardId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Composition en cours : `id` nul tant que le deck n'est pas enregistré. */
export interface DeckDraft {
  readonly id: string | null;
  readonly name: string;
  readonly slots: readonly DeckSlot[];
  /** Carte qui reçoit les renforts ciblés des autres (facultatif). */
  readonly dpsCardId: string | null;
}

export const EMPTY_DRAFT: DeckDraft = { id: null, name: '', slots: [], dpsCardId: null };

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
  return {
    ...draft,
    slots: draft.slots.filter((slot) => slot.cardId !== cardId),
    dpsCardId: draft.dpsCardId === cardId ? null : draft.dpsCardId,
  };
}

/** Désigne la carte comme DPS, ou retire ce rôle si elle l'a déjà. */
export function toggleDps(draft: DeckDraft, cardId: string): DeckDraft {
  if (!draft.slots.some((slot) => slot.cardId === cardId)) {
    return draft;
  }
  return { ...draft, dpsCardId: draft.dpsCardId === cardId ? null : cardId };
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
  /** Stock de bonus élémentaires pendant ce tour (générés ce tour compris). */
  readonly bonusStock: ElementAmounts;
  readonly damage: ElementAmounts;
  readonly heal: ElementAmounts;
  readonly totalDamage: number;
  /** Dégâts reçus en moyenne par une carte adverse donnée. */
  readonly totalSingleTargetDamage: number;
  readonly totalHeal: number;
}

/** Renforts cumulés d'une carte : points de précision et de critique, multiplicateur, valeurs de base. */
export interface CardBoosts {
  readonly precision: number;
  readonly critChance: number;
  readonly critMultiplier: number;
  readonly baseDamage: number;
  readonly baseHeal: number;
}

/** Analyse d'un deck (POST /api/decks/analysis) : simulation tour par tour, en espérance. */
export interface DeckAnalysis {
  readonly cardCount: number;
  readonly dpsCardId: string | null;
  readonly averageResistances: ElementAmounts;
  readonly weaknesses: readonly string[];
  /** Moyennes par tour sur la simulation, tout compris : dégâts totaux, toutes cibles confondues… */
  readonly damagePerTurn: ElementAmounts;
  readonly totalDamagePerTurn: number;
  /** … et dégâts reçus par une carte adverse donnée (zone : une part ; cible au hasard : sa probabilité). */
  readonly singleTargetDamagePerTurn: ElementAmounts;
  readonly totalSingleTargetDamagePerTurn: number;
  readonly healPerTurn: ElementAmounts;
  readonly totalHealPerTurn: number;
  readonly generatedPerTurn: ElementAmounts;
  readonly consumedPerTurn: ElementAmounts;
  readonly startingBonus: ElementAmounts;
  readonly turns: readonly TurnProjection[];
  readonly cards: readonly {
    readonly cardId: string;
    readonly cardName: string;
    readonly talentName: string;
    readonly isDps: boolean;
    readonly resistances: ElementAmounts;
    readonly damagePerTurn: number;
    readonly singleTargetDamagePerTurn: number;
    readonly healPerTurn: number;
    readonly generatedPerTurn: number;
    readonly finalBoosts: CardBoosts;
  }[];
  readonly unquantified: readonly { readonly cardName: string; readonly source: string; readonly reason: string }[];
}
