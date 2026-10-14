import { DomainError, Entity } from '@spamtools/shared-kernel';
import { CardId } from './CardId.js';

/** Effet élémentaire d'une capacité ou d'un talent (dégâts, soin, bonus...). */
export interface CardAction {
  readonly effect: string;
  readonly kind: string;
  readonly min: number;
  readonly max: number;
  readonly element: string | null;
  readonly chain: number;
  readonly percent: boolean;
}

/** Capacité active, déclenchée en jeu et soumise à un temps de recharge. */
export interface Ability {
  readonly id: string;
  readonly name: string;
  readonly effect: string;
  /** Même texte avec balises `{icon:..}`, `{el:..}`, `{kw:..}` pour l'affichage. */
  readonly effectRich: string;
  readonly cooldown: number;
  readonly elements: readonly string[];
  readonly precision: number;
  readonly critChance: number;
  readonly critMultiplier: number;
  readonly duration: number;
  readonly uses: number;
  readonly cooldownResetChance: number;
  readonly actions: readonly CardAction[];
}

/** Tox : effet passif porté par la carte. */
export interface Skill {
  readonly id: string;
  readonly name: string;
  readonly effect: string;
  readonly effectRich: string;
  readonly rarity: string;
  readonly element: string | null;
  readonly value: number;
  readonly icon: string | null;
}

export interface Talent {
  readonly slot: number;
  readonly id: string;
  readonly name: string;
  readonly effect: string;
  readonly effectRich: string;
  readonly elements: readonly string[];
  readonly grantsSkill: string | null;
  readonly actions: readonly CardAction[];
}

export interface Artwork {
  readonly file: string;
  readonly small: string;
  readonly tiny: string;
  readonly width: number;
  readonly height: number;
  /** À créditer partout où l'illustration est affichée (conditions d'utilisation des données). */
  readonly artist: { readonly name: string; readonly link: string | null };
}

export interface Lore {
  readonly species: string;
  readonly region: string;
  readonly era: string;
  readonly text: string;
}

export interface CardData {
  readonly id: string;
  readonly slug: string;
  readonly number: number;
  readonly name: string;
  readonly element: string;
  readonly rarity: string;
  readonly spamton: number;
  readonly hp: number;
  readonly resistances: Readonly<Record<string, number>>;
  readonly artwork: Artwork;
  readonly abilities: readonly Ability[];
  readonly skills: readonly Skill[];
  readonly talents: readonly Talent[];
  readonly lore: Lore;
}

export interface CardCriteria {
  readonly element?: string | undefined;
  readonly rarity?: string | undefined;
  /** Recherché dans le nom et les textes de la carte, sans tenir compte de la casse ni des accents. */
  readonly text?: string | undefined;
}

/**
 * Une carte du jeu, telle que publiée pour une version donnée.
 */
export class Card extends Entity<CardId> {
  private constructor(readonly data: CardData) {
    super(new CardId(data.id));
  }

  static create(data: CardData): Card {
    if (data.name.trim() === '') {
      throw new DomainError(`La carte ${data.id} n'a pas de nom`);
    }
    if (!Number.isInteger(data.number) || data.number < 0) {
      throw new DomainError(`Numéro invalide pour la carte "${data.name}" : ${data.number}`);
    }
    if (data.hp < 0 || data.spamton < 0) {
      throw new DomainError(`PV ou spamton négatifs pour la carte "${data.name}"`);
    }
    return new Card(data);
  }

  get number(): number {
    return this.data.number;
  }

  get name(): string {
    return this.data.name;
  }

  get element(): string {
    return this.data.element;
  }

  get rarity(): string {
    return this.data.rarity;
  }

  /** Images propres à la carte (illustration en 3 tailles, icônes de tox). */
  imagePaths(): string[] {
    const { artwork, skills } = this.data;
    const skillIcons = skills.flatMap((skill) => (skill.icon === null ? [] : [skill.icon]));
    return [artwork.file, artwork.small, artwork.tiny, ...skillIcons];
  }

  matches(criteria: CardCriteria): boolean {
    if (criteria.element !== undefined && criteria.element !== this.element) {
      return false;
    }
    if (criteria.rarity !== undefined && criteria.rarity !== this.rarity) {
      return false;
    }
    if (criteria.text === undefined || criteria.text.trim() === '') {
      return true;
    }
    const needle = normalizeForSearch(criteria.text.trim());
    return this.searchableTexts().some((text) => normalizeForSearch(text).includes(needle));
  }

  private searchableTexts(): string[] {
    const { name, abilities, skills, talents } = this.data;
    return [name, ...[...abilities, ...skills, ...talents].flatMap((entry) => [entry.name, entry.effect])];
  }
}

function normalizeForSearch(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}
