import type { Identifier } from './Identifier.js';

/**
 * Entité : définie par son identité, pas par ses attributs.
 */
export abstract class Entity<TId extends Identifier> {
  protected constructor(readonly id: TId) {}

  equals(other?: Entity<TId>): boolean {
    return other !== undefined && other.constructor === this.constructor && other.id.equals(this.id);
  }
}
