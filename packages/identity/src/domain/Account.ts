import { AggregateRoot, DomainError, Identifier } from '@spamtools/shared-kernel';

export class AccountId extends Identifier {}

/** admin : gère les comptes ; member : utilise les outils, avec ses propres decks et sa collection. */
export type Role = 'admin' | 'member';

export const ROLES: readonly Role[] = ['admin', 'member'];

const USERNAME = /^[a-z0-9][a-z0-9._-]{2,31}$/;
export const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 256;

/** Identifiant de connexion : 3 à 32 caractères, minuscules, chiffres, « . _ - ». */
export function normalizeUsername(username: string): string {
  const normalized = username.trim().toLowerCase();
  if (!USERNAME.test(normalized)) {
    throw new DomainError(
      'Identifiant invalide : 3 à 32 caractères, lettres minuscules, chiffres, « . », « _ » ou « - »',
    );
  }
  return normalized;
}

/** Règle des mots de passe : la longueur compte plus que la complexité. */
export function validatePassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new DomainError(`Mot de passe trop court : ${MIN_PASSWORD_LENGTH} caractères au moins`);
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new DomainError(`Mot de passe trop long : ${MAX_PASSWORD_LENGTH} caractères au plus`);
  }
}

export interface AccountState {
  readonly username: string;
  readonly role: Role;
  /** Empreinte du mot de passe ; null tant que le titulaire ne l'a pas choisi (lien d'invitation). */
  readonly passwordHash: string | null;
  readonly disabled: boolean;
  readonly createdAt: Date;
  readonly passwordChangedAt: Date | null;
}

/**
 * Agrégat : un compte. Créé par un administrateur sans mot de passe ; son titulaire le choisit
 * avec un lien à usage unique.
 */
export class Account extends AggregateRoot<AccountId> {
  private constructor(
    id: AccountId,
    private state: AccountState,
  ) {
    super(id);
  }

  static create(username: string, role: Role, now: Date, id: AccountId = new AccountId()): Account {
    return new Account(id, {
      username: normalizeUsername(username),
      role,
      passwordHash: null,
      disabled: false,
      createdAt: now,
      passwordChangedAt: null,
    });
  }

  /** Reconstitution depuis la persistance. */
  static restore(id: AccountId, state: AccountState): Account {
    return new Account(id, state);
  }

  get username(): string {
    return this.state.username;
  }

  get role(): Role {
    return this.state.role;
  }

  get isAdmin(): boolean {
    return this.state.role === 'admin';
  }

  get passwordHash(): string | null {
    return this.state.passwordHash;
  }

  get disabled(): boolean {
    return this.state.disabled;
  }

  /** Peut se connecter : actif, avec un mot de passe. */
  get canSignIn(): boolean {
    return !this.state.disabled && this.state.passwordHash !== null;
  }

  get createdAt(): Date {
    return this.state.createdAt;
  }

  get passwordChangedAt(): Date | null {
    return this.state.passwordChangedAt;
  }

  /** L'empreinte est calculée par l'application (PasswordHasher), après validatePassword. */
  changePassword(passwordHash: string, now: Date): void {
    this.state = { ...this.state, passwordHash, passwordChangedAt: now };
  }

  changeRole(role: Role): void {
    this.state = { ...this.state, role };
  }

  setDisabled(disabled: boolean): void {
    this.state = { ...this.state, disabled };
  }
}
