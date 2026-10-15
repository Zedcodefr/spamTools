import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Card } from '../domain/Card.ts';
import { AccountPage } from './account/AccountPage.tsx';
import { AdminPage } from './account/AdminPage.tsx';
import type { Session } from './account/AuthGate.tsx';
import { CardDetailProvider } from './card/CardDetailProvider.tsx';
import { useCardDetail } from './card/CardDetailContext.tsx';
import { CardEnvironmentProvider, type CardEnvironment } from './card/CardEnvironment.tsx';
import { CollectionPage } from './collection/CollectionPage.tsx';
import { DeckBuilderPage } from './deck/DeckBuilderPage.tsx';
import { useGateways } from './GatewaysContext.tsx';
import { SpamDexPage } from './spamdex/SpamDexPage.tsx';
import { useCatalogData } from './useCatalogData.ts';

const CARD_PARAM = 'card';

/** Pages de l'application, un chemin d'URL chacune ; l'administration est réservée aux administrateurs. */
const TOOLS = [
  { path: '/', label: 'SpamDex', adminOnly: false },
  { path: '/collection', label: 'Mes cartes', adminOnly: false },
  { path: '/deck', label: 'Deck builder', adminOnly: false },
  { path: '/compte', label: 'Mon compte', adminOnly: false },
  { path: '/admin', label: 'Administration', adminOnly: true },
] as const;

type ToolPath = (typeof TOOLS)[number]['path'];

function currentTool(): ToolPath {
  return TOOLS.find((tool) => tool.path === window.location.pathname)?.path ?? '/';
}

/** Pages qui n'ont pas besoin des cartes. */
const ACCOUNT_PAGES: ReadonlySet<ToolPath> = new Set(['/compte', '/admin']);

/** Outil affiché, synchronisé avec l'URL (navigation précédent / suivant comprise). */
function useTool(): [ToolPath, (path: ToolPath) => void] {
  const [tool, setTool] = useState<ToolPath>(currentTool);
  useEffect(() => {
    const onPopState = () => setTool(currentTool());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  const navigate = useCallback((path: ToolPath) => {
    window.history.pushState(null, '', path);
    setTool(path);
  }, []);
  return [tool, navigate];
}

export function App({ session }: { session: Session }) {
  const { catalog: gateway } = useGateways();
  const isAdmin = session.account.role === 'admin';
  const tools = TOOLS.filter((entry) => isAdmin || !entry.adminOnly);
  const [version, setVersion] = useState<string>();
  const { state, retry } = useCatalogData(version);
  const [tool, navigate] = useTool();

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
        <nav className="app__nav" aria-label="Outils">
          {tools.map((entry) => (
            <a
              key={entry.path}
              href={entry.path}
              aria-current={tool === entry.path ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
                navigate(entry.path);
              }}
            >
              {entry.label}
            </a>
          ))}
        </nav>
        <div className="app__user">
          <span>{session.account.username}</span>
          <button type="button" onClick={() => void session.signOut()}>
            Se déconnecter
          </button>
        </div>
      </header>

      <main className="app__main">
        {tool === '/compte' && <AccountPage session={session} />}
        {tool === '/admin' && (isAdmin ? <AdminPage currentAccountId={session.account.id} /> : <p className="app__state">Réservé aux administrateurs.</p>)}
        {!ACCOUNT_PAGES.has(tool) && state.status === 'loading' && <p className="app__state">Chargement des cartes…</p>}
        {!ACCOUNT_PAGES.has(tool) && state.status === 'error' && (
          <div className="app__state" role="alert">
            <p>Impossible de charger les cartes : {state.message}</p>
            <button type="button" onClick={retry}>
              Réessayer
            </button>
          </div>
        )}
        {!ACCOUNT_PAGES.has(tool) && state.status === 'ready' && environment !== null && (
          <CardEnvironmentProvider value={environment}>
            <CardDetailProvider onChange={syncUrl}>
              <OpenCardFromUrl cards={state.data.cards} />
              {tool === '/deck' && <DeckBuilderPage data={state.data} onVersionChange={setVersion} />}
              {tool === '/collection' && <CollectionPage data={state.data} onVersionChange={setVersion} />}
              {tool === '/' && <SpamDexPage data={state.data} onVersionChange={setVersion} />}
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
