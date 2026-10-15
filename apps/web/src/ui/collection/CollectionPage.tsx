import { useMemo, useState } from 'react';
import type { Card } from '../../domain/Card.ts';
import { useSession } from '../account/SessionContext.tsx';
import { CardGallery } from '../spamdex/CardGallery.tsx';
import type { CatalogData } from '../useCatalogData.ts';
import { useCollection } from './useCollection.ts';

type Show = 'all' | 'owned' | 'missing';

interface CollectionPageProps {
  readonly data: CatalogData;
  readonly onVersionChange: (version: string) => void;
}

/**
 * Mes cartes : toutes les cartes du jeu ; clic gauche pour indiquer celles que l'on possède.
 * Les boutons « tout sélectionner / désélectionner » agissent sur les cartes affichées (filtres compris).
 */
export function CollectionPage({ data, onVersionChange }: CollectionPageProps) {
  const { owned, error, setOwned } = useCollection();
  const { account, goToLogin } = useSession();
  const [show, setShow] = useState<Show>('all');

  const shown = useMemo<CatalogData>(() => {
    if (show === 'all' || owned === null) {
      return data;
    }
    return { ...data, cards: data.cards.filter((card) => owned.has(card.id) === (show === 'owned')) };
  }, [data, owned, show]);

  if (owned === null) {
    return <p className="app__state">{error ?? 'Chargement de la collection…'}</p>;
  }
  const ownedHere = data.cards.filter((card) => owned.has(card.id)).length;

  return (
    <div className="collection">
      <header className="collection__intro">
        <h2>Mes cartes</h2>
        <p>
          Indiquez les cartes que vous possédez dans le jeu. Le deck builder s’en sert ensuite : sa recherche du
          meilleur deck peut se limiter à vos cartes (« Uniquement mes cartes »).
        </p>
        <ul>
          <li>
            <strong>Clic gauche</strong> sur une carte : possédée ou non (les cartes possédées sont mises en avant).
          </li>
          <li>
            <strong>Clic droit</strong> : détail de la carte.
          </li>
          <li>
            <strong>Tout sélectionner / désélectionner</strong> agit sur les cartes affichées : filtrez d’abord (par
            exemple une rareté ou un élément), puis cochez-les toutes d’un coup.
          </li>
          <li>
            <strong>Afficher</strong> : toutes les cartes, celles que vous possédez, ou celles qui vous manquent.
          </li>
        </ul>
        {account === null ? (
          <p className="collection__login">
            Votre collection est enregistrée dans votre compte.{' '}
            <button type="button" onClick={goToLogin}>
              Se connecter
            </button>
          </p>
        ) : (
          <p className="collection__note">
            Enregistré automatiquement dans votre compte, et conservé d’une version du jeu à l’autre.
          </p>
        )}
      </header>
      {error !== null && (
        <p className="deck-panel__message deck-panel__message--error" role="alert">
          {error}
        </p>
      )}
      <CardGallery
        data={shown}
        onVersionChange={onVersionChange}
        hint="Clic gauche : je possède cette carte (ou plus). Clic droit : détail de la carte."
        onSelectCard={(card) => setOwned([card.id], !owned.has(card.id))}
        isCardSelected={(card) => owned.has(card.id)}
        toolbarExtra={(visible: readonly Card[]) => (
          <div className="collection__tools">
            <span className="collection__count">
              <strong>{ownedHere}</strong> / {data.cards.length} possédées
            </span>
            <label>
              Afficher
              <select value={show} onChange={(event) => setShow(event.target.value as Show)}>
                <option value="all">toutes</option>
                <option value="owned">possédées</option>
                <option value="missing">manquantes</option>
              </select>
            </label>
            <button type="button" onClick={() => setOwned(visible.map((card) => card.id), true)}>
              Tout sélectionner ({visible.length})
            </button>
            <button type="button" onClick={() => setOwned(visible.map((card) => card.id), false)}>
              Tout désélectionner
            </button>
          </div>
        )}
      />
    </div>
  );
}
