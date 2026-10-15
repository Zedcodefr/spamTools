/** Rôle d'un compte : admin gère les comptes ; member utilise les outils. */
export type Role = 'admin' | 'member';

export const ROLE_LABELS: Readonly<Record<Role, string>> = { admin: 'Administrateur', member: 'Membre' };

export interface Account {
  readonly id: string;
  readonly username: string;
  readonly role: Role;
  readonly disabled: boolean;
  /** false tant que le titulaire n'a pas choisi son mot de passe (invitation en attente). */
  readonly hasPassword: boolean;
  readonly createdAt: string;
}

/** Lien de mot de passe créé par un administrateur : le jeton n'est montré qu'une fois. */
export interface PasswordLink {
  readonly token: string;
  readonly expiresAt: string;
  readonly account: Account;
}

export const MIN_PASSWORD_LENGTH = 12;

/** Adresse du lien à transmettre : le jeton est dans le fragment (#), jamais envoyé au serveur ni dans les journaux. */
export function passwordLinkUrl(origin: string, token: string): string {
  return `${origin}/mot-de-passe#${token}`;
}
