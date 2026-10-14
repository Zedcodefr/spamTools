/**
 * Erreur métier : violation d'un invariant du domaine.
 * À distinguer des erreurs techniques (I/O, réseau, driver BDD...).
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
