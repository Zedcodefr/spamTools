import { useEffect, useState, type FormEvent } from 'react';
import type { Account } from '../../domain/Account.ts';
import { useGateways } from '../GatewaysContext.tsx';
import { PasswordFields, passwordProblem } from './PasswordFields.tsx';
import './Account.css';

export const PASSWORD_LINK_PATH = '/mot-de-passe';

type LinkState =
  | { readonly status: 'checking' }
  | { readonly status: 'invalid'; readonly message: string }
  | { readonly status: 'valid'; readonly username: string };

/**
 * Lien d'invitation ou de réinitialisation : /mot-de-passe#<jeton>. Le jeton est dans le fragment de
 * l'URL, que le navigateur n'envoie jamais au serveur.
 */
export function PasswordLinkPage({ onDone }: { onDone: (account: Account) => void }) {
  const { auth } = useGateways();
  const [token] = useState(() => window.location.hash.slice(1));
  const [link, setLink] = useState<LinkState>({ status: 'checking' });
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (token === '') {
      setLink({ status: 'invalid', message: 'Lien incomplet : ouvrez le lien reçu en entier.' });
      return;
    }
    auth.inspectPasswordLink(token).then(
      ({ username }) => setLink({ status: 'valid', username }),
      (cause: unknown) => setLink({ status: 'invalid', message: cause instanceof Error ? cause.message : String(cause) }),
    );
  }, [auth, token]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      onDone(await auth.redeemPasswordLink(token, password));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="auth">
      <form className="auth__card" onSubmit={submit}>
        <h1 className="auth__logo">
          <img className="auth__logo-image" src="/logo.png" alt="spamTools" width="320" height="139" />
        </h1>
        {link.status === 'checking' && <p className="auth__hint">Vérification du lien…</p>}
        {link.status === 'invalid' && (
          <>
            <p className="auth__error" role="alert">
              {link.message}
            </p>
            <a href="/">Aller à la connexion</a>
          </>
        )}
        {link.status === 'valid' && (
          <>
            <p className="auth__hint">
              Choisissez le mot de passe du compte <strong>{link.username}</strong>.
            </p>
            {/* Aide les gestionnaires de mots de passe à associer l'identifiant. */}
            <input type="text" name="username" value={link.username} autoComplete="username" readOnly hidden />
            <PasswordFields
              password={password}
              confirmation={confirmation}
              onPassword={setPassword}
              onConfirmation={setConfirmation}
            />
            {error !== null && (
              <p className="auth__error" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="auth__submit"
              disabled={pending || passwordProblem(password, confirmation) !== null}
            >
              {pending ? 'Enregistrement…' : 'Enregistrer et se connecter'}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
