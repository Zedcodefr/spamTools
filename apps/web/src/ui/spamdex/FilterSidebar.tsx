import { Palette, Sparkles } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import type { Card, Talent } from '../../domain/Card.ts';
import type { CatalogOverview, TraitCategory } from '../../domain/Catalog.ts';
import {
  hasActiveFilters,
  NO_FILTERS,
  type CardFilters,
  type NumberRange,
  type SelectionFilter,
} from '../../domain/cardQuery.ts';
import { TraitIcon } from '../card/TraitIcon.tsx';

interface FilterSidebarProps {
  readonly catalog: CatalogOverview;
  /** Toutes les cartes de la version : base de la liste des talents. */
  readonly cards: readonly Card[];
  /** Cartes affichées avec les filtres actuels : base des compteurs de chaque facette. */
  readonly visibleCards: readonly Card[];
  readonly filters: CardFilters;
  readonly onChange: (filters: CardFilters) => void;
  readonly assetUrl: (path: string) => string;
}

/**
 * Filtres de la galerie, regroupés par thèmes repliables, une facette par ligne.
 * Élément de la carte et rareté : l'une des valeurs choisies. Autres facettes : toutes celles choisies.
 */
export function FilterSidebar({ catalog, cards, visibleCards, filters, onChange, assetUrl }: FilterSidebarProps) {
  const toggle = (group: SelectionFilter, id: string) => {
    const next = new Set(filters[group]);
    if (!next.delete(id)) {
      next.add(id);
    }
    onChange({ ...filters, [group]: next });
  };
  const count = (has: (card: Card) => boolean) => visibleCards.filter(has).length;

  const elementRow = (group: SelectionFilter, label: string, hint: string) => (
    <div className="filters__element-row">
      <span className="filters__row-label" title={hint}>
        {label}
      </span>
      <div className="filters__toggles">
        {catalog.elements.map((element) => (
          <button
            key={element.id}
            type="button"
            className="filters__toggle"
            aria-pressed={filters[group].has(element.id)}
            title={`${label} : ${element.name}`}
            onClick={() => toggle(group, element.id)}
          >
            <img src={assetUrl(element.icon)} alt={element.name} />
          </button>
        ))}
      </div>
    </div>
  );

  const categoryTheme = (category: TraitCategory) => {
    const abilities = catalog.specialAbilities.filter((special) => special.category === category.id);
    const selected =
      (filters.categories.has(category.id) ? 1 : 0) +
      abilities.filter((special) => filters.specialAbilities.has(special.key)).length;
    return (
      <Theme key={category.id} title={category.label} icon={<TraitIcon icon={category.icon} />} selected={selected}>
        <Facet
          icon={<TraitIcon icon={category.icon} size={16} />}
          label={`Toute la catégorie ${category.label.toLowerCase()}`}
          hint={category.description}
          pressed={filters.categories.has(category.id)}
          count={count((card) => card.traits.categories.includes(category.id))}
          onToggle={() => toggle('categories', category.id)}
        />
        {abilities.map((special) => (
          <Facet
            key={special.key}
            icon={<TraitIcon icon={special.icon} size={16} />}
            label={special.label}
            hint={special.description ?? undefined}
            pressed={filters.specialAbilities.has(special.key)}
            count={count((card) => card.traits.specialAbilities.includes(special.key))}
            onToggle={() => toggle('specialAbilities', special.key)}
          />
        ))}
      </Theme>
    );
  };

  const elementSelections =
    filters.elements.size + filters.strikeElements.size + filters.bonusElements.size + filters.healElements.size;

  return (
    <aside className="filters" aria-label="Filtres">
      <div className="filters__title">
        <h2>Filtres</h2>
        <button type="button" onClick={() => onChange(NO_FILTERS)} disabled={!hasActiveFilters(filters)}>
          Réinitialiser
        </button>
      </div>

      <input
        type="search"
        className="filters__search"
        placeholder="Nom, artiste, capacité, tox…"
        aria-label="Rechercher"
        value={filters.text}
        onChange={(event) => onChange({ ...filters, text: event.target.value })}
      />

      <TalentTheme
        cards={cards}
        selection={filters.talents}
        count={(id) => count((card) => card.talents.some((talent) => talent.id === id))}
        onToggle={(id) => toggle('talents', id)}
      />

      <Theme title="Éléments" selected={elementSelections + (filters.multiElement ? 1 : 0)} initiallyOpen>
        {elementRow('elements', 'Carte', "Élément propre à la carte (l'un de ceux choisis)")}
        {elementRow('strikeElements', 'Frappe', 'Éléments dans lesquels ses capacités infligent des dégâts')}
        {elementRow('bonusElements', 'Bonus', 'Bonus élémentaires de ses capacités et de ses passifs naturels')}
        {elementRow('healElements', 'Soin', 'Éléments dans lesquels ses capacités soignent')}
        <Facet
          icon={<Palette size={16} aria-hidden="true" />}
          label="Multiélément"
          hint="Agit dans un élément aléatoire ou dans tous les éléments à la fois"
          pressed={filters.multiElement}
          count={count((card) => card.traits.multiElement)}
          onToggle={() => onChange({ ...filters, multiElement: !filters.multiElement })}
        />
      </Theme>

      <Theme title="Rareté" selected={filters.rarities.size}>
        <div className="filters__toggles">
          {catalog.rarities.map((rarity) => (
            <button
              key={rarity.id}
              type="button"
              className="filters__toggle filters__toggle--gem"
              aria-pressed={filters.rarities.has(rarity.id)}
              title={rarity.name}
              onClick={() => toggle('rarities', rarity.id)}
            >
              <img src={assetUrl(rarity.gem)} alt={rarity.name} />
            </button>
          ))}
        </div>
      </Theme>

      {catalog.traitCategories.map(categoryTheme)}

      <Theme
        title="Statistiques"
        selected={[filters.hp, filters.spamton].filter((range) => range.min !== null || range.max !== null).length}
      >
        <RangeFilter label="PV" range={filters.hp} onChange={(hp) => onChange({ ...filters, hp })} />
        <RangeFilter label="Spamton" range={filters.spamton} onChange={(spamton) => onChange({ ...filters, spamton })} />
      </Theme>
    </aside>
  );
}

/**
 * Talents présents sur au moins une carte, dans l'ordre alphabétique, avec une recherche
 * pour s'y retrouver parmi la centaine. Les talents choisis restent en tête de liste.
 */
function TalentTheme({
  cards,
  selection,
  count,
  onToggle,
}: {
  cards: readonly Card[];
  selection: ReadonlySet<string>;
  count: (id: string) => number;
  onToggle: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const talents = useMemo(() => {
    const byId = new Map<string, Talent>();
    for (const card of cards) {
      for (const talent of card.talents) {
        byId.set(talent.id, talent);
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [cards]);

  const needle = normalize(search.trim());
  const shown = talents.filter(
    (talent) =>
      selection.has(talent.id) ||
      needle === '' ||
      normalize(talent.name).includes(needle) ||
      normalize(talent.effect).includes(needle),
  );
  const ordered = [...shown.filter((talent) => selection.has(talent.id)), ...shown.filter((talent) => !selection.has(talent.id))];

  return (
    <Theme title="Talents" icon={<Sparkles size={18} aria-hidden="true" />} selected={selection.size}>
      <input
        type="search"
        className="filters__search"
        placeholder="Chercher un talent…"
        aria-label="Chercher un talent"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="filters__list">
        {ordered.map((talent) => (
          <Facet
            key={talent.id}
            icon={<Sparkles size={16} aria-hidden="true" />}
            label={talent.name}
            hint={talent.effect}
            pressed={selection.has(talent.id)}
            count={count(talent.id)}
            onToggle={() => onToggle(talent.id)}
          />
        ))}
        {ordered.length === 0 && <p className="filters__none">Aucun talent trouvé.</p>}
      </div>
    </Theme>
  );
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** Thème repliable ; le nombre de facettes actives reste visible une fois replié. */
function Theme({
  title,
  icon,
  selected,
  initiallyOpen = false,
  children,
}: {
  title: string;
  icon?: ReactNode;
  selected: number;
  initiallyOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <details className="filters__theme" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        {icon}
        <span className="filters__theme-title">{title}</span>
        {selected > 0 && (
          <span className="filters__badge" aria-label={`${selected} filtre(s) actif(s)`}>
            {selected}
          </span>
        )}
      </summary>
      <div className="filters__theme-body">{children}</div>
    </details>
  );
}

/** Une facette par ligne : icône, libellé, nombre de cartes affichées qui l'ont. */
function Facet({
  icon,
  label,
  hint,
  pressed,
  count,
  onToggle,
}: {
  icon: ReactNode;
  label: string;
  hint: string | undefined;
  pressed: boolean;
  count: number;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="filters__facet"
      aria-pressed={pressed}
      // Aucune carte affichée ne l'a : la cocher viderait les résultats.
      data-empty={count === 0 && !pressed ? '' : undefined}
      title={hint}
      onClick={onToggle}
    >
      {icon}
      <span className="filters__facet-label">{label}</span>
      <span className="filters__facet-count">{count}</span>
    </button>
  );
}

function RangeFilter({
  label,
  range,
  onChange,
}: {
  label: string;
  range: NumberRange;
  onChange: (range: NumberRange) => void;
}) {
  const parse = (value: string): number | null => (value.trim() === '' ? null : Number(value));
  return (
    <fieldset>
      <legend>{label}</legend>
      <div className="filters__range">
        <label>
          Minimum
          <input
            type="number"
            min={0}
            value={range.min ?? ''}
            onChange={(event) => onChange({ ...range, min: parse(event.target.value) })}
          />
        </label>
        <label>
          Maximum
          <input
            type="number"
            min={0}
            value={range.max ?? ''}
            onChange={(event) => onChange({ ...range, max: parse(event.target.value) })}
          />
        </label>
      </div>
    </fieldset>
  );
}
