/**
 * Référentiels du catalogue : les cartes y font référence par `id`.
 * Les chemins d'images sont relatifs au dossier `data/` du site.
 */

export interface CardElement {
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly icon: string;
  readonly color: string;
}

export interface Rarity {
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly gem: string;
  readonly textColor: string | null;
}

/** Terme de jeu (passif, statut, glossaire) référencé dans les textes riches via `{kw:id}`. */
export interface Keyword {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly descriptionRich: string;
  readonly tooltip: string;
  readonly color: string | null;
  readonly icon: string | null;
}
