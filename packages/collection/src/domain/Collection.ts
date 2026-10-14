import { DomainError } from '@spamtools/shared-kernel';

/**
 * Les cartes que possède le joueur, par identifiant de carte (stable d'une version du jeu à l'autre).
 */
export class Collection {
  private constructor(private readonly owned: Set<string>) {}

  static of(cardIds: Iterable<string>): Collection {
    const ids = new Set<string>();
    for (const id of cardIds) {
      ids.add(Collection.validate(id));
    }
    return new Collection(ids);
  }

  get cardIds(): readonly string[] {
    return [...this.owned].sort();
  }

  get size(): number {
    return this.owned.size;
  }

  owns(cardId: string): boolean {
    return this.owned.has(cardId);
  }

  /** Ajoute (owned) ou retire des cartes ; renvoie celles dont l'état a changé. */
  set(cardIds: readonly string[], owned: boolean): string[] {
    const changed: string[] = [];
    for (const id of cardIds.map(Collection.validate)) {
      if (owned && !this.owned.has(id)) {
        this.owned.add(id);
        changed.push(id);
      } else if (!owned && this.owned.delete(id)) {
        changed.push(id);
      }
    }
    return changed;
  }

  private static validate(cardId: string): string {
    const id = cardId.trim();
    if (id === '') {
      throw new DomainError("Identifiant de carte vide");
    }
    return id;
  }
}
