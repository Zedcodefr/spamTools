import type { Card, CardData, CardTraits, Catalog } from '../domain/index.js';

/** Une carte telle que servie : ses données et ses caractéristiques calculées à l'import. */
export type CardView = CardData & { readonly traits: CardTraits };

export function toCardView(catalog: Catalog, card: Card): CardView {
  return { ...card.data, traits: catalog.traitsOf(card) };
}
