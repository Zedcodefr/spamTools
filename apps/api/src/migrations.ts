import type { SqlMigration } from '@spamtools/database/infrastructure';

/**
 * Schéma de la base de l'application, par ordre de version.
 * Une migration publiée ne se modifie plus : on en ajoute une nouvelle.
 */
export const migrations: readonly SqlMigration[] = [
  {
    version: 1,
    name: 'create_card_catalog',
    sql: `
      -- Une ligne par version du jeu et par langue. Le document reçu est gardé tel quel
      -- pour pouvoir rejouer un import ou exploiter des champs non encore modélisés.
      CREATE TABLE catalog (
        version       TEXT NOT NULL,
        language      TEXT NOT NULL,
        generated_at  TEXT NOT NULL,
        imported_at   TEXT NOT NULL,
        raw_document  TEXT NOT NULL,
        PRIMARY KEY (version, language)
      );

      CREATE TABLE element (
        version     TEXT NOT NULL,
        language    TEXT NOT NULL,
        id          TEXT NOT NULL,
        name        TEXT NOT NULL,
        sort_order  INTEGER NOT NULL,
        icon        TEXT NOT NULL,
        color       TEXT NOT NULL,
        PRIMARY KEY (version, language, id),
        FOREIGN KEY (version, language) REFERENCES catalog (version, language) ON DELETE CASCADE
      );

      CREATE TABLE rarity (
        version     TEXT NOT NULL,
        language    TEXT NOT NULL,
        id          TEXT NOT NULL,
        name        TEXT NOT NULL,
        sort_order  INTEGER NOT NULL,
        gem         TEXT NOT NULL,
        text_color  TEXT,
        PRIMARY KEY (version, language, id),
        FOREIGN KEY (version, language) REFERENCES catalog (version, language) ON DELETE CASCADE
      );

      CREATE TABLE keyword (
        version           TEXT NOT NULL,
        language          TEXT NOT NULL,
        id                TEXT NOT NULL,
        position          INTEGER NOT NULL,
        title             TEXT NOT NULL,
        description       TEXT NOT NULL,
        description_rich  TEXT NOT NULL,
        tooltip           TEXT NOT NULL,
        color             TEXT,
        icon              TEXT,
        PRIMARY KEY (version, language, id),
        FOREIGN KEY (version, language) REFERENCES catalog (version, language) ON DELETE CASCADE
      );

      CREATE TABLE card (
        version         TEXT NOT NULL,
        language        TEXT NOT NULL,
        id              TEXT NOT NULL,
        number          INTEGER NOT NULL,
        slug            TEXT NOT NULL,
        name            TEXT NOT NULL,
        element         TEXT NOT NULL,
        rarity          TEXT NOT NULL,
        spamton         INTEGER NOT NULL,
        hp              INTEGER NOT NULL,
        artwork_file    TEXT NOT NULL,
        artwork_small   TEXT NOT NULL,
        artwork_tiny    TEXT NOT NULL,
        artwork_width   INTEGER NOT NULL,
        artwork_height  INTEGER NOT NULL,
        artist_name     TEXT NOT NULL,
        artist_link     TEXT,
        lore_species    TEXT NOT NULL,
        lore_region     TEXT NOT NULL,
        lore_era        TEXT NOT NULL,
        lore_text       TEXT NOT NULL,
        PRIMARY KEY (version, language, id),
        FOREIGN KEY (version, language) REFERENCES catalog (version, language) ON DELETE CASCADE,
        FOREIGN KEY (version, language, element) REFERENCES element (version, language, id),
        FOREIGN KEY (version, language, rarity) REFERENCES rarity (version, language, id)
      );

      CREATE TABLE card_resistance (
        version   TEXT NOT NULL,
        language  TEXT NOT NULL,
        card_id   TEXT NOT NULL,
        element   TEXT NOT NULL,
        value     REAL NOT NULL,
        PRIMARY KEY (version, language, card_id, element),
        FOREIGN KEY (version, language, card_id) REFERENCES card (version, language, id) ON DELETE CASCADE
      );

      -- Les effets élémentaires (actions) et listes d'éléments sont stockés en JSON :
      -- interrogeables avec json_each() sans multiplier les tables.
      CREATE TABLE card_ability (
        version                TEXT NOT NULL,
        language               TEXT NOT NULL,
        card_id                TEXT NOT NULL,
        position               INTEGER NOT NULL,
        id                     TEXT NOT NULL,
        name                   TEXT NOT NULL,
        effect                 TEXT NOT NULL,
        effect_rich            TEXT NOT NULL,
        cooldown               REAL NOT NULL,
        elements               TEXT NOT NULL,
        precision              REAL NOT NULL,
        crit_chance            REAL NOT NULL,
        crit_multiplier        REAL NOT NULL,
        duration               REAL NOT NULL,
        uses                   REAL NOT NULL,
        cooldown_reset_chance  REAL NOT NULL,
        actions                TEXT NOT NULL,
        PRIMARY KEY (version, language, card_id, position),
        FOREIGN KEY (version, language, card_id) REFERENCES card (version, language, id) ON DELETE CASCADE
      );

      CREATE TABLE card_skill (
        version      TEXT NOT NULL,
        language     TEXT NOT NULL,
        card_id      TEXT NOT NULL,
        position     INTEGER NOT NULL,
        id           TEXT NOT NULL,
        name         TEXT NOT NULL,
        effect       TEXT NOT NULL,
        effect_rich  TEXT NOT NULL,
        rarity       TEXT NOT NULL,
        element      TEXT,
        value        REAL NOT NULL,
        icon         TEXT,
        PRIMARY KEY (version, language, card_id, position),
        FOREIGN KEY (version, language, card_id) REFERENCES card (version, language, id) ON DELETE CASCADE
      );

      CREATE TABLE card_talent (
        version       TEXT NOT NULL,
        language      TEXT NOT NULL,
        card_id       TEXT NOT NULL,
        position      INTEGER NOT NULL,
        slot          INTEGER NOT NULL,
        id            TEXT NOT NULL,
        name          TEXT NOT NULL,
        effect        TEXT NOT NULL,
        effect_rich   TEXT NOT NULL,
        elements      TEXT NOT NULL,
        grants_skill  TEXT,
        actions       TEXT NOT NULL,
        PRIMARY KEY (version, language, card_id, position),
        FOREIGN KEY (version, language, card_id) REFERENCES card (version, language, id) ON DELETE CASCADE
      );

      -- Plan de rendu des cartes : non versionné par la source, on garde le dernier reçu.
      CREATE TABLE card_layout (
        id          INTEGER PRIMARY KEY CHECK (id = 1),
        document    TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );
    `,
  },
  {
    version: 2,
    name: 'add_card_traits',
    sql: `
      -- Caractéristiques dérivées des cartes, calculées une fois à l'import.
      -- analysis_version : version des règles d'analyse ; NULL ou ancienne = à recalculer.
      ALTER TABLE catalog ADD COLUMN analysis_version INTEGER;
      -- Catégories et capacités particulières présentes (libellé, icône, description), en JSON.
      ALTER TABLE catalog ADD COLUMN trait_definitions TEXT;

      -- Une ligne par caractéristique : interrogeable directement (ex. cartes à Gel en 1.21).
      CREATE TABLE card_trait (
        version   TEXT NOT NULL,
        language  TEXT NOT NULL,
        card_id   TEXT NOT NULL,
        kind      TEXT NOT NULL CHECK (kind IN ('strike', 'bonus', 'heal', 'ability', 'category')),
        value     TEXT NOT NULL,
        PRIMARY KEY (version, language, card_id, kind, value),
        FOREIGN KEY (version, language, card_id) REFERENCES card (version, language, id) ON DELETE CASCADE
      );
      CREATE INDEX card_trait_by_value ON card_trait (version, language, kind, value);
    `,
  },
  {
    version: 3,
    name: 'add_card_trait_flags',
    sql: `
      -- Indicateurs booléens (ex. multiélément) : kind = 'flag', value = nom de l'indicateur.
      -- SQLite ne modifie pas une contrainte CHECK : la table est recréée. Ses lignes sont
      -- dérivées des cartes, elles seront recalculées à la prochaine synchro.
      DROP TABLE card_trait;
      CREATE TABLE card_trait (
        version   TEXT NOT NULL,
        language  TEXT NOT NULL,
        card_id   TEXT NOT NULL,
        kind      TEXT NOT NULL CHECK (kind IN ('strike', 'bonus', 'heal', 'ability', 'category', 'flag')),
        value     TEXT NOT NULL,
        PRIMARY KEY (version, language, card_id, kind, value),
        FOREIGN KEY (version, language, card_id) REFERENCES card (version, language, id) ON DELETE CASCADE
      );
      CREATE INDEX card_trait_by_value ON card_trait (version, language, kind, value);
      UPDATE catalog SET analysis_version = NULL;
    `,
  },
  {
    version: 4,
    name: 'add_card_stats',
    sql: `
      -- Statistiques chiffrées par carte et par talent (dégâts, éléments générés, résistances...),
      -- calculées à l'import pour l'analyse des decks. Document JSON (voir CardStats).
      CREATE TABLE card_stats (
        version   TEXT NOT NULL,
        language  TEXT NOT NULL,
        card_id   TEXT NOT NULL,
        stats     TEXT NOT NULL,
        PRIMARY KEY (version, language, card_id),
        FOREIGN KEY (version, language, card_id) REFERENCES card (version, language, id) ON DELETE CASCADE
      );
      UPDATE catalog SET analysis_version = NULL;
    `,
  },
  {
    version: 5,
    name: 'create_decks',
    sql: `
      -- Decks composés par l'utilisateur : 4 cartes au plus, chacune avec son talent.
      CREATE TABLE deck (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        version     TEXT NOT NULL,
        language    TEXT NOT NULL,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      -- Pas de clé étrangère vers card : un deck reste lisible même si sa version n'est plus importée.
      CREATE TABLE deck_slot (
        deck_id      TEXT NOT NULL REFERENCES deck (id) ON DELETE CASCADE,
        position     INTEGER NOT NULL,
        card_id      TEXT NOT NULL,
        talent_slot  INTEGER NOT NULL,
        PRIMARY KEY (deck_id, position),
        UNIQUE (deck_id, card_id)
      );
    `,
  },
  {
    version: 6,
    name: 'add_deck_dps',
    sql: `
      -- Carte qui reçoit les renforts ciblés (précision, critique, dégâts de base). Facultative.
      ALTER TABLE deck ADD COLUMN dps_card_id TEXT;
      -- Le modèle des cartes change (simulation des renforts) : à recalculer à la prochaine synchro.
      UPDATE catalog SET analysis_version = NULL;
    `,
  },
  {
    version: 7,
    name: 'optional_deck_talent',
    sql: `
      -- Une carte du deck peut n'avoir aucun talent : talent_slot devient facultatif.
      -- SQLite ne modifie pas une contrainte NOT NULL : la table est recréée, données conservées.
      CREATE TABLE deck_slot_new (
        deck_id      TEXT NOT NULL REFERENCES deck (id) ON DELETE CASCADE,
        position     INTEGER NOT NULL,
        card_id      TEXT NOT NULL,
        talent_slot  INTEGER,
        PRIMARY KEY (deck_id, position),
        UNIQUE (deck_id, card_id)
      );
      INSERT INTO deck_slot_new SELECT deck_id, position, card_id, talent_slot FROM deck_slot;
      DROP TABLE deck_slot;
      ALTER TABLE deck_slot_new RENAME TO deck_slot;
    `,
  },
];
