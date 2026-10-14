import { DomainError, ValueObject } from '@spamtools/shared-kernel';

/**
 * Version de schéma, entier strictement positif et ordonné.
 */
export class MigrationVersion extends ValueObject<{ value: number }> {
  static of(value: number): MigrationVersion {
    if (!Number.isInteger(value) || value <= 0) {
      throw new DomainError(`Version de migration invalide : ${value}`);
    }
    return new MigrationVersion({ value });
  }

  get value(): number {
    return this.props.value;
  }

  isAfter(other: MigrationVersion): boolean {
    return this.value > other.value;
  }
}
