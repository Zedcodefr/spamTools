import type { DeckAnalysis, ElementAmounts } from '../../domain/Deck.ts';
import { useCardEnvironment } from '../card/CardEnvironment.tsx';
import { BarChart, ChartSizeProvider, ComboChart, LineChart, type ChartCategory, type ChartSize } from '../charts/Charts.tsx';
import type { AnalysisState } from './DeckBuilderPage.tsx';

const MAX_TURNS = 50;
const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const compact = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1, notation: 'compact' });
const formatValue = (value: number) => number.format(value);
const formatAxis = (value: number) => compact.format(value);
const formatPercent = (value: number) => `${number.format(value)} %`;
const turnLabel = (x: number) => (x === 0 ? 'Départ' : `Tour ${x}`);

const TOTAL = { key: 'total', label: 'Dégâts totaux', color: 'var(--chart-series-1)' };
const SINGLE = { key: 'single', label: 'Cible unique', color: 'var(--chart-series-2)' };

interface DeckAnalysisViewProps {
  readonly state: AnalysisState;
  readonly turns: number;
  readonly onTurnsChange: (turns: number) => void;
  /** Deck affiché sur tout l'écran : graphiques plus grands. */
  readonly expanded?: boolean;
}

const NORMAL_SIZE: ChartSize = { fill: false, scale: 1 };
const EXPANDED_SIZE: ChartSize = { fill: true, scale: 1.6 };

/**
 * Analyse du deck en graphiques : dégâts tour par tour (départ à 0, avant les talents),
 * dégâts et résistances par élément, éléments générés et consommés, stock de bonus par
 * élément (petits multiples), dégâts par carte. Les données restent consultables en tableaux.
 */
export function DeckAnalysisView({ state, turns, onTurnsChange, expanded = false }: DeckAnalysisViewProps) {
  const { catalog, assetUrl } = useCardEnvironment();

  if (state.status === 'empty') {
    return <p className="deck-analysis__state">Ajoutez des cartes pour analyser le deck.</p>;
  }
  if (state.status === 'error') {
    return (
      <p className="deck-analysis__state" role="alert">
        Analyse impossible : {state.message}
      </p>
    );
  }
  if (state.status === 'loading') {
    return <p className="deck-analysis__state">Analyse en cours…</p>;
  }

  const { analysis } = state;
  const elements: ChartCategory[] = [...catalog.elements.values()]
    .sort((a, b) => a.order - b.order)
    .filter((element) =>
      [
        analysis.averageResistances,
        analysis.damagePerTurn,
        analysis.healPerTurn,
        analysis.generatedPerTurn,
        analysis.consumedPerTurn,
        analysis.startingBonus,
      ].some((amounts) => amounts[element.id] !== undefined),
    )
    .map((element) => ({ key: element.id, label: element.name, icon: assetUrl(element.icon) }));
  const amount = (amounts: ElementAmounts, id: string) => amounts[id] ?? 0;
  const weak = new Set(analysis.weaknesses);
  const last = analysis.turns.at(-1);

  // Tour 0 : état de départ, avant toute action et avant l'application des talents.
  const xs = [0, ...analysis.turns.map((turn) => turn.turn)];
  const along = (pick: (turn: DeckAnalysis['turns'][number]) => number) => [0, ...analysis.turns.map(pick)];
  const stockMax = Math.max(0, ...analysis.turns.flatMap((turn) => Object.values(turn.bonusStock)));
  const stockElements = elements.filter((element) =>
    analysis.turns.some((turn) => (turn.bonusStock[element.key] ?? 0) > 0),
  );
  const hasHeal = analysis.totalHealPerTurn > 0;
  const hasConsumption = Object.keys(analysis.consumedPerTurn).length > 0;

  return (
    <section className="deck-analysis" aria-label="Analyse du deck">
      <h3>Analyse</h3>
      <p className="deck-analysis__summary">
        <strong>{number.format(analysis.totalDamagePerTurn)}</strong> dégâts totaux par tour en moyenne sur{' '}
        {analysis.turns.length} tours, dont <strong>{number.format(analysis.totalSingleTargetDamagePerTurn)}</strong> sur
        une même carte adverse
        {hasHeal && (
          <div className="deck-analysis__block deck-analysis__block--wide">
            {' '}· <strong>{number.format(analysis.totalHealPerTurn)}</strong> soins par tour
          </div>
        )}
        . Précision, critique, bonus cumulés et renforts compris
        {analysis.dpsCardId === null ? ' (aucun DPS choisi pour les renforts ciblés).' : '.'}
      </p>
      {analysis.whenAlwaysHit !== null && (
        <p className="deck-analysis__summary">
          Sac de frappe : de <strong>{number.format(analysis.totalDamagePerTurn)}</strong> (jamais frappé) à{' '}
          <strong>{number.format(analysis.whenAlwaysHit.totalDamagePerTurn)}</strong> dégâts totaux par tour (frappé{' '}
          {analysis.whenAlwaysHit.hitsPerTurn === 1 ? 'une fois' : `${analysis.whenAlwaysHit.hitsPerTurn} fois`} à
          chaque tour).
        </p>
      )}

      {/* Un bloc par graphique : empilés à côté des cartes, en grille quand le deck est agrandi. */}
      <ChartSizeProvider size={expanded ? EXPANDED_SIZE : NORMAL_SIZE}>
        <div className="deck-analysis__blocks">
          <div className="deck-analysis__block deck-analysis__block--wide">
            <h4>
              Dégâts par tour
              <label className="deck-analysis__turns">
                sur
                <input
                  type="number"
                  min={1}
                  max={MAX_TURNS}
                  value={turns}
                  onChange={(event) => onTurnsChange(Math.min(MAX_TURNS, Math.max(1, Number(event.target.value) || 1)))}
                />
                tours
              </label>
            </h4>
            <ComboChart
              xs={xs}
              xLabel={turnLabel}
              format={formatAxis}
              series={[
                { ...TOTAL, values: along((turn) => turn.totalDamage) },
                { ...SINGLE, values: along((turn) => turn.totalSingleTargetDamage) },
              ]}
              upperBounds={
                analysis.whenAlwaysHit === null
                  ? []
                  : [
                      {
                        of: TOTAL.key,
                        label: 'Totaux si toujours frappé',
                        values: [0, ...analysis.whenAlwaysHit.turns.map((turn) => turn.totalDamage)],
                      },
                    ]
              }
            />
          </div>
          {hasHeal && (
            <div className="deck-analysis__block">
              <h4>Soins par tour</h4>
              <ComboChart
                xs={xs}
                xLabel={turnLabel}
                format={formatAxis}
                height={150}
                series={[
                  { key: 'heal', label: 'Soins', color: 'var(--chart-series-1)', values: along((turn) => turn.totalHeal) },
                ]}
              />
            </div>
          )}

          <div className="deck-analysis__block">
            <h4>Dégâts moyens par élément</h4>
            <BarChart
              categories={elements.filter((element) => amount(analysis.damagePerTurn, element.key) > 0)}
              series={[TOTAL, SINGLE]}
              value={(id, series) =>
                amount(series === 'total' ? analysis.damagePerTurn : analysis.singleTargetDamagePerTurn, id)
              }
              format={formatValue}
            />
          </div>

          <div className="deck-analysis__block">
            <h4>Résistances moyennes</h4>
            <BarChart
              categories={elements.filter((element) => analysis.averageResistances[element.key] !== undefined)}
              series={[{ key: 'resistance', label: 'Résistance moyenne', color: 'var(--chart-series-1)' }]}
              value={(id) => amount(analysis.averageResistances, id)}
              format={formatPercent}
              emphasis={(id) => weak.has(id)}
              emphasisLabel="faiblesse"
            />
          </div>

          <div className="deck-analysis__block deck-analysis__block--wide">
            <h4>Éléments par tour</h4>
            <BarChart
              categories={elements.filter(
                (element) =>
                  amount(analysis.generatedPerTurn, element.key) > 0 || amount(analysis.consumedPerTurn, element.key) > 0,
              )}
              series={
                hasConsumption
                  ? [
                      { key: 'generated', label: 'Générés', color: 'var(--chart-series-1)' },
                      { key: 'consumed', label: 'Consommés', color: 'var(--chart-series-2)' },
                    ]
                  : [{ key: 'generated', label: 'Générés', color: 'var(--chart-series-1)' }]
              }
              value={(id, series) =>
                amount(series === 'generated' ? analysis.generatedPerTurn : analysis.consumedPerTurn, id)
              }
              format={formatValue}
            />
          </div>

          {stockElements.length > 0 && (
            <div className="deck-analysis__block">
              <h4>Stock de bonus par élément</h4>
              <p className="deck-analysis__muted">
                +10 % de dégâts et de soins de l'élément par point. Même échelle pour tous les éléments.
              </p>
              <div className="chart-multiples">
                {stockElements.map((element) => (
                  <LineChart
                    key={element.key}
                    compact
                    height={70}
                    maxY={stockMax}
                    xs={xs}
                    xLabel={turnLabel}
                    format={formatValue}
                    series={[
                      {
                        key: element.key,
                        label: element.label,
                        color: 'var(--chart-series-1)',
                        values: along((turn) => turn.bonusStock[element.key] ?? 0),
                      },
                    ]}
                    title={
                      <p className="chart-multiples__title">
                        {element.icon && <img src={element.icon} alt="" />}
                        {element.label}
                        <span>{number.format(last?.bonusStock[element.key] ?? 0)}</span>
                      </p>
                    }
                  />
                ))}
              </div>
            </div>
          )}

          <div className="deck-analysis__block">
            <h4>Par carte</h4>
            <BarChart
              categories={analysis.cards.map((card) => ({
                key: card.cardId,
                label: card.isDps ? `${card.cardName} (DPS)` : card.cardName,
              }))}
              labelWidth={150}
              series={[TOTAL, SINGLE]}
              value={(id, series) => {
                const card = analysis.cards.find((candidate) => candidate.cardId === id);
                return (series === 'total' ? card?.damagePerTurn : card?.singleTargetDamagePerTurn) ?? 0;
              }}
              format={formatValue}
            />
            <ul className="deck-analysis__cards">
              {analysis.cards.map((card) => (
                <li key={card.cardId}>
                  <span>
                    {card.cardName} <span className="deck-analysis__muted">· {card.talentName ?? 'aucun talent'}</span>
                  </span>
                  <BoostsLine boosts={card.finalBoosts} turn={last?.turn ?? 0} />
                </li>
              ))}
            </ul>
          </div>

          {analysis.unquantified.length > 0 && (
            <div className="deck-analysis__block">
              <h4>Non chiffré</h4>
              <ul className="deck-analysis__notes">
                {analysis.unquantified.map((note, index) => (
                  <li key={index}>
                    <strong>{note.cardName}</strong> · {note.source} : {note.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </ChartSizeProvider>

      <details className="deck-analysis__data">
        <summary>Voir les données</summary>
        <DataTables analysis={analysis} elements={elements} />
      </details>
    </section>
  );
}

/** Vue tableau des mêmes données (accessibilité, lecture précise). */
function DataTables({ analysis, elements }: { analysis: DeckAnalysis; elements: readonly ChartCategory[] }) {
  const cell = (amounts: ElementAmounts, id: string) => {
    const value = amounts[id];
    return value === undefined || value === 0 ? '–' : number.format(value);
  };
  const resistance = (id: string) => {
    const value = analysis.averageResistances[id];
    return value === undefined ? '–' : formatPercent(value);
  };
  return (
    <div className="deck-analysis__scroll">
      <table className="deck-analysis__table">
        <caption>Par élément (moyennes par tour)</caption>
        <thead>
          <tr>
            <th scope="col">Élément</th>
            <th scope="col">Rés.</th>
            <th scope="col">Dégâts</th>
            <th scope="col">Cible unique</th>
            <th scope="col">Soins</th>
            <th scope="col">Gén.</th>
            <th scope="col">Cons.</th>
            <th scope="col">Départ</th>
          </tr>
        </thead>
        <tbody>
          {elements.map((element) => (
            <tr key={element.key} data-weak={analysis.weaknesses.includes(element.key) ? '' : undefined}>
              <th scope="row">
                {element.icon && <img src={element.icon} alt="" />}
                {element.label}
              </th>
              <td>{resistance(element.key)}</td>
              <td>{cell(analysis.damagePerTurn, element.key)}</td>
              <td>{cell(analysis.singleTargetDamagePerTurn, element.key)}</td>
              <td>{cell(analysis.healPerTurn, element.key)}</td>
              <td>{cell(analysis.generatedPerTurn, element.key)}</td>
              <td>{cell(analysis.consumedPerTurn, element.key)}</td>
              <td>{cell(analysis.startingBonus, element.key)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="deck-analysis__table deck-analysis__table--turns">
        <caption>Tour par tour</caption>
        <thead>
          <tr>
            <th scope="col">Tour</th>
            <th scope="col">Dégâts</th>
            <th scope="col">Cible unique</th>
            <th scope="col">Soins</th>
            {analysis.whenAlwaysHit !== null && <th scope="col">Dégâts si frappé</th>}
          </tr>
        </thead>
        <tbody>
          {analysis.turns.map((turn, index) => (
            <tr key={turn.turn}>
              <th scope="row">{turn.turn}</th>
              <td>{number.format(turn.totalDamage)}</td>
              <td>{number.format(turn.totalSingleTargetDamage)}</td>
              <td>{turn.totalHeal > 0 ? number.format(turn.totalHeal) : '–'}</td>
              {analysis.whenAlwaysHit !== null && (
                <td>{number.format(analysis.whenAlwaysHit.turns[index]?.totalDamage ?? 0)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const BOOST_LABELS: readonly [keyof DeckAnalysis['cards'][number]['finalBoosts'], string, string][] = [
  ['precision', 'précision', ' %'],
  ['critChance', 'critique', ' %'],
  ['critMultiplier', 'multiplicateur de critique', ''],
  ['baseDamage', 'dégâts de base', ''],
  ['baseHeal', 'soins de base', ''],
];

/** Renforts cumulés d'une carte à la fin de la simulation (rien si aucun). */
function BoostsLine({ boosts, turn }: { boosts: DeckAnalysis['cards'][number]['finalBoosts']; turn: number }) {
  const parts = BOOST_LABELS.filter(([stat]) => boosts[stat] !== 0).map(
    ([stat, label, unit]) => `${boosts[stat] > 0 ? '+' : ''}${number.format(boosts[stat])}${unit} ${label}`,
  );
  return parts.length === 0 ? null : (
    <p className="deck-analysis__boosts">
      Renforts au tour {turn} : {parts.join(' · ')}
    </p>
  );
}
