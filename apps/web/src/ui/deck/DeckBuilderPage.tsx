import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Card } from '../../domain/Card.ts';
import {
  DECK_SIZE,
  EMPTY_DRAFT,
  isFull,
  removeCard,
  setTalent,
  toggleCard,
  type DeckAnalysis,
  type DeckDraft,
  type DeckView,
} from '../../domain/Deck.ts';
import { GameCard } from '../card/GameCard.tsx';
import { useGateways } from '../GatewaysContext.tsx';
import { CardGallery } from '../spamdex/CardGallery.tsx';
import type { CatalogData } from '../useCatalogData.ts';
import { DeckAnalysisView } from './DeckAnalysisView.tsx';
import './DeckBuilder.css';

const DEFAULT_TURNS = 10;
const SLOT_CARD_WIDTH = 120;

interface DeckBuilderPageProps {
  readonly data: CatalogData;
  readonly onVersionChange: (version: string) => void;
}

/**
 * Deck builder : clic gauche sur une carte de la galerie pour l'ajouter au deck (ou l'en retirer),
 * choix d'un talent par carte, analyse en direct et decks enregistrés.
 */
export function DeckBuilderPage({ data, onVersionChange }: DeckBuilderPageProps) {
  const { decks: gateway } = useGateways();
  const [draft, setDraft] = useState<DeckDraft>(EMPTY_DRAFT);
  const [savedDecks, setSavedDecks] = useState<readonly DeckView[]>([]);
  const [message, setMessage] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const [turns, setTurns] = useState(DEFAULT_TURNS);
  const analysis = useDeckAnalysis(data.catalog.version, draft, turns);

  const cardsById = useMemo(() => new Map(data.cards.map((card) => [card.id, card])), [data.cards]);
  const inDeck = useMemo(() => new Set(draft.slots.map((slot) => slot.cardId)), [draft.slots]);

  const refreshDecks = useCallback(() => {
    gateway.list().then(setSavedDecks, (error: unknown) => setMessage({ kind: 'error', text: String(error) }));
  }, [gateway]);
  useEffect(refreshDecks, [refreshDecks]);

  const select = (card: Card) => {
    if (!inDeck.has(card.id) && isFull(draft)) {
      setMessage({ kind: 'info', text: `Le deck compte déjà ${DECK_SIZE} cartes : retirez-en une d'abord.` });
      return;
    }
    setMessage(null);
    setDraft(toggleCard(draft, card.id));
  };

  const save = async () => {
    try {
      const name = draft.name.trim() || 'Deck sans nom';
      const saved = await gateway.save({ ...draft, name, version: data.catalog.version });
      setDraft({ id: saved.id, name: saved.name, slots: saved.slots });
      setMessage({ kind: 'info', text: `Deck « ${saved.name} » enregistré.` });
      refreshDecks();
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : String(error) });
    }
  };

  const remove = async () => {
    if (draft.id === null) {
      return;
    }
    try {
      await gateway.delete(draft.id);
      setDraft(EMPTY_DRAFT);
      setMessage({ kind: 'info', text: 'Deck supprimé.' });
      refreshDecks();
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : String(error) });
    }
  };

  const open = (deck: DeckView) => {
    setDraft({ id: deck.id, name: deck.name, slots: deck.slots });
    setMessage(null);
    if (deck.version !== data.catalog.version) {
      onVersionChange(deck.version);
    }
  };

  return (
    <div className="deck-builder">
      <div className="deck-builder__gallery">
        <CardGallery
          data={data}
          onVersionChange={onVersionChange}
          initialCardWidth={150}
          hint="Clic gauche : ajouter au deck ou retirer. Clic droit : détail de la carte."
          onSelectCard={select}
          isCardSelected={(card) => inDeck.has(card.id)}
        />
      </div>

      <aside className="deck-panel" aria-label="Deck">
        <div className="deck-panel__head">
          <input
            className="deck-panel__name"
            aria-label="Nom du deck"
            placeholder="Nom du deck"
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
          <select
            aria-label="Decks enregistrés"
            value={draft.id ?? ''}
            onChange={(event) => {
              const deck = savedDecks.find((candidate) => candidate.id === event.target.value);
              if (deck === undefined) {
                setDraft(EMPTY_DRAFT);
              } else {
                open(deck);
              }
            }}
          >
            <option value="">Nouveau deck</option>
            {savedDecks.map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.name} ({deck.version})
              </option>
            ))}
          </select>
        </div>

        <div className="deck-panel__actions">
          <button type="button" onClick={save} disabled={draft.slots.length === 0}>
            {draft.id === null ? 'Enregistrer' : 'Mettre à jour'}
          </button>
          <button
            type="button"
            onClick={() => setDraft(EMPTY_DRAFT)}
            disabled={draft.id === null && draft.name === '' && draft.slots.length === 0}
          >
            Vider
          </button>
          {draft.id !== null && (
            <button type="button" onClick={remove}>
              Supprimer
            </button>
          )}
        </div>
        {message !== null && (
          <p className={`deck-panel__message deck-panel__message--${message.kind}`} role="status">
            {message.text}
          </p>
        )}

        <ol className="deck-panel__slots">
          {Array.from({ length: DECK_SIZE }, (_, index) => {
            const slot = draft.slots[index];
            const card = slot === undefined ? undefined : cardsById.get(slot.cardId);
            if (slot === undefined || card === undefined) {
              return (
                <li key={`empty-${index}`} className="deck-slot deck-slot--empty">
                  {slot === undefined ? 'Emplacement libre' : 'Carte absente de cette version'}
                </li>
              );
            }
            const talent = card.talents.find((candidate) => candidate.slot === slot.talentSlot);
            return (
              <li key={card.id} className="deck-slot">
                <GameCard card={card} width={SLOT_CARD_WIDTH} showCredit />
                <div className="deck-slot__talent">
                  <label>
                    Talent
                    <select
                      value={slot.talentSlot}
                      onChange={(event) => setDraft(setTalent(draft, card.id, Number(event.target.value)))}
                    >
                      {[...card.talents]
                        .sort((a, b) => a.slot - b.slot)
                        .map((candidate) => (
                          <option key={candidate.slot} value={candidate.slot}>
                            {candidate.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  {talent && <p className="deck-slot__talent-effect">{talent.effect}</p>}
                  <button type="button" onClick={() => setDraft(removeCard(draft, card.id))}>
                    Retirer
                  </button>
                </div>
              </li>
            );
          })}
        </ol>

        <DeckAnalysisView state={analysis} turns={turns} onTurnsChange={setTurns} />
      </aside>
    </div>
  );
}

export type AnalysisState =
  | { readonly status: 'empty' }
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly analysis: DeckAnalysis };

/** Analyse recalculée (par l'API) à chaque changement de composition, de talent ou d'horizon. */
function useDeckAnalysis(version: string, draft: DeckDraft, turns: number): AnalysisState {
  const { decks: gateway } = useGateways();
  const [state, setState] = useState<AnalysisState>({ status: 'empty' });
  const slotsKey = JSON.stringify(draft.slots);

  useEffect(() => {
    const slots = JSON.parse(slotsKey) as DeckDraft['slots'];
    if (slots.length === 0) {
      setState({ status: 'empty' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    gateway.analyze(version, slots, turns).then(
      (analysis) => !cancelled && setState({ status: 'ready', analysis }),
      (error: unknown) =>
        !cancelled && setState({ status: 'error', message: error instanceof Error ? error.message : String(error) }),
    );
    return () => {
      cancelled = true;
    };
  }, [gateway, version, slotsKey, turns]);

  return state;
}
