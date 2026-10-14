import { DomainError, ValueObject } from '@spamtools/shared-kernel';

const ALLOWED_CHARACTERS = /^[A-Za-z0-9._/-]+$/;

/**
 * Chemin d'une image relatif au dossier `data/` du site (ex. "img/elements/fire.webp").
 * Les chemins viennent d'une source externe : tout chemin qui pourrait sortir
 * de ce dossier est refusé.
 */
export class AssetPath extends ValueObject<{ value: string }> {
  static of(value: string): AssetPath {
    const segments = value.split('/');
    if (!ALLOWED_CHARACTERS.test(value) || segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
      throw new DomainError(`Chemin d'image invalide : "${value}"`);
    }
    return new AssetPath({ value });
  }

  get value(): string {
    return this.props.value;
  }

  override toString(): string {
    return this.value;
  }
}
