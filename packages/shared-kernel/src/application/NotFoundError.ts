/**
 * Ressource demandée absente : à traduire en 404 par les adaptateurs entrants.
 */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
