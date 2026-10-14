import { createContext, use, type ReactNode } from 'react';
import type { CardLayout } from '../../domain/CardLayout.ts';
import type { CatalogIndex } from '../../domain/Catalog.ts';

/**
 * Ce qu'il faut pour dessiner n'importe quelle carte : plan de rendu, référentiels
 * (éléments, raretés, mots-clés) et résolution des URL d'images.
 * Fourni une fois en haut de l'application, utilisé par tous les composants de carte.
 */
export interface CardEnvironment {
  readonly layout: CardLayout;
  readonly catalog: CatalogIndex;
  readonly assetUrl: (path: string) => string;
}

const CardEnvironmentContext = createContext<CardEnvironment | null>(null);

export function CardEnvironmentProvider({ value, children }: { value: CardEnvironment; children: ReactNode }) {
  return <CardEnvironmentContext value={value}>{children}</CardEnvironmentContext>;
}

export function useCardEnvironment(): CardEnvironment {
  const environment = use(CardEnvironmentContext);
  if (environment === null) {
    throw new Error('useCardEnvironment doit être utilisé sous <CardEnvironmentProvider>');
  }
  return environment;
}
