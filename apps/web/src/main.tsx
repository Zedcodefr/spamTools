import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HttpAccountsGateway, HttpAuthGateway } from './infrastructure/HttpAuthGateway.ts';
import { HttpCatalogGateway } from './infrastructure/HttpCatalogGateway.ts';
import { HttpCollectionGateway } from './infrastructure/HttpCollectionGateway.ts';
import { HttpDeckGateway } from './infrastructure/HttpDeckGateway.ts';
import { AuthGate } from './ui/account/AuthGate.tsx';
import { SessionProvider } from './ui/account/SessionContext.tsx';
import { GatewaysProvider, type Gateways } from './ui/GatewaysContext.tsx';
import './ui/styles.css';

// Racine de composition du front : on choisit ici les implémentations des ports.
const gateways: Gateways = {
  catalog: new HttpCatalogGateway(),
  decks: new HttpDeckGateway(),
  collection: new HttpCollectionGateway(),
  auth: new HttpAuthGateway(),
  accounts: new HttpAccountsGateway(),
};

const root = document.getElementById('root');
if (root === null) {
  throw new Error('Élément #root introuvable');
}

createRoot(root).render(
  <StrictMode>
    <GatewaysProvider gateways={gateways}>
      <SessionProvider>
        <AuthGate />
      </SessionProvider>
    </GatewaysProvider>
  </StrictMode>,
);
