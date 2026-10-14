import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App.tsx';
import { GatewaysProvider, type Gateways } from './ui/GatewaysContext.tsx';

// Racine de composition du front : on choisit ici les implémentations des ports.
const gateways: Gateways = {};

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
