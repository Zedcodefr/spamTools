import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HttpCatalogGateway } from './infrastructure/HttpCatalogGateway.ts';
import { App } from './ui/App.tsx';
import { GatewaysProvider, type Gateways } from './ui/GatewaysContext.tsx';
import './ui/styles.css';

// Racine de composition du front : on choisit ici les implémentations des ports.
const gateways: Gateways = {
  catalog: new HttpCatalogGateway(),
};

const root = document.getElementById('root');
if (root === null) {
  throw new Error('Élément #root introuvable');
}

createRoot(root).render(
  <StrictMode>
    <GatewaysProvider gateways={gateways}>
      <App />
    </GatewaysProvider>
  </StrictMode>,
);
