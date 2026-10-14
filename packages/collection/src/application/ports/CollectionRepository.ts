import type { Collection } from '../../domain/index.js';

/**
 * Port : persistance de la collection du joueur.
 */
export interface CollectionRepository {
  load(): Promise<Collection>;
  /** Enregistre l'ajout (owned) ou le retrait de ces cartes. */
  saveChanges(cardIds: readonly string[], owned: boolean): Promise<void>;
}
