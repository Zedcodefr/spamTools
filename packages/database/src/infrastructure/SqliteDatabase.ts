import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { DatabaseConnection } from '../application/index.js';

const IN_MEMORY = ':memory:';

/**
 * Connexion SQLite via le module natif `node:sqlite` (aucune dépendance).
 * `location` : chemin du fichier, ou ":memory:" pour une base éphémère (tests).
 */
export class SqliteDatabase implements DatabaseConnection {
  private database: DatabaseSync | undefined;

  constructor(private readonly location: string) {}

  async open(): Promise<void> {
    if (this.database !== undefined) {
      return;
    }
    if (this.location !== IN_MEMORY) {
      mkdirSync(path.dirname(this.location), { recursive: true });
    }
    const database = new DatabaseSync(this.location);
    database.exec('PRAGMA foreign_keys = ON');
    if (this.location !== IN_MEMORY) {
      database.exec('PRAGMA journal_mode = WAL');
    }
    this.database = database;
  }

  async close(): Promise<void> {
    this.database?.close();
    this.database = undefined;
  }

  isOpen(): boolean {
    return this.database !== undefined;
  }

  get connection(): DatabaseSync {
    if (this.database === undefined) {
      throw new Error('Base de données non ouverte');
    }
    return this.database;
  }

  /** Exécute `work` dans une transaction : tout est validé, ou rien en cas d'erreur. */
  transaction<T>(work: (database: DatabaseSync) => T): T {
    const database = this.connection;
    database.exec('BEGIN');
    try {
      const result = work(database);
      database.exec('COMMIT');
      return result;
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }
}
