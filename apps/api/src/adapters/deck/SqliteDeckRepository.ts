import { Deck, DeckId, type DeckRepository } from '@spamtools/deck';
import type { SqliteDatabase } from '@spamtools/database/infrastructure';

/**
 * Adaptateur : decks stockés dans SQLite (tables deck et deck_slot, voir migrations.ts).
 */
export class SqliteDeckRepository implements DeckRepository {
  constructor(private readonly database: SqliteDatabase) {}

  async save(deck: Deck): Promise<void> {
    this.database.transaction((db) => {
      db.prepare(
        `INSERT INTO deck (id, name, version, language, dps_card_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET name = excluded.name, version = excluded.version,
           language = excluded.language, dps_card_id = excluded.dps_card_id, updated_at = excluded.updated_at`,
      ).run(
        deck.id.value,
        deck.name,
        deck.version,
        deck.language,
        deck.dpsCardId,
        deck.createdAt.toISOString(),
        deck.updatedAt.toISOString(),
      );
      db.prepare('DELETE FROM deck_slot WHERE deck_id = ?').run(deck.id.value);
      const insertSlot = db.prepare('INSERT INTO deck_slot (deck_id, position, card_id, talent_slot) VALUES (?, ?, ?, ?)');
      deck.slots.forEach((slot, position) => insertSlot.run(deck.id.value, position, slot.cardId, slot.talentSlot));
    });
  }

  async findById(id: DeckId): Promise<Deck | undefined> {
    const row = this.database.connection.prepare('SELECT * FROM deck WHERE id = ?').get(id.value);
    return row === undefined ? undefined : this.restore(row);
  }

  async list(): Promise<Deck[]> {
    return this.database.connection
      .prepare('SELECT * FROM deck ORDER BY updated_at DESC')
      .all()
      .map((row) => this.restore(row));
  }

  async delete(id: DeckId): Promise<boolean> {
    return this.database.connection.prepare('DELETE FROM deck WHERE id = ?').run(id.value).changes > 0;
  }

  private restore(row: Record<string, unknown>): Deck {
    const id = String(row['id']);
    const slots = this.database.connection
      .prepare('SELECT card_id, talent_slot FROM deck_slot WHERE deck_id = ? ORDER BY position')
      .all(id)
      .map((slot) => ({
        cardId: String(slot['card_id']),
        talentSlot: slot['talent_slot'] === null ? null : Number(slot['talent_slot']),
      }));
    return Deck.restore(
      new DeckId(id),
      {
        name: String(row['name']),
        version: String(row['version']),
        language: String(row['language']),
        slots,
        dpsCardId: row['dps_card_id'] === null ? null : String(row['dps_card_id']),
      },
      new Date(String(row['created_at'])),
      new Date(String(row['updated_at'])),
    );
  }
}
