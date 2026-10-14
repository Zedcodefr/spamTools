import { createContext, use } from 'react';
import type { Card } from '../../domain/Card.ts';

export interface CardDetailControls {
  open(card: Card): void;
  close(): void;
}

export const CardDetailContext = createContext<CardDetailControls | null>(null);

/** `null` hors d'un CardDetailProvider : la carte garde alors le menu contextuel du navigateur. */
export function useCardDetail(): CardDetailControls | null {
  return use(CardDetailContext);
}
