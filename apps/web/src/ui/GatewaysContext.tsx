import { createContext, use, type ReactNode } from 'react';
import type { CatalogGateway } from '../application/ports/CatalogGateway.ts';
import type { DeckGateway } from '../application/ports/DeckGateway.ts';

/**
 * Injection de dépendances "à la React" : les composants récupèrent
 * les ports via ce Context, sans connaître leur implémentation.
 */
export interface Gateways {
  readonly catalog: CatalogGateway;
  readonly decks: DeckGateway;
}

const GatewaysContext = createContext<Gateways | null>(null);

export function GatewaysProvider({ gateways, children }: { gateways: Gateways; children: ReactNode }) {
  return <GatewaysContext value={gateways}>{children}</GatewaysContext>;
}

export function useGateways(): Gateways {
  // `use` (React 19) lit un Context, comme useContext.
  const gateways = use(GatewaysContext);
  if (gateways === null) {
    throw new Error('useGateways doit être utilisé sous <GatewaysProvider>');
  }
  return gateways;
}
