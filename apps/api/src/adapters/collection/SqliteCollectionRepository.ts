import { Collection, type CollectionRepository } from '@spamtools/collection';
import type { SqliteDatabase } from '@spamtools/database/infrastructure';

/**
 * Adaptateur : collection de chaque compte dans SQLite (table owned_card, voir migrations.ts).
 */
export class SqliteCollectionRepository implements CollectionRepository {
  constructor(
    private readonly database: SqliteDatabase,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async load(ownerId: string): Promise<Collection> {
    return Collection.of(
      this.database.connection
        .prepare('SELECT card_id FROM owned_card WHERE owner_id = ?')
        .all(ownerId)
        .map((row) => String(row['card_id'])),
    );
  }

  async saveChanges(ownerId: string, cardIds: readonly string[], owned: boolean): Promise<void> {
    const now = this.clock().toISOString();
    this.database.transaction((db) => {
      const statement = owned
        ? db.prepare('INSERT OR IGNORE INTO owned_card (owner_id, card_id, added_at) VALUES (?, ?, ?)')
        : db.prepare('DELETE FROM owned_card WHERE owner_id = ? AND card_id = ?');
      for (const id of cardIds) {
        if (owned) {
          statement.run(ownerId, id, now);
        } else {
          statement.run(ownerId, id);
        }
      }
    });
  }
}
