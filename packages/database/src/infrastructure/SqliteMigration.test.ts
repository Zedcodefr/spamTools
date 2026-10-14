import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MigrateDatabase } from '../application/index.js';
import { SqliteDatabase } from './SqliteDatabase.js';
import { SqliteMigrationJournal } from './SqliteMigrationJournal.js';
import { SqlMigrationSource, type SqlMigration } from './SqlMigrationSource.js';

const migrations: SqlMigration[] = [
  { version: 1, name: 'create_item', sql: 'CREATE TABLE item (id INTEGER PRIMARY KEY)' },
  { version: 2, name: 'add_label', sql: 'ALTER TABLE item ADD COLUMN label TEXT' },
];

async function migrate(database: SqliteDatabase, available: readonly SqlMigration[]) {
  return new MigrateDatabase(new SqlMigrationSource(database, available), new SqliteMigrationJournal(database)).execute();
}

describe('Migrations SQLite', () => {
  it("applique les migrations en attente une seule fois", async () => {
    const database = new SqliteDatabase(':memory:');
    await database.open();

    assert.deepEqual((await migrate(database, migrations)).applied, ['create_item', 'add_label']);
    assert.deepEqual((await migrate(database, migrations)).applied, []);
    database.connection.prepare('INSERT INTO item (label) VALUES (?)').run('ok');
  });

  it("annule une migration en échec sans l'enregistrer", async () => {
    const database = new SqliteDatabase(':memory:');
    await database.open();
    const broken: SqlMigration = { version: 3, name: 'broken', sql: 'CREATE TABLE other (id INTEGER); SELECT nope FROM missing' };

    await assert.rejects(migrate(database, [...migrations, broken]));

    const tables = database.connection.prepare("SELECT name FROM sqlite_master WHERE name = 'other'").all();
    assert.deepEqual(tables, []);
    assert.deepEqual((await new SqliteMigrationJournal(database).appliedVersions()).map((v) => v.value), [1, 2]);
  });
});
