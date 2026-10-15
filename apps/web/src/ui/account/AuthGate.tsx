import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { Account } from '../../domain/Account.ts';
import { SESSION_LOST_EVENT } from '../../infrastructure/apiFetch.ts';
import { useGateways } from '../GatewaysContext.tsx';
import { LoginPage } from './LoginPage.tsx';
import { PasswordLinkPage, PASSWORD_LINK_PATH } from './PasswordLinkPage.tsx';

type AuthState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'signedOut' }
  | { readonly status: 'signedIn'; readonly account: Account };

export interface Session {
  readonly account: Account;
  readonly signOut: () => Promise<void>;
  /** Après « se déconnecter partout » : la session en cours est fermée aussi. */
  readonly sessionClosed: () => void;
}

/**
 * Garde de connexion : l'application n'est affichée qu'au compte connecté ; sinon la page de
 * connexion, ou celle du lien de mot de passe (invitation, réinitialisation).
 */
export function AuthGate({ children }: { children: (session: Session) => ReactNode }) {
  const { auth } = useGateways();
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const [onLinkPage, setOnLinkPage] = useState(() => window.location.pathname === PASSWORD_LINK_PATH);

  const load = useCallback(() => {
    setState({ status: 'loading' });
    auth.me().then(
      (account) => setState(account === null ? { status: 'signedOut' } : { status: 'signedIn', account }),
      (cause: unknown) => setState({ status: 'error', message: cause instanceof Error ? cause.message : String(cause) }),
    );
  }, [auth]);

  useEffect(load, [load]);

  // Session expirée ou fermée ailleurs : retour à la connexion.
  useEffect(() => {
    const onLost = () => setState({ status: 'signedOut' });
    window.addEventListener(SESSION_LOST_EVENT, onLost);
    return () => window.removeEventListener(SESSION_LOST_EVENT, onLost);
  }, []);

  const signedIn = useCallback((account: Account) => setState({ status: 'signedIn', account }), []);

  if (onLinkPage) {
    return (
      <PasswordLinkPage
        onDone={(account) => {
          window.history.replaceState(null, '', '/');
          setOnLinkPage(false);
          signedIn(account);
        }}
      />
    );
  }
  switch (state.status) {
    case 'loading':
      return <p className="app__state">Chargement…</p>;
    case 'error':
      return (
        <div className="app__state" role="alert">
          <p>Impossible de joindre le serveur : {state.message}</p>
          <button type="button" onClick={load}>
            Réessayer
          </button>
        </div>
      );
    case 'signedOut':
      return <LoginPage onSignedIn={signedIn} />;
    case 'signedIn':
      return children({
        account: state.account,
        signOut: async () => {
          await auth.logout().catch(() => undefined);
          setState({ status: 'signedOut' });
        },
        sessionClosed: () => setState({ status: 'signedOut' }),
      });
  }
}
