import { AggregateRoot, DomainError, Identifier } from '@spamtools/shared-kernel';
import { AssetPath } from './AssetPath.js';
import type { Card, CardCriteria } from './Card.js';
import type { CatalogVersion } from './CatalogVersion.js';
import type { CardElement, Keyword, Rarity } from './References.js';

export class CatalogId extends Identifier {
  static of(version: CatalogVersion, language: string): CatalogId {
    return new CatalogId(`${version.value}/${language}`);
  }
}

export interface CatalogProps {
  readonly version: CatalogVersion;
  readonly language: string;
  readonly generatedAt: Date;
  readonly elements: readonly CardElement[];
  readonly rarities: readonly Rarity[];
  readonly keywords: readonly Keyword[];
  readonly cards: readonly Card[];
}

/**
 * Agrégat : l'ensemble des cartes d'une version du jeu dans une langue,
 * avec les référentiels (éléments, raretés, mots-clés) auxquels elles renvoient.
 */
export class Catalog extends AggregateRoot<CatalogId> {
  private constructor(private readonly props: CatalogProps) {
    super(CatalogId.of(props.version, props.language));
  }

  static create(props: CatalogProps): Catalog {
    if (props.language.trim() === '') {
      throw new DomainError("La langue du catalogue est obligatoire");
    }
    const elementIds = uniqueIds(props.elements.map((element) => element.id), 'élément');
    const rarityIds = uniqueIds(props.rarities.map((rarity) => rarity.id), 'rareté');
    uniqueIds(props.cards.map((card) => card.id.value), 'carte');

    for (const card of props.cards) {
      if (!elementIds.has(card.element)) {
        throw new DomainError(`La carte "${card.name}" référence un élément inconnu : "${card.element}"`);
      }
      if (!rarityIds.has(card.rarity)) {
        throw new DomainError(`La carte "${card.name}" référence une rareté inconnue : "${card.rarity}"`);
      }
    }

    const cards = [...props.cards].sort((a, b) => a.number - b.number);
    return new Catalog({ ...props, cards });
  }

  get version(): CatalogVersion {
    return this.props.version;
  }

  get language(): string {
    return this.props.language;
  }

  get generatedAt(): Date {
    return this.props.generatedAt;
  }

  get elements(): readonly CardElement[] {
    return this.props.elements;
  }

  get rarities(): readonly Rarity[] {
    return this.props.rarities;
  }

  get keywords(): readonly Keyword[] {
    return this.props.keywords;
  }

  /** Cartes triées par numéro. */
  get cards(): readonly Card[] {
    return this.props.cards;
  }

  findCard(id: string): Card | undefined {
    return this.props.cards.find((card) => card.id.value === id);
  }

  search(criteria: CardCriteria): Card[] {
    return this.props.cards.filter((card) => card.matches(criteria));
  }

  /** Toutes les images référencées par les données (hors cadre de carte, voir CardLayout). */
  assetPaths(): AssetPath[] {
    return [
      ...this.props.elements.map((element) => element.icon),
      ...this.props.rarities.map((rarity) => rarity.gem),
      ...this.props.keywords.flatMap((keyword) => (keyword.icon === null ? [] : [keyword.icon])),
      ...this.props.cards.flatMap((card) => card.imagePaths()),
    ].map((path) => AssetPath.of(path));
  }
}

function uniqueIds(ids: readonly string[], label: string): Set<string> {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      throw new DomainError(`Identifiant de ${label} en double : "${id}"`);
    }
    seen.add(id);
  }
  return seen;
}
