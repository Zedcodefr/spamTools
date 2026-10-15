import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Account } from '../../domain/Account.ts';
import { SESSION_LOST_EVENT } from '../../infrastructure/apiFetch.ts';
import { useGateways } from '../GatewaysContext.tsx';
import { navigateTo } from '../navigation.ts';
import './Account.css';

export const LOGIN_PATH = '/connexion';

export interface Session {
  /** Compte connecté, ou null : visiteur (consultation seulement). */
  readonly account: Account | null;
  /** true tant que la session n'est pas vérifiée au chargement. */
  readonly checking: boolean;
  readonly signedIn: (account: Account) => void;
  readonly signOut: () => Promise<void>;
  /** Après « se déconnecter partout » : la session en cours est fermée aussi. */
  readonly sessionClosed: () => void;
  /**
   * À appeler avant une action réservée aux comptes : true si connecté ; sinon ouvre la fenêtre
   * « Vous devez vous connecter… » et renvoie false.
   */
  readonly requireAccount: () => boolean;
  /** Page de connexion, puis retour à la page actuelle. */
  readonly goToLogin: () => void;
  /** Page où revenir après la connexion. */
  readonly takeReturnPath: () => string;
}

const SessionContext = createContext<Session | null>(null);

/**
 * Session de l'utilisateur : le site se consulte sans compte ; les actions personnelles (decks
 * enregistrés, collection, recherche de decks, comptes) demandent une connexion.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const { auth } = useGateways();
  const [account, setAccount] = useState<Account | null>(null);
  const [checking, setChecking] = useState(true);
  const [prompt, setPrompt] = useState<'required' | 'expired' | null>(null);
  const returnPath = useRef('/');
  const accountRef = useRef<Account | null>(null);
  accountRef.current = account;

  useEffect(() => {
    auth.me().then(
      (current) => {
        setAccount(current);
        setChecking(false);
      },
      () => setChecking(false),
    );
  }, [auth]);

  // Session expirée ou fermée ailleurs : on repasse en visiteur et on le signale.
  useEffect(() => {
    const onLost = () => {
      if (accountRef.current !== null) {
        setPrompt('expired');
      }
      setAccount(null);
    };
    window.addEventListener(SESSION_LOST_EVENT, onLost);
    return () => window.removeEventListener(SESSION_LOST_EVENT, onLost);
  }, []);

  const goToLogin = useCallback(() => {
    setPrompt(null);
    if (window.location.pathname !== LOGIN_PATH) {
      returnPath.current = `${window.location.pathname}${window.location.search}`;
    }
    navigateTo(LOGIN_PATH);
  }, []);

  const session = useMemo<Session>(
    () => ({
      account,
      checking,
      signedIn: setAccount,
      signOut: async () => {
        await auth.logout().catch(() => undefined);
        setAccount(null);
      },
      sessionClosed: () => setAccount(null),
      requireAccount: () => {
        if (account !== null) {
          return true;
        }
        setPrompt('required');
        return false;
      },
      goToLogin,
      takeReturnPath: () => {
        const path = returnPath.current;
        returnPath.current = '/';
        return path;
      },
    }),
    [account, checking, auth, goToLogin],
  );

  return (
    <SessionContext value={session}>
      {children}
      {prompt !== null && <LoginRequiredDialog expired={prompt === 'expired'} onLogin={goToLogin} onClose={() => setPrompt(null)} />}
    </SessionContext>
  );
}

export function useSession(): Session {
  const session = use(SessionContext);
  if (session === null) {
    throw new Error('useSession doit être utilisé sous <SessionProvider>');
  }
  return session;
}

/** Fenêtre modale : connexion nécessaire pour cette action. */
function LoginRequiredDialog({ expired, onLogin, onClose }: { expired: boolean; onLogin: () => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="login-dialog"
      aria-labelledby="login-dialog-title"
      onClose={onClose}
      onClick={(event) => event.target === dialog.current && onClose()}
    >
      <h2 id="login-dialog-title">{expired ? 'Session expirée' : 'Connexion requise'}</h2>
      <p>
        {expired
          ? 'Votre session a expiré. Reconnectez-vous pour accéder à toutes les fonctionnalités.'
          : 'Vous devez vous connecter pour accéder à toutes les fonctionnalités.'}
      </p>
      <p className="auth__hint">Sans compte, vous pouvez consulter les cartes et analyser un deck.</p>
      <div className="login-dialog__actions">
        <button type="button" onClick={onClose}>
          Continuer sans compte
        </button>
        <button type="button" className="auth__submit" onClick={onLogin} autoFocus>
          Se connecter
        </button>
      </div>
    </dialog>
  );
}
