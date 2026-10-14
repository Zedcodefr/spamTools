import { randomUUID } from 'node:crypto';
import { DomainError } from './DomainError.js';

/**
 * Identité d'une entité. Sous-classer pour obtenir des identifiants typés
 * (ex. `class ImportJobId extends Identifier {}`).
 */
export class Identifier {
  readonly value: string;

  constructor(value: string = randomUUID()) {
    if (value.trim() === '') {
      throw new DomainError('Un identifiant ne peut pas être vide');
    }
    this.value = value;
  }

  equals(other?: Identifier): boolean {
    return other !== undefined && other.constructor === this.constructor && other.value === this.value;
  }

  toString(): string {
    return this.value;
  }
}
