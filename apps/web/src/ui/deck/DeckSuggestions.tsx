import { useState } from 'react';
import type { Card } from '../../domain/Card.ts';
import type { DeckDraft, DeckSuggestion, SuggestionObjective } from '../../domain/Deck.ts';
import { useCollection } from '../collection/useCollection.ts';
import { useSession } from '../account/SessionContext.tsx';
import { useGateways } from '../GatewaysContext.tsx';

const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

interface DeckSuggestionsProps {
  readonly version: string;
  readonly draft: DeckDraft;
  readonly turns: number;
  readonly cardsById: ReadonlyMap<string, Card>;
  readonly onApply: (suggestion: DeckSuggestion) => void;
}

type State =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly suggestions: readonly DeckSuggestion[]; readonly complete: boolean };

/**
 * Autocomplétion : garde les cartes déjà choisies (et leur talent s'il est choisi) et complète le deck
 * pour maximiser les dégâts (totaux ou cible unique), les soins, ou un compromis des deux.
 */
export function DeckSuggestions({ version, draft, turns, cardsById, onApply }: DeckSuggestionsProps) {
  const { decks: gateway } = useGateways();
  const [objective, setObjective] = useState<SuggestionObjective>({ damage: 'total', healWeight: 0 });
  const [state, setState] = useState<State>({ status: 'idle' });
  const { owned } = useCollection();
  const { requireAccount } = useSession();
  const [onlyOwned, setOnlyOwned] = useState(false);
  const ownedCount = owned === null ? 0 : [...cardsById.keys()].filter((id) => owned.has(id)).length;

  const search = async () => {
    if (!requireAccount()) {
      return;
    }
    setState({ status: 'loading' });
    try {
      // Uniquement mes cartes : on exclut celles qu'on ne possède pas (les cartes déjà placées restent).
      const excluded =
        onlyOwned && owned !== null ? [...cardsById.keys()].filter((id) => !owned.has(id)) : [];
      const result = await gateway.suggest(version, draft.slots, objective, turns, excluded);
      setState({ status: 'ready', ...result });
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  };

  const weight = Math.round(objective.healWeight * 100);
  const goal =
    weight === 0 ? 'dégâts seuls' : weight === 100 ? 'soins seuls' : `${100 - weight} % dégâts · ${weight} % soins`;

  return (
    <section className="deck-suggestions" aria-label="Compléter le deck">
      <h3>{draft.slots.length === 0 ? 'Proposer un deck' : 'Compléter le deck'}</h3>
      <p className="deck-analysis__muted">
        {draft.slots.length === 0
          ? 'Cherche le meilleur deck selon l’objectif choisi.'
          : 'Garde les cartes choisies (et leur talent s’il est choisi) et complète le reste.'}
      </p>
      <div className="deck-suggestions__controls">
        <label>
          Dégâts
          <select
            value={objective.damage}
            onChange={(event) => setObjective({ ...objective, damage: event.target.value as SuggestionObjective['damage'] })}
          >
            <option value="total">totaux</option>
            <option value="single">cible unique</option>
          </select>
        </label>
        <label className="deck-suggestions__weight">
          Soins : {goal}
          <input
            type="range"
            min={0}
            max={100}
            step={10}
            value={weight}
            onChange={(event) => setObjective({ ...objective, healWeight: Number(event.target.value) / 100 })}
          />
        </label>
        <label className="deck-suggestions__owned" title="Ne propose que des cartes de « Mes cartes »">
          <input
            type="checkbox"
            checked={onlyOwned}
            disabled={ownedCount === 0}
            onChange={(event) => setOnlyOwned(event.target.checked)}
          />
          Uniquement mes cartes ({ownedCount})
        </label>
        <button type="button" onClick={search} disabled={state.status === 'loading'}>
          {state.status === 'loading' ? 'Recherche…' : draft.slots.length === 0 ? 'Proposer' : 'Compléter'}
        </button>
      </div>

      {state.status === 'error' && (
        <p className="deck-panel__message deck-panel__message--error" role="alert">
          {state.message}
        </p>
      )}
      {state.status === 'ready' && (
        <ol className="deck-suggestions__list">
          {state.suggestions.map((suggestion, index) => (
            <li key={index}>
              <div className="deck-suggestions__cards">
                {suggestion.slots.map((slot) => {
                  const card = cardsById.get(slot.cardId);
                  const talent = card?.talents.find((candidate) => candidate.slot === slot.talentSlot);
                  return (
                    <span key={slot.cardId}>
                      {card?.name ?? slot.cardId}
                      {talent && <span className="deck-analysis__muted"> · {talent.name}</span>}
                      {suggestion.dpsCardId === slot.cardId && <span className="deck-analysis__dps"> DPS</span>}
                    </span>
                  );
                })}
              </div>
              <p className="deck-suggestions__figures">
                {number.format(suggestion.totalDamagePerTurn)} dégâts ·{' '}
                {number.format(suggestion.totalSingleTargetDamagePerTurn)} cible unique
                {suggestion.totalHealPerTurn > 0 && <> · {number.format(suggestion.totalHealPerTurn)} soins</>} par tour
              </p>
              <button type="button" onClick={() => onApply(suggestion)}>
                Utiliser
              </button>
            </li>
          ))}
          {!state.complete && (
            <li className="deck-analysis__muted">Recherche arrêtée par sa limite de temps : meilleur résultat trouvé.</li>
          )}
        </ol>
      )}
    </section>
  );
}
