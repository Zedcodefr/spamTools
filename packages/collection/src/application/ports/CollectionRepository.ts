import type { Collection } from '../../domain/index.js';

/**
 * Port : persistance de la collection du joueur.
 */
export interface CollectionRepository {
  /** Collection d'un compte. */
  load(ownerId: string): Promise<Collection>;
  /** Enregistre l'ajout (owned) ou le retrait de ces cartes dans la collection du compte. */
  saveChanges(ownerId: string, cardIds: readonly string[], owned: boolean): Promise<void>;
}
