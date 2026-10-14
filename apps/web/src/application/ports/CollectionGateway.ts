/**
 * Port : la collection du joueur (identifiants des cartes possédées).
 */
export interface CollectionGateway {
  get(): Promise<readonly string[]>;
  /** Ajoute (owned) ou retire des cartes ; renvoie la collection à jour. */
  set(cardIds: readonly string[], owned: boolean): Promise<readonly string[]>;
}
