import { useDeferredValue, useMemo, useState } from 'react';
import { filterCards, NO_FILTERS, SORT_LABELS, sortCards, type CardSort, type SortKey } from '../../domain/cardQuery.ts';
import { GameCard } from '../card/GameCard.tsx';
import { useCardEnvironment } from '../card/CardEnvironment.tsx';
import type { CatalogData } from '../useCatalogData.ts';
import { FilterSidebar } from './FilterSidebar.tsx';
import './SpamDex.css';

const CARD_WIDTHS = { min: 140, max: 320, initial: 200 };

interface SpamDexPageProps {
  readonly data: CatalogData;
  readonly onVersionChange: (version: string) => void;
}

/**
 * Galerie des cartes : filtres, tri et taille d'affichage.
 * Un clic droit sur une carte ouvre sa vue détail.
 */
export function SpamDexPage({ data, onVersionChange }: SpamDexPageProps) {
  const { assetUrl } = useCardEnvironment();
  const [filters, setFilters] = useState(NO_FILTERS);
  const [sort, setSort] = useState<CardSort>({ key: 'number', descending: false });
  const [cardWidth, setCardWidth] = useState(CARD_WIDTHS.initial);

  // La saisie reste fluide : le filtrage se recalcule avec une priorité moindre.
  const deferredFilters = useDeferredValue(filters);
  const visibleCards = useMemo(
    () => sortCards(filterCards(data.cards, deferredFilters), sort, data.index),
    [data, deferredFilters, sort],
  );

  return (
    <div className="spamdex">
      <FilterSidebar
        catalog={data.catalog}
        visibleCards={visibleCards}
        filters={filters}
        onChange={setFilters}
        assetUrl={assetUrl}
      />

      <section className="spamdex__main" aria-label="Cartes">
        <div className="spamdex__toolbar">
          <p className="spamdex__count" aria-live="polite">
            {visibleCards.length} carte{visibleCards.length > 1 ? 's' : ''}
          </p>

          <label>
            Version
            <select value={data.catalog.version} onChange={(event) => onVersionChange(event.target.value)}>
              {data.catalog.availableVersions.map((version) => (
                <option key={version} value={version}>
                  {version}
                </option>
              ))}
            </select>
          </label>

          <label>
            Triée par
            <select value={sort.key} onChange={(event) => setSort({ ...sort, key: event.target.value as SortKey })}>
              {Object.entries(SORT_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setSort({ ...sort, descending: !sort.descending })}
            aria-label={sort.descending ? 'Ordre décroissant' : 'Ordre croissant'}
            title={sort.descending ? 'Ordre décroissant' : 'Ordre croissant'}
          >
            {sort.descending ? '▼' : '▲'}
          </button>

          <label className="spamdex__size">
            Taille
            <input
              type="range"
              min={CARD_WIDTHS.min}
              max={CARD_WIDTHS.max}
              step={10}
              value={cardWidth}
              onChange={(event) => setCardWidth(Number(event.target.value))}
            />
          </label>
        </div>

        <p className="spamdex__hint">Clic droit sur une carte pour afficher son détail.</p>

        {visibleCards.length === 0 ? (
          <div className="spamdex__empty">
            <p>Aucune carte ne correspond à ces filtres.</p>
            <button type="button" onClick={() => setFilters(NO_FILTERS)}>
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <div className="spamdex__grid" style={{ ['--card-width' as string]: `${cardWidth}px` }}>
            {visibleCards.map((card) => (
              <GameCard key={card.id} card={card} width={cardWidth} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
