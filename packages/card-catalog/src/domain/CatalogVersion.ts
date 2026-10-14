import { DomainError, ValueObject } from '@spamtools/shared-kernel';

const FORMAT = /^\d+(\.\d+)*$/;

/**
 * Version du jeu dont proviennent les données (ex. "1.21").
 */
export class CatalogVersion extends ValueObject<{ value: string }> {
  static of(value: string): CatalogVersion {
    if (!FORMAT.test(value)) {
      throw new DomainError(`Version de catalogue invalide : "${value}"`);
    }
    return new CatalogVersion({ value });
  }

  get value(): string {
    return this.props.value;
  }

  /** Comparaison numérique segment par segment : 1.9 < 1.10. */
  compareTo(other: CatalogVersion): number {
    const mine = this.segments();
    const theirs = other.segments();
    for (let i = 0; i < Math.max(mine.length, theirs.length); i++) {
      const diff = (mine[i] ?? 0) - (theirs[i] ?? 0);
      if (diff !== 0) {
        return Math.sign(diff);
      }
    }
    return 0;
  }

  override toString(): string {
    return this.value;
  }

  private segments(): number[] {
    return this.value.split('.').map(Number);
  }
}
