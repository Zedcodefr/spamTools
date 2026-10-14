import { DomainError, ValueObject } from '@spamtools/shared-kernel';

export type ImportSourceKind = 'json';

/**
 * D'où proviennent les données à importer.
 */
export class ImportSource extends ValueObject<{ kind: ImportSourceKind; location: string }> {
  static of(kind: ImportSourceKind, location: string): ImportSource {
    if (location.trim() === '') {
      throw new DomainError("L'emplacement de la source d'import est obligatoire");
    }
    return new ImportSource({ kind, location });
  }

  get kind(): ImportSourceKind {
    return this.props.kind;
  }

  get location(): string {
    return this.props.location;
  }
}
