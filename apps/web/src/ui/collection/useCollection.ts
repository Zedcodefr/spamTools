import { useCallback, useEffect, useState } from 'react';
import { useGateways } from '../GatewaysContext.tsx';

export interface CollectionState {
  /** null tant que la collection n'est pas chargée. */
  readonly owned: ReadonlySet<string> | null;
  readonly error: string | null;
  /** Ajoute ou retire des cartes : affiché tout de suite, puis enregistré (rechargé en cas d'échec). */
  readonly setOwned: (cardIds: readonly string[], owned: boolean) => void;
}

export function useCollection(): CollectionState {
  const { collection: gateway } = useGateways();
  const [owned, setOwnedIds] = useState<ReadonlySet<string> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    gateway.get().then(
      (ids) => setOwnedIds(new Set(ids)),
      (cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)),
    );
  }, [gateway]);

  const setOwned = useCallback(
    (cardIds: readonly string[], value: boolean) => {
      if (cardIds.length === 0) {
        return;
      }
      setOwnedIds((current) => {
        const next = new Set(current ?? []);
        cardIds.forEach((id) => (value ? next.add(id) : next.delete(id)));
        return next;
      });
      setError(null);
      gateway.set(cardIds, value).then(
        (ids) => setOwnedIds(new Set(ids)),
        (cause: unknown) => {
          setError(cause instanceof Error ? cause.message : String(cause));
          gateway.get().then(
            (ids) => setOwnedIds(new Set(ids)),
            () => undefined,
          );
        },
      );
    },
    [gateway],
  );

  return { owned, error, setOwned };
}
