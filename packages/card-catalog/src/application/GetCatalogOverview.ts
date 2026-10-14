import type { UseCase } from '@spamtools/shared-kernel';
import {
  CatalogVersion,
  type CardElement,
  type Keyword,
  type Rarity,
  type SpecialAbility,
  type TraitCategory,
} from '../domain/index.js';
import { NotFoundError } from './errors.js';
import type { CatalogRepository } from './ports/index.js';

export interface GetCatalogOverviewInput {
  readonly language: string;
  /** Par défaut : la version la plus récente importée. */
  readonly version?: string | undefined;
}

export interface GetCatalogOverviewOutput {
  readonly version: string;
  readonly language: string;
  readonly generatedAt: string;
  /** Versions importées, de la plus récente à la plus ancienne. */
  readonly availableVersions: readonly string[];
  readonly cardCount: number;
  readonly elements: readonly CardElement[];
  readonly rarities: readonly Rarity[];
  readonly keywords: readonly Keyword[];
  /** Catégories et capacités particulières présentes sur au moins une carte. */
  readonly traitCategories: readonly TraitCategory[];
  readonly specialAbilities: readonly SpecialAbility[];
}

/**
 * Tout ce qu'il faut pour afficher et filtrer les cartes, sans les cartes elles-mêmes.
 */
export class GetCatalogOverview implements UseCase<GetCatalogOverviewInput, GetCatalogOverviewOutput> {
  constructor(private readonly repository: CatalogRepository) {}

  async execute(input: GetCatalogOverviewInput): Promise<GetCatalogOverviewOutput> {
    const version = input.version === undefined ? undefined : CatalogVersion.of(input.version);
    const catalog = await this.repository.find(input.language, version);
    if (catalog === undefined) {
      throw new NotFoundError(`Aucun catalogue importé pour ${input.version ?? 'la dernière version'} en "${input.language}"`);
    }
    const availableVersions = await this.repository.listVersions(input.language);
    return {
      version: catalog.version.value,
      language: catalog.language,
      generatedAt: catalog.generatedAt.toISOString(),
      availableVersions: availableVersions.map((available) => available.value),
      cardCount: catalog.cards.length,
      elements: [...catalog.elements].sort((a, b) => a.order - b.order),
      rarities: [...catalog.rarities].sort((a, b) => a.order - b.order),
      keywords: catalog.keywords,
      traitCategories: catalog.traits.categories,
      specialAbilities: catalog.traits.specialAbilities,
    };
  }
}
