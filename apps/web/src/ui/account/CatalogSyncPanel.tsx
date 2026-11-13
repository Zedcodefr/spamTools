import { useEffect, useState } from 'react';
import type { CatalogSyncState } from '../../application/ports/CatalogSyncGateway.ts';
import { useGateways } from '../GatewaysContext.tsx';

const POLL_INTERVAL_MS = 2000;

const STATUS_LABELS = {
  imported: 'nouvelle version importée',
  unchanged: 'déjà à jour',
  reanalyzed: 'déjà présente, caractéristiques recalculées',
} as const;

/**
 * Mise à jour des cartes depuis spamgame.com (dernière version publiée). Elle tourne sur le serveur :
 * la page suit son avancement, et on peut la quitter sans l'interrompre.
 */
export function CatalogSyncPanel() {
  const { catalogSync: gateway } = useGateways();
  const [state, setState] = useState<CatalogSyncState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    gateway.state().then(setState, (cause: unknown) => setError(message(cause)));
  }, [gateway]);

  // Suivi tant qu'elle tourne.
  const running = state?.running ?? false;
  useEffect(() => {
    if (!running) {
      return;
    }
    const timer = window.setInterval(() => {
      gateway.state().then(setState, (cause: unknown) => setError(message(cause)));
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [gateway, running]);

  const start = async () => {
    setError(null);
    try {
      setState(await gateway.start());
    } catch (cause) {
      setError(message(cause));
    }
  };

  return (
    <section className="account__panel">
      <h2>Mise à jour des cartes</h2>
      <p className="auth__hint">
        Importe la dernière version publiée sur spamgame.com, avec ses images. Une version déjà présente n’est pas
        réimportée ; seules les images manquantes sont téléchargées.
      </p>
      <div className="admin__sync">
        <button type="button" onClick={() => void start()} disabled={state === null || running}>
          {running ? 'Mise à jour en cours…' : 'Mettre à jour'}
        </button>
        {state !== null && <SyncStatus state={state} />}
      </div>
      {state !== null && (
        <p className="auth__hint">
          {state.nextRunAt === null
            ? 'Mise à jour automatique désactivée sur ce serveur.'
            : `Prochaine mise à jour automatique : ${time(state.nextRunAt)}.`}
        </p>
      )}
      {error !== null && (
        <p className="auth__error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function SyncStatus({ state }: { state: CatalogSyncState }) {
  if (state.running) {
    return (
      <p className="auth__hint" role="status">
        {state.startedBy === null ? 'Mise à jour automatique' : `Lancée par ${state.startedBy}`}, le {time(state.startedAt)}…
      </p>
    );
  }
  if (state.finishedAt === null) {
    return <p className="auth__hint">Aucune mise à jour lancée depuis le démarrage du serveur.</p>;
  }
  if (state.error !== null) {
    return (
      <p className="auth__error" role="status">
        Échec{state.startedBy === null && ' de la mise à jour automatique'} le {time(state.finishedAt)} : {state.error}
      </p>
    );
  }
  const { result } = state;
  return (
    result !== null && (
      <p className="auth__success" role="status">
        Version {result.version} : {STATUS_LABELS[result.status]} ({result.cardCount} cartes, {result.imagesDownloaded}{' '}
        image{result.imagesDownloaded > 1 ? 's' : ''} téléchargée{result.imagesDownloaded > 1 ? 's' : ''}
        {result.imageFailures > 0 && `, ${result.imageFailures} en échec`}), le {time(state.finishedAt)}
        {state.startedBy === null ? ' (mise à jour automatique).' : ` par ${state.startedBy}.`}
        {result.status === 'imported' && ' Rechargez la page pour la voir.'}
      </p>
    )
  );
}

function time(iso: string | null): string {
  return iso === null ? '' : new Date(iso).toLocaleString('fr-FR');
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
