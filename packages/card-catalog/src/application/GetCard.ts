import type { UseCase } from '@spamtools/shared-kernel';
import { CatalogVersion } from '../domain/index.js';
import { toCardView, type CardView } from './CardView.js';
import { NotFoundError } from './errors.js';
import type { CatalogRepository } from './ports/index.js';

export interface GetCardInput {
  readonly id: string;
  readonly language: string;
  /** Par défaut : la version la plus récente importée. */
  readonly version?: string | undefined;
}

export interface GetCardOutput {
  readonly version: string;
  readonly language: string;
  readonly card: CardView;
}

export class GetCard implements UseCase<GetCardInput, GetCardOutput> {
  constructor(private readonly repository: CatalogRepository) {}

  async execute(input: GetCardInput): Promise<GetCardOutput> {
    const version = input.version === undefined ? undefined : CatalogVersion.of(input.version);
    const catalog = await this.repository.find(input.language, version);
    const card = catalog?.findCard(input.id);
    if (catalog === undefined || card === undefined) {
      throw new NotFoundError(`Carte introuvable : ${input.id}`);
    }
    return { version: catalog.version.value, language: catalog.language, card: toCardView(catalog, card) };
  }
}
