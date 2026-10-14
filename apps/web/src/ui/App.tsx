import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Card } from '../domain/Card.ts';
import { CardDetailProvider } from './card/CardDetailProvider.tsx';
import { useCardDetail } from './card/CardDetailContext.tsx';
import { CardEnvironmentProvider, type CardEnvironment } from './card/CardEnvironment.tsx';
import { useGateways } from './GatewaysContext.tsx';
import { SpamDexPage } from './spamdex/SpamDexPage.tsx';
import { useCatalogData } from './useCatalogData.ts';

const CARD_PARAM = 'card';

export function App() {
  const { catalog: gateway } = useGateways();
  const [version, setVersion] = useState<string>();
  const { state, retry } = useCatalogData(version);

  const environment = useMemo<CardEnvironment | null>(
    () =>
      state.status === 'ready'
        ? { layout: state.data.layout, catalog: state.data.index, assetUrl: (path) => gateway.assetUrl(path) }
        : null,
    [state, gateway],
  );

  // La carte ouverte est reflétée dans l'URL (?card=<slug>) pour pouvoir partager le lien.
  const syncUrl = useCallback((card: Card | null) => {
    const url = new URL(window.location.href);
    if (card === null) {
      url.searchParams.delete(CARD_PARAM);
    } else {
      url.searchParams.set(CARD_PARAM, card.slug);
    }
    window.history.replaceState(null, '', url);
  }, []);

  return (
    <div className="app">
      <header className="app__header">
        <h1>spamTools</h1>
        <span className="app__section">SpamDex</span>
      </header>

      <main className="app__main">
        {state.status === 'loading' && <p className="app__state">Chargement des cartes…</p>}
        {state.status === 'error' && (
          <div className="app__state" role="alert">
            <p>Impossible de charger les cartes : {state.message}</p>
            <button type="button" onClick={retry}>
              Réessayer
            </button>
          </div>
        )}
        {state.status === 'ready' && environment !== null && (
          <CardEnvironmentProvider value={environment}>
            <CardDetailProvider onChange={syncUrl}>
              <OpenCardFromUrl cards={state.data.cards} />
              <SpamDexPage data={state.data} onVersionChange={setVersion} />
            </CardDetailProvider>
          </CardEnvironmentProvider>
        )}
      </main>

      <footer className="app__footer">
        <p>
          Projet non officiel, sans lien avec Ticroco. « Spam » et ses contenus appartiennent à leurs ayants droit.
        </p>
        <p>
          Données des cartes : <a href="https://spamgame.com/spamdex">spamgame.com</a>, selon leurs{' '}
          <a href="https://spamgame.com/conditions-donnees-cartes">conditions d'utilisation</a>. Les illustrations
          sont l'œuvre de leurs artistes, crédités sous chaque carte.
        </p>
      </footer>
    </div>
  );
}

/** Ouvre au chargement la carte indiquée dans l'URL, le cas échéant. */
function OpenCardFromUrl({ cards }: { cards: readonly Card[] }) {
  const detail = useCardDetail();
  useEffect(() => {
    const slug = new URL(window.location.href).searchParams.get(CARD_PARAM);
    const card = cards.find((candidate) => candidate.slug === slug);
    if (card !== undefined) {
      detail?.open(card);
    }
    // Uniquement au premier affichage des cartes.
  }, []);
  return null;
}
