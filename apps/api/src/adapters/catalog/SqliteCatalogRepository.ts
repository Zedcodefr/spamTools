import type { DatabaseSync, SQLInputValue, SQLOutputValue } from 'node:sqlite';
import {
  Card,
  CardLayout,
  Catalog,
  CatalogVersion,
  type CardAction,
  type CardData,
  type CatalogRepository,
} from '@spamtools/card-catalog';
import type { SqliteDatabase } from '@spamtools/database/infrastructure';

type Row = Record<string, SQLOutputValue>;

/**
 * Adaptateur : catalogues stockés dans SQLite (schéma : migrations.ts).
 * Une version importée ne change plus, les catalogues lus sont donc gardés en cache.
 */
export class SqliteCatalogRepository implements CatalogRepository {
  private readonly cache = new Map<string, Catalog>();

  constructor(
    private readonly database: SqliteDatabase,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async has(version: CatalogVersion, language: string): Promise<boolean> {
    return (
      this.database.connection
        .prepare('SELECT 1 FROM catalog WHERE version = ? AND language = ?')
        .get(version.value, language) !== undefined
    );
  }

  async save(catalog: Catalog, rawDocument: string): Promise<void> {
    const scope = { version: catalog.version.value, language: catalog.language };

    this.database.transaction((db) => {
      insert(db, 'catalog', {
        ...scope,
        generated_at: catalog.generatedAt.toISOString(),
        imported_at: this.clock().toISOString(),
        raw_document: rawDocument,
      });
      for (const element of catalog.elements) {
        insert(db, 'element', {
          ...scope,
          id: element.id,
          name: element.name,
          sort_order: element.order,
          icon: element.icon,
          color: element.color,
        });
      }
      for (const rarity of catalog.rarities) {
        insert(db, 'rarity', {
          ...scope,
          id: rarity.id,
          name: rarity.name,
          sort_order: rarity.order,
          gem: rarity.gem,
          text_color: rarity.textColor,
        });
      }
      catalog.keywords.forEach((keyword, position) => {
        insert(db, 'keyword', {
          ...scope,
          id: keyword.id,
          position,
          title: keyword.title,
          description: keyword.description,
          description_rich: keyword.descriptionRich,
          tooltip: keyword.tooltip,
          color: keyword.color,
          icon: keyword.icon,
        });
      });
      for (const card of catalog.cards) {
        insertCard(db, scope, card.data);
      }
    });
  }

  async find(language: string, version?: CatalogVersion): Promise<Catalog | undefined> {
    const target = version ?? this.latestVersion(language);
    if (target === undefined) {
      return undefined;
    }
    const key = `${target.value}/${language}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const catalog = this.load(target, language);
    if (catalog !== undefined) {
      this.cache.set(key, catalog);
    }
    return catalog;
  }

  async saveLayout(layout: CardLayout): Promise<void> {
    this.database.connection
      .prepare(
        `INSERT INTO card_layout (id, document, updated_at) VALUES (1, ?, ?)
         ON CONFLICT (id) DO UPDATE SET document = excluded.document, updated_at = excluded.updated_at`,
      )
      .run(JSON.stringify(layout.document), this.clock().toISOString());
  }

  async findLayout(): Promise<CardLayout | undefined> {
    const row = this.database.connection.prepare('SELECT document FROM card_layout WHERE id = 1').get();
    return row === undefined ? undefined : CardLayout.of(JSON.parse(text(row, 'document')));
  }

  private latestVersion(language: string): CatalogVersion | undefined {
    // Tri en code : un tri SQL sur le texte placerait "1.9" après "1.10".
    return this.database.connection
      .prepare('SELECT version FROM catalog WHERE language = ?')
      .all(language)
      .map((row) => CatalogVersion.of(text(row, 'version')))
      .reduce<CatalogVersion | undefined>(
        (latest, candidate) => (latest === undefined || candidate.compareTo(latest) > 0 ? candidate : latest),
        undefined,
      );
  }

  private load(version: CatalogVersion, language: string): Catalog | undefined {
    const db = this.database.connection;
    const scope = [version.value, language] as const;
    const select = (table: string, orderBy: string): Row[] =>
      db.prepare(`SELECT * FROM ${table} WHERE version = ? AND language = ? ORDER BY ${orderBy}`).all(...scope);

    const catalogRow = db.prepare('SELECT generated_at FROM catalog WHERE version = ? AND language = ?').get(...scope);
    if (catalogRow === undefined) {
      return undefined;
    }

    const resistances = groupByCard(select('card_resistance', 'card_id, element'));
    const abilities = groupByCard(select('card_ability', 'card_id, position'));
    const skills = groupByCard(select('card_skill', 'card_id, position'));
    const talents = groupByCard(select('card_talent', 'card_id, position'));

    return Catalog.create({
      version,
      language,
      generatedAt: new Date(text(catalogRow, 'generated_at')),
      elements: select('element', 'sort_order').map((row) => ({
        id: text(row, 'id'),
        name: text(row, 'name'),
        order: num(row, 'sort_order'),
        icon: text(row, 'icon'),
        color: text(row, 'color'),
      })),
      rarities: select('rarity', 'sort_order').map((row) => ({
        id: text(row, 'id'),
        name: text(row, 'name'),
        order: num(row, 'sort_order'),
        gem: text(row, 'gem'),
        textColor: nullableText(row, 'text_color'),
      })),
      keywords: select('keyword', 'position').map((row) => ({
        id: text(row, 'id'),
        title: text(row, 'title'),
        description: text(row, 'description'),
        descriptionRich: text(row, 'description_rich'),
        tooltip: text(row, 'tooltip'),
        color: nullableText(row, 'color'),
        icon: nullableText(row, 'icon'),
      })),
      cards: select('card', 'number').map((row) => {
        const id = text(row, 'id');
        return Card.create({
          id,
          slug: text(row, 'slug'),
          number: num(row, 'number'),
          name: text(row, 'name'),
          element: text(row, 'element'),
          rarity: text(row, 'rarity'),
          spamton: num(row, 'spamton'),
          hp: num(row, 'hp'),
          resistances: Object.fromEntries((resistances.get(id) ?? []).map((r) => [text(r, 'element'), num(r, 'value')])),
          artwork: {
            file: text(row, 'artwork_file'),
            small: text(row, 'artwork_small'),
            tiny: text(row, 'artwork_tiny'),
            width: num(row, 'artwork_width'),
            height: num(row, 'artwork_height'),
            artist: { name: text(row, 'artist_name'), link: nullableText(row, 'artist_link') },
          },
          abilities: (abilities.get(id) ?? []).map((ability) => ({
            id: text(ability, 'id'),
            name: text(ability, 'name'),
            effect: text(ability, 'effect'),
            effectRich: text(ability, 'effect_rich'),
            cooldown: num(ability, 'cooldown'),
            elements: json<string[]>(ability, 'elements'),
            precision: num(ability, 'precision'),
            critChance: num(ability, 'crit_chance'),
            critMultiplier: num(ability, 'crit_multiplier'),
            duration: num(ability, 'duration'),
            uses: num(ability, 'uses'),
            cooldownResetChance: num(ability, 'cooldown_reset_chance'),
            actions: json<CardAction[]>(ability, 'actions'),
          })),
          skills: (skills.get(id) ?? []).map((skill) => ({
            id: text(skill, 'id'),
            name: text(skill, 'name'),
            effect: text(skill, 'effect'),
            effectRich: text(skill, 'effect_rich'),
            rarity: text(skill, 'rarity'),
            element: nullableText(skill, 'element'),
            value: num(skill, 'value'),
            icon: nullableText(skill, 'icon'),
          })),
          talents: (talents.get(id) ?? []).map((talent) => ({
            slot: num(talent, 'slot'),
            id: text(talent, 'id'),
            name: text(talent, 'name'),
            effect: text(talent, 'effect'),
            effectRich: text(talent, 'effect_rich'),
            elements: json<string[]>(talent, 'elements'),
            grantsSkill: nullableText(talent, 'grants_skill'),
            actions: json<CardAction[]>(talent, 'actions'),
          })),
          lore: {
            species: text(row, 'lore_species'),
            region: text(row, 'lore_region'),
            era: text(row, 'lore_era'),
            text: text(row, 'lore_text'),
          },
        });
      }),
    });
  }
}

function insertCard(db: DatabaseSync, scope: { version: string; language: string }, card: CardData): void {
  const owner = { ...scope, card_id: card.id };
  insert(db, 'card', {
    ...scope,
    id: card.id,
    number: card.number,
    slug: card.slug,
    name: card.name,
    element: card.element,
    rarity: card.rarity,
    spamton: card.spamton,
    hp: card.hp,
    artwork_file: card.artwork.file,
    artwork_small: card.artwork.small,
    artwork_tiny: card.artwork.tiny,
    artwork_width: card.artwork.width,
    artwork_height: card.artwork.height,
    artist_name: card.artwork.artist.name,
    artist_link: card.artwork.artist.link,
    lore_species: card.lore.species,
    lore_region: card.lore.region,
    lore_era: card.lore.era,
    lore_text: card.lore.text,
  });
  for (const [element, value] of Object.entries(card.resistances)) {
    insert(db, 'card_resistance', { ...owner, element, value });
  }
  card.abilities.forEach((ability, position) => {
    insert(db, 'card_ability', {
      ...owner,
      position,
      id: ability.id,
      name: ability.name,
      effect: ability.effect,
      effect_rich: ability.effectRich,
      cooldown: ability.cooldown,
      elements: JSON.stringify(ability.elements),
      precision: ability.precision,
      crit_chance: ability.critChance,
      crit_multiplier: ability.critMultiplier,
      duration: ability.duration,
      uses: ability.uses,
      cooldown_reset_chance: ability.cooldownResetChance,
      actions: JSON.stringify(ability.actions),
    });
  });
  card.skills.forEach((skill, position) => {
    insert(db, 'card_skill', {
      ...owner,
      position,
      id: skill.id,
      name: skill.name,
      effect: skill.effect,
      effect_rich: skill.effectRich,
      rarity: skill.rarity,
      element: skill.element,
      value: skill.value,
      icon: skill.icon,
    });
  });
  card.talents.forEach((talent, position) => {
    insert(db, 'card_talent', {
      ...owner,
      position,
      slot: talent.slot,
      id: talent.id,
      name: talent.name,
      effect: talent.effect,
      effect_rich: talent.effectRich,
      elements: JSON.stringify(talent.elements),
      grants_skill: talent.grantsSkill,
      actions: JSON.stringify(talent.actions),
    });
  });
}

/** Les noms de table et de colonnes viennent du code, jamais des données. */
function insert(db: DatabaseSync, table: string, row: Record<string, SQLInputValue>): void {
  const columns = Object.keys(row);
  db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`).run(
    ...Object.values(row),
  );
}

function groupByCard(rows: Row[]): Map<string, Row[]> {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const cardId = text(row, 'card_id');
    groups.set(cardId, [...(groups.get(cardId) ?? []), row]);
  }
  return groups;
}

function text(row: Row, column: string): string {
  const value = row[column];
  if (typeof value !== 'string') {
    throw new Error(`Colonne ${column} : texte attendu`);
  }
  return value;
}

function nullableText(row: Row, column: string): string | null {
  return row[column] === null ? null : text(row, column);
}

function num(row: Row, column: string): number {
  const value = row[column];
  if (typeof value !== 'number') {
    throw new Error(`Colonne ${column} : nombre attendu`);
  }
  return value;
}

function json<T>(row: Row, column: string): T {
  return JSON.parse(text(row, column)) as T;
}
