import type { UseCase } from '@spamtools/shared-kernel';
import { NotFoundError } from './errors.js';
import type { CatalogRepository } from './ports/index.js';

/**
 * Plan de rendu des cartes publié par le jeu, transmis tel quel au front.
 */
export class GetCardLayout implements UseCase<void, Readonly<Record<string, unknown>>> {
  constructor(private readonly repository: CatalogRepository) {}

  async execute(): Promise<Readonly<Record<string, unknown>>> {
    const layout = await this.repository.findLayout();
    if (layout === undefined) {
      throw new NotFoundError("Aucun plan de carte importé : lancer d'abord la synchronisation");
    }
    return layout.document;
  }
}
