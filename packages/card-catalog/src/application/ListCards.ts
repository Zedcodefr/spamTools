import type { UseCase } from '@spamtools/shared-kernel';
import { CatalogVersion, type CardData } from '../domain/index.js';
import { NotFoundError } from './errors.js';
import type { CatalogRepository } from './ports/index.js';

export interface ListCardsInput {
  readonly language: string;
  /** Par défaut : la version la plus récente importée. */
  readonly version?: string | undefined;
  readonly element?: string | undefined;
  readonly rarity?: string | undefined;
  readonly text?: string | undefined;
}

export interface ListCardsOutput {
  readonly version: string;
  readonly language: string;
  readonly cards: readonly CardData[];
}

export class ListCards implements UseCase<ListCardsInput, ListCardsOutput> {
  constructor(private readonly repository: CatalogRepository) {}

  async execute(input: ListCardsInput): Promise<ListCardsOutput> {
    const version = input.version === undefined ? undefined : CatalogVersion.of(input.version);
    const catalog = await this.repository.find(input.language, version);
    if (catalog === undefined) {
      throw new NotFoundError(`Aucun catalogue importé pour ${input.version ?? 'la dernière version'} en "${input.language}"`);
    }
    return {
      version: catalog.version.value,
      language: catalog.language,
      cards: catalog.search(input).map((card) => card.data),
    };
  }
}
