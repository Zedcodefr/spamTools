/**
 * Utilisateur non identifié (pas de session, identifiants faux) : à traduire en 401.
 */
export class UnauthenticatedError extends Error {
  constructor(message = 'Connexion requise') {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * Utilisateur identifié, mais action non permise : à traduire en 403.
 */
export class ForbiddenError extends Error {
  constructor(message = 'Action non autorisée') {
    super(message);
    this.name = new.target.name;
  }
}
