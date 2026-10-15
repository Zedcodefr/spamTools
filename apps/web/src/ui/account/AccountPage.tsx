import { useState, type FormEvent } from 'react';
import { ROLE_LABELS } from '../../domain/Account.ts';
import { useGateways } from '../GatewaysContext.tsx';
import type { Session } from './SessionContext.tsx';
import { PasswordFields, passwordProblem } from './PasswordFields.tsx';
import './Account.css';

/** Mon compte : changer de mot de passe, se déconnecter de tous ses appareils. */
export function AccountPage({ session }: { session: Session & { readonly account: NonNullable<Session['account']> } }) {
  const { auth } = useGateways();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState<{ readonly ok: boolean; readonly text: string } | null>(null);
  const [pending, setPending] = useState(false);

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      await auth.changePassword(current, password);
      setCurrent('');
      setPassword('');
      setConfirmation('');
      setMessage({ ok: true, text: 'Mot de passe changé. Vos autres appareils sont déconnectés.' });
    } catch (cause) {
      setMessage({ ok: false, text: cause instanceof Error ? cause.message : String(cause) });
    } finally {
      setPending(false);
    }
  };

  const logoutEverywhere = async () => {
    await auth.logoutEverywhere().catch(() => undefined);
    session.sessionClosed();
  };

  return (
    <div className="account">
      <section className="account__panel">
        <h2>Mon compte</h2>
        <dl className="account__facts">
          <dt>Identifiant</dt>
          <dd>{session.account.username}</dd>
          <dt>Rôle</dt>
          <dd>{ROLE_LABELS[session.account.role]}</dd>
          <dt>Créé le</dt>
          <dd>{new Date(session.account.createdAt).toLocaleDateString('fr-FR')}</dd>
        </dl>
      </section>

      <form className="account__panel account__form" onSubmit={changePassword}>
        <h2>Changer de mot de passe</h2>
        <input type="text" name="username" value={session.account.username} autoComplete="username" readOnly hidden />
        <label>
          Mot de passe actuel
          <input
            type="password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <PasswordFields password={password} confirmation={confirmation} onPassword={setPassword} onConfirmation={setConfirmation} />
        {message !== null && (
          <p className={message.ok ? 'auth__success' : 'auth__error'} role={message.ok ? 'status' : 'alert'}>
            {message.text}
          </p>
        )}
        <button type="submit" disabled={pending || current === '' || passwordProblem(password, confirmation) !== null}>
          {pending ? 'Enregistrement…' : 'Changer le mot de passe'}
        </button>
      </form>

      <section className="account__panel">
        <h2>Sessions</h2>
        <p className="auth__hint">Un appareil perdu, ou un ordinateur partagé ? Fermez toutes vos sessions, celle-ci comprise.</p>
        <div className="account__actions">
          <button type="button" onClick={() => void session.signOut()}>
            Se déconnecter
          </button>
          <button type="button" onClick={() => void logoutEverywhere()}>
            Se déconnecter de tous les appareils
          </button>
        </div>
      </section>
    </div>
  );
}
