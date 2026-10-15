import { useState, type FormEvent } from 'react';
import type { Account } from '../../domain/Account.ts';
import { useGateways } from '../GatewaysContext.tsx';
import './Account.css';

/** Connexion par identifiant et mot de passe. Les comptes sont créés par un administrateur. */
interface LoginPageProps {
  readonly onSignedIn: (account: Account) => void;
  readonly onCancel: () => void;
  /** Par-dessus l'application (qui garde son état). */
  readonly overlay?: boolean;
}

export function LoginPage({ onSignedIn, onCancel, overlay = false }: LoginPageProps) {
  const { auth } = useGateways();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      onSignedIn(await auth.login(username, password));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setPassword('');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={overlay ? 'auth auth--overlay' : 'auth'}>
      <form className="auth__card" onSubmit={submit}>
        <h1>spamTools</h1>
        <p className="auth__hint">Connectez-vous pour enregistrer vos decks, votre collection et chercher les meilleurs decks.</p>
        <label>
          Identifiant
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            autoFocus
          />
        </label>
        <label>
          Mot de passe
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error !== null && (
          <p className="auth__error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="auth__submit" disabled={pending}>
          {pending ? 'Connexion…' : 'Se connecter'}
        </button>
        <p className="auth__hint">Pas de compte, ou mot de passe oublié ? Demandez un lien à un administrateur.</p>
        <button type="button" onClick={onCancel}>
          Continuer sans compte
        </button>
      </form>
    </div>
  );
}
