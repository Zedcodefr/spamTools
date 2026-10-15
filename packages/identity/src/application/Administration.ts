import { DomainError, ForbiddenError, NotFoundError, type UseCase } from '@spamtools/shared-kernel';
import { Account, AccountId, normalizeUsername, type Role } from '../domain/index.js';
import { toAccountView, type AccountView, type IssuedPasswordLink } from './AccountView.js';
import { actor, issuePasswordLink, now, type IdentityDependencies } from './Dependencies.js';

export class ListAccounts implements UseCase<{ readonly actorId: string }, AccountView[]> {
  constructor(private readonly deps: IdentityDependencies) {}

  async execute({ actorId }: { readonly actorId: string }): Promise<AccountView[]> {
    await actor(this.deps, actorId, { admin: true });
    return (await this.deps.accounts.list()).map(toAccountView);
  }
}

export interface CreateAccountInput {
  readonly username: string;
  readonly role: Role;
}

async function createAccount(deps: IdentityDependencies, { username, role }: CreateAccountInput) {
  const normalized = normalizeUsername(username);
  if ((await deps.accounts.findByUsername(normalized)) !== undefined) {
    throw new DomainError(`L'identifiant « ${normalized} » est déjà pris`);
  }
  const account = Account.create(normalized, role, now(deps));
  await deps.accounts.save(account);
  return issuePasswordLink(deps, account);
}

/** Création d'un compte par un administrateur : renvoie le lien d'invitation à transmettre au titulaire. */
export class CreateAccount implements UseCase<CreateAccountInput & { readonly actorId: string }, IssuedPasswordLink> {
  constructor(private readonly deps: IdentityDependencies) {}

  async execute({ actorId, ...input }: CreateAccountInput & { readonly actorId: string }): Promise<IssuedPasswordLink> {
    await actor(this.deps, actorId, { admin: true });
    return createAccount(this.deps, input);
  }
}

/**
 * Premier administrateur, créé en ligne de commande sur le serveur (accès déjà de confiance) ;
 * renvoie son lien d'invitation.
 */
export class BootstrapAdmin implements UseCase<{ readonly username: string }, IssuedPasswordLink> {
  constructor(private readonly deps: IdentityDependencies) {}

  async execute({ username }: { readonly username: string }): Promise<IssuedPasswordLink> {
    return createAccount(this.deps, { username, role: 'admin' });
  }
}

export interface UpdateAccountInput {
  readonly actorId: string;
  readonly accountId: string;
  readonly role?: Role | undefined;
  readonly disabled?: boolean | undefined;
}

/**
 * Rôle et activation d'un compte. Un administrateur ne modifie pas son propre compte ici (pas de
 * blocage par erreur), et il reste toujours un administrateur actif.
 */
export class UpdateAccount implements UseCase<UpdateAccountInput, AccountView> {
  constructor(private readonly deps: IdentityDependencies) {}

  async execute(input: UpdateAccountInput): Promise<AccountView> {
    const admin = await actor(this.deps, input.actorId, { admin: true });
    const account = await target(this.deps, admin, input.accountId);
    if (input.role !== undefined) {
      account.changeRole(input.role);
    }
    if (input.disabled !== undefined) {
      account.setDisabled(input.disabled);
    }
    await this.deps.accounts.save(account);
    if (account.disabled) {
      await this.deps.sessions.deleteForAccount(account.id.value);
      await this.deps.passwordLinks.deleteForAccount(account.id.value);
    }
    return toAccountView(account);
  }
}

/** Lien de réinitialisation du mot de passe d'un compte (remplace le précédent). */
export class IssuePasswordReset implements UseCase<{ readonly actorId: string; readonly accountId: string }, IssuedPasswordLink> {
  constructor(private readonly deps: IdentityDependencies) {}

  async execute(input: { readonly actorId: string; readonly accountId: string }): Promise<IssuedPasswordLink> {
    const admin = await actor(this.deps, input.actorId, { admin: true });
    const account = await target(this.deps, admin, input.accountId, { self: true });
    if (account.disabled) {
      throw new DomainError('Compte désactivé : le réactiver d’abord');
    }
    return issuePasswordLink(this.deps, account);
  }
}

/** Suppression d'un compte et de ses données (decks, collection). */
export class DeleteAccount implements UseCase<{ readonly actorId: string; readonly accountId: string }, void> {
  constructor(private readonly deps: IdentityDependencies) {}

  async execute(input: { readonly actorId: string; readonly accountId: string }): Promise<void> {
    const admin = await actor(this.deps, input.actorId, { admin: true });
    const account = await target(this.deps, admin, input.accountId);
    await this.deps.accounts.delete(account.id);
  }
}

async function target(deps: IdentityDependencies, admin: Account, accountId: string, { self = false } = {}) {
  if (!self && admin.id.value === accountId) {
    throw new ForbiddenError('Impossible de modifier ou supprimer son propre compte depuis l’administration');
  }
  const account = await deps.accounts.findById(new AccountId(accountId));
  if (account === undefined) {
    throw new NotFoundError(`Compte introuvable : ${accountId}`);
  }
  return account;
}
