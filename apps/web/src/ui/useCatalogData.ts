import { useCallback, useEffect, useState } from 'react';
import type { Card } from '../domain/Card.ts';
import type { CardLayout } from '../domain/CardLayout.ts';
import { indexCatalog, type CatalogIndex, type CatalogOverview } from '../domain/Catalog.ts';
import { useGateways } from './GatewaysContext.tsx';

export interface CatalogData {
  readonly catalog: CatalogOverview;
  readonly index: CatalogIndex;
  readonly cards: readonly Card[];
  readonly layout: CardLayout;
}

export type CatalogDataState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly data: CatalogData };

/** Charge le catalogue d'une version (la plus récente par défaut), ses cartes et le plan de rendu. */
export function useCatalogData(version: string | undefined): { state: CatalogDataState; retry: () => void } {
  const { catalog: gateway } = useGateways();
  const [state, setState] = useState<CatalogDataState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    Promise.all([gateway.getCatalog(version), gateway.listCards(version), gateway.getCardLayout()]).then(
      ([catalog, cards, layout]) => {
        if (!cancelled) {
          setState({ status: 'ready', data: { catalog, index: indexCatalog(catalog), cards, layout } });
        }
      },
      (error: unknown) => {
        if (!cancelled) {
          setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [gateway, version, attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  return { state, retry };
}
