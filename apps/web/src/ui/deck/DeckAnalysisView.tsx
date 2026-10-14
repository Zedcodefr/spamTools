import type { ElementAmounts } from '../../domain/Deck.ts';
import { useCardEnvironment } from '../card/CardEnvironment.tsx';
import type { AnalysisState } from './DeckBuilderPage.tsx';

const MAX_TURNS = 50;
const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

interface DeckAnalysisViewProps {
  readonly state: AnalysisState;
  readonly turns: number;
  readonly onTurnsChange: (turns: number) => void;
}

/**
 * Analyse du deck, élément par élément : résistances moyennes (faiblesses en évidence),
 * dégâts et soins par tour, éléments générés et consommés, puis projection des bonus cumulés.
 */
export function DeckAnalysisView({ state, turns, onTurnsChange }: DeckAnalysisViewProps) {
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
  const elementIds = [...catalog.elements.values()]
    .sort((a, b) => a.order - b.order)
    .map((element) => element.id)
    .filter((id) =>
      [
        analysis.averageResistances,
        analysis.damagePerTurn,
        analysis.healPerTurn,
        analysis.generatedPerTurn,
        analysis.consumedPerTurn,
        analysis.startingBonus,
      ].some((amounts) => amounts[id] !== undefined),
    );
  const weak = new Set(analysis.weaknesses);
  const cell = (amounts: ElementAmounts, id: string) => {
    const value = amounts[id];
    return value === undefined || value === 0 ? '–' : number.format(value);
  };

  return (
    <section className="deck-analysis" aria-label="Analyse du deck">
      <h3>Analyse</h3>
      <p className="deck-analysis__summary">
        <strong>{number.format(analysis.totalDamagePerTurn)}</strong> dégâts par tour sans bonus ·{' '}
        <strong>{number.format(analysis.averageTotalDamagePerTurn)}</strong> en moyenne sur {analysis.turns.length} tours,
        bonus cumulés compris
        {analysis.averageTotalHealPerTurn > 0 && (
          <>
            {' '}· <strong>{number.format(analysis.averageTotalHealPerTurn)}</strong> soins par tour
          </>
        )}
      </p>

      <div className="deck-analysis__scroll">
        <table className="deck-analysis__table">
          <thead>
            <tr>
              <th scope="col">Élément</th>
              <th scope="col" title="Résistance moyenne des cartes (%), talents et bonus d'équipe compris">
                Rés.
              </th>
              <th scope="col" title="Dégâts par tour, sans bonus élémentaires">
                Dégâts
              </th>
              <th scope="col" title={`Dégâts par tour en moyenne sur ${analysis.turns.length} tours, bonus cumulés compris`}>
                + bonus
              </th>
              <th scope="col" title={`Soins par tour en moyenne sur ${analysis.turns.length} tours, bonus cumulés compris`}>
                Soins
              </th>
              <th scope="col" title="Éléments générés par tour">
                Gén.
              </th>
              <th scope="col" title="Éléments consommés par tour (coûts)">
                Cons.
              </th>
              <th scope="col" title="Éléments obtenus en début de partie">
                Départ
              </th>
            </tr>
          </thead>
          <tbody>
            {elementIds.map((id) => {
              const element = catalog.elements.get(id);
              return (
                <tr key={id} data-weak={weak.has(id) ? '' : undefined}>
                  <th scope="row">
                    {element && <img src={assetUrl(element.icon)} alt="" />}
                    {element?.name ?? id}
                  </th>
                  <td title={weak.has(id) ? 'Faiblesse : résistance moyenne la plus basse' : undefined}>
                    {cell(analysis.averageResistances, id)}
                    {analysis.averageResistances[id] !== undefined && ' %'}
                  </td>
                  <td>{cell(analysis.damagePerTurn, id)}</td>
                  <td>{cell(analysis.averageDamagePerTurn, id)}</td>
                  <td>{cell(analysis.averageHealPerTurn, id)}</td>
                  <td>{cell(analysis.generatedPerTurn, id)}</td>
                  <td>{cell(analysis.consumedPerTurn, id)}</td>
                  <td>{cell(analysis.startingBonus, id)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {analysis.weaknesses.length > 0 && (
        <p className="deck-analysis__weakness">
          Faiblesse :{' '}
          {analysis.weaknesses.map((id) => catalog.elements.get(id)?.name ?? id).join(', ')} (
          {number.format(analysis.averageResistances[analysis.weaknesses[0] ?? ''] ?? 0)} % en moyenne)
        </p>
      )}

      <h4>Par carte</h4>
      <ul className="deck-analysis__cards">
        {analysis.cards.map((card) => (
          <li key={card.cardId}>
            <span>
              {card.cardName} <span className="deck-analysis__muted">· {card.talentName}</span>
            </span>
            <span>
              {number.format(card.damagePerTurn)} dégâts · {number.format(card.generatedPerTurn)} éléments / tour
            </span>
          </li>
        ))}
      </ul>

      <h4>
        Projection des bonus cumulés
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
      <p className="deck-analysis__muted">
        Chaque point de bonus d'un élément ajoute 10 % aux dégâts et soins de cet élément ; le stock gagne les éléments
        générés et perd ceux consommés à chaque tour.
      </p>
      <div className="deck-analysis__scroll">
        <table className="deck-analysis__table deck-analysis__table--turns">
          <thead>
            <tr>
              <th scope="col">Tour</th>
              <th scope="col">Dégâts</th>
              <th scope="col">Soins</th>
              <th scope="col">Stock de bonus</th>
            </tr>
          </thead>
          <tbody>
            {analysis.turns.map((turn) => (
              <tr key={turn.turn}>
                <th scope="row">{turn.turn}</th>
                <td>{number.format(turn.totalDamage)}</td>
                <td>{turn.totalHeal > 0 ? number.format(turn.totalHeal) : '–'}</td>
                <td className="deck-analysis__stock">
                  {elementIds
                    .filter((id) => (turn.bonusStock[id] ?? 0) > 0)
                    .map((id) => {
                      const element = catalog.elements.get(id);
                      return (
                        <span key={id} title={element?.name}>
                          {element && <img src={assetUrl(element.icon)} alt={element.name} />}
                          {number.format(turn.bonusStock[id] ?? 0)}
                        </span>
                      );
                    })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {analysis.unquantified.length > 0 && (
        <>
          <h4>Non chiffré</h4>
          <ul className="deck-analysis__notes">
            {analysis.unquantified.map((note, index) => (
              <li key={index}>
                <strong>{note.cardName}</strong> · {note.source} : {note.reason}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
