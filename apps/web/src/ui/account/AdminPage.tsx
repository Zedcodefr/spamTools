import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { passwordLinkUrl, ROLE_LABELS, type Account, type PasswordLink, type Role } from '../../domain/Account.ts';
import { useGateways } from '../GatewaysContext.tsx';
import './Account.css';

/**
 * Administration des comptes : création (avec lien d'invitation), rôle, désactivation, lien de
 * réinitialisation du mot de passe, suppression. Son propre compte se gère dans « Mon compte ».
 */
export function AdminPage({ currentAccountId }: { currentAccountId: string }) {
  const { accounts: gateway } = useGateways();
  const [accounts, setAccounts] = useState<readonly Account[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<PasswordLink | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const reload = useCallback(() => {
    gateway.list().then(setAccounts, (cause: unknown) => setError(message(cause)));
  }, [gateway]);
  useEffect(reload, [reload]);

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      reload();
    } catch (cause) {
      setError(message(cause));
    }
  };

  return (
    <div className="account">
      <CreateAccountForm onCreated={(created) => (setLink(created), reload())} onError={setError} />

      {link !== null && <LinkNotice link={link} onClose={() => setLink(null)} />}
      {error !== null && (
        <p className="auth__error" role="alert">
          {error}
        </p>
      )}

      <section className="account__panel">
        <h2>Comptes</h2>
        {accounts === null ? (
          <p className="auth__hint">Chargement…</p>
        ) : (
          <div className="admin__table-wrap">
            <table className="admin__table">
              <thead>
                <tr>
                  <th scope="col">Identifiant</th>
                  <th scope="col">Rôle</th>
                  <th scope="col">État</th>
                  <th scope="col">Créé le</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => {
                  const self = account.id === currentAccountId;
                  return (
                    <tr key={account.id}>
                      <th scope="row">
                        {account.username}
                        {self && <span className="admin__self"> (vous)</span>}
                      </th>
                      <td>
                        {self ? (
                          ROLE_LABELS[account.role]
                        ) : (
                          <select
                            value={account.role}
                            aria-label={`Rôle de ${account.username}`}
                            onChange={(event) => void run(() => gateway.update(account.id, { role: event.target.value as Role }))}
                          >
                            {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
                              <option key={role} value={role}>
                                {ROLE_LABELS[role]}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td>{account.disabled ? 'Désactivé' : account.hasPassword ? 'Actif' : 'Invitation en attente'}</td>
                      <td>{new Date(account.createdAt).toLocaleDateString('fr-FR')}</td>
                      <td className="admin__actions">
                        {!account.disabled && (
                          <button type="button" onClick={() => void run(async () => setLink(await gateway.issuePasswordLink(account.id)))}>
                            {account.hasPassword ? 'Lien de réinitialisation' : 'Nouveau lien d’invitation'}
                          </button>
                        )}
                        {!self && (
                          <button type="button" onClick={() => void run(() => gateway.update(account.id, { disabled: !account.disabled }))}>
                            {account.disabled ? 'Réactiver' : 'Désactiver'}
                          </button>
                        )}
                        {!self &&
                          (confirmDelete === account.id ? (
                            <>
                              <button
                                type="button"
                                className="admin__danger"
                                onClick={() => void run(async () => (await gateway.delete(account.id), setConfirmDelete(null)))}
                              >
                                Confirmer la suppression
                              </button>
                              <button type="button" onClick={() => setConfirmDelete(null)}>
                                Annuler
                              </button>
                            </>
                          ) : (
                            <button type="button" className="admin__danger" onClick={() => setConfirmDelete(account.id)}>
                              Supprimer
                            </button>
                          ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="auth__hint">Supprimer un compte supprime aussi ses decks et sa collection.</p>
      </section>
    </div>
  );
}

function CreateAccountForm({ onCreated, onError }: { onCreated: (link: PasswordLink) => void; onError: (message: string) => void }) {
  const { accounts: gateway } = useGateways();
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    try {
      onCreated(await gateway.create(username, role));
      setUsername('');
      setRole('member');
    } catch (cause) {
      onError(message(cause));
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="account__panel account__form" onSubmit={submit}>
      <h2>Créer un compte</h2>
      <p className="auth__hint">
        Le compte est créé sans mot de passe : transmettez le lien d’invitation à son titulaire, qui choisira le sien.
      </p>
      <div className="admin__create">
        <label>
          Identifiant
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoCapitalize="none"
            spellCheck={false}
            pattern="[A-Za-z0-9][A-Za-z0-9._\-]{2,31}"
            title="3 à 32 caractères : lettres, chiffres, « . », « _ » ou « - »"
            required
          />
        </label>
        <label>
          Rôle
          <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
            {(Object.keys(ROLE_LABELS) as Role[]).map((value) => (
              <option key={value} value={value}>
                {ROLE_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={pending}>
          {pending ? 'Création…' : 'Créer'}
        </button>
      </div>
    </form>
  );
}

/** Lien à transmettre : affiché une seule fois (le serveur n'en garde que l'empreinte). */
function LinkNotice({ link, onClose }: { link: PasswordLink; onClose: () => void }) {
  const url = passwordLinkUrl(window.location.origin, link.token);
  const [copied, setCopied] = useState(false);
  return (
    <section className="account__panel admin__link" role="status">
      <h2>Lien pour {link.account.username}</h2>
      <p className="auth__hint">
        À transmettre au titulaire du compte par un canal privé. Valable une seule fois, jusqu’au{' '}
        {new Date(link.expiresAt).toLocaleString('fr-FR')}. Il ne sera plus affiché ensuite.
      </p>
      <div className="admin__link-row">
        <input value={url} readOnly aria-label="Lien" onFocus={(event) => event.target.select()} />
        <button
          type="button"
          onClick={() =>
            void navigator.clipboard.writeText(url).then(
              () => setCopied(true),
              () => setCopied(false),
            )
          }
        >
          {copied ? 'Copié' : 'Copier'}
        </button>
        <button type="button" onClick={onClose}>
          Fermer
        </button>
      </div>
    </section>
  );
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
