import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { Card } from '../../domain/Card.ts';
import { CardDetail } from './CardDetail.tsx';
import { CardDetailContext, type CardDetailControls } from './CardDetailContext.tsx';

/**
 * Rend la vue détail disponible pour toutes les cartes affichées en dessous :
 * un clic droit sur une carte l'ouvre. `onChange` permet par exemple de refléter
 * la carte ouverte dans l'URL.
 */
export function CardDetailProvider({
  children,
  onChange,
}: {
  children: ReactNode;
  onChange?: (card: Card | null) => void;
}) {
  const [card, setCard] = useState<Card | null>(null);

  const show = useCallback(
    (next: Card | null) => {
      setCard(next);
      onChange?.(next);
    },
    [onChange],
  );
  const controls = useMemo<CardDetailControls>(() => ({ open: show, close: () => show(null) }), [show]);

  return (
    <CardDetailContext value={controls}>
      {children}
      {card !== null && <CardDetail key={card.id} card={card} onClose={controls.close} />}
    </CardDetailContext>
  );
}
