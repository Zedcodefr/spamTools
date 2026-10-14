import { DomainError } from '@spamtools/shared-kernel';
import { AssetPath } from './AssetPath.js';
import type { Catalog } from './Catalog.js';

/**
 * Plan de composition d'une carte publié par le jeu (calques en pixels sur une
 * carte de `width` x `height`). C'est une donnée de présentation : elle est
 * conservée telle quelle pour le front, le domaine n'en exploite que les images.
 */
export class CardLayout {
  private constructor(readonly document: Readonly<Record<string, unknown>>) {}

  static of(document: Readonly<Record<string, unknown>>): CardLayout {
    if (typeof document['width'] !== 'number' || typeof document['height'] !== 'number') {
      throw new DomainError('Le plan de carte doit indiquer sa largeur et sa hauteur');
    }
    return new CardLayout(document);
  }

  /**
   * Images du cadre (champs `image`), avec `{element}` et `{rarity}`
   * remplacés par chaque identifiant du catalogue.
   */
  assetPaths(catalog: Catalog): AssetPath[] {
    const elementIds = catalog.elements.map((element) => element.id);
    const rarityIds = catalog.rarities.map((rarity) => rarity.id);

    return collectImageTemplates(this.document)
      .flatMap((template) => expand(template, 'element', elementIds))
      .flatMap((template) => expand(template, 'rarity', rarityIds))
      .map((path) => AssetPath.of(path));
  }
}

function collectImageTemplates(node: unknown): string[] {
  if (Array.isArray(node)) {
    return node.flatMap(collectImageTemplates);
  }
  if (typeof node !== 'object' || node === null) {
    return [];
  }
  return Object.entries(node).flatMap(([key, value]) =>
    key === 'image' && typeof value === 'string' ? [value] : collectImageTemplates(value),
  );
}

function expand(template: string, placeholder: string, ids: readonly string[]): string[] {
  const token = `{${placeholder}}`;
  return template.includes(token) ? ids.map((id) => template.replaceAll(token, id)) : [template];
}
