/**
 * Port : cycle de vie de la connexion. Implémenté en infrastructure
 * par le driver choisi (SQLite, Postgres...).
 */
export interface DatabaseConnection {
  open(): Promise<void>;
  close(): Promise<void>;
  isOpen(): boolean;
}
