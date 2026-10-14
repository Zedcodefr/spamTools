import {
  Card,
  CardLayout,
  Catalog,
  CatalogVersion,
  type Ability,
  type CardAction,
  type CardData,
  type CardElement,
  type Keyword,
  type Rarity,
  type Skill,
  type Talent,
} from '../../domain/index.js';
import type { CatalogIndex } from '../../application/index.js';
import { InvalidSourceDataError, JsonReader } from './JsonReader.js';

/**
 * Traduction du format publié sur spamgame.com/data vers le modèle du catalogue.
 * Seul endroit qui connaît ce format : s'il change, le numéro `schema` change.
 */

const SUPPORTED_SCHEMA = 1;

export interface SpamGameIndex extends CatalogIndex {
  /** Modèle de chemin du document de cartes, ex. "{version}/cards.{language}.json". */
  readonly cardsPathTemplate: string;
  readonly layoutPath: string;
}

export function parseIndex(text: string): SpamGameIndex {
  const root = readDocument(text, 'index');
  return {
    latest: CatalogVersion.of(root.string('latest')),
    versions: root.array('versions').map((entry) => CatalogVersion.of(entry.string('version'))),
    languages: root.array('languages').map((language) => language.string()),
    cardsPathTemplate: root.string('cards'),
    layoutPath: root.string('layout'),
  };
}

export function parseLayout(text: string): CardLayout {
  return CardLayout.of(readDocument(text, 'layout').object());
}

export function parseCatalog(text: string): Catalog {
  const root = readDocument(text, 'cartes');
  return Catalog.create({
    version: CatalogVersion.of(root.string('version')),
    language: root.string('language'),
    generatedAt: readDate(root.get('generatedAt')),
    elements: root.array('elements').map(readElement),
    rarities: root.array('rarities').map(readRarity),
    keywords: root.array('keywords').map(readKeyword),
    cards: root.array('cards').map((card) => Card.create(readCard(card))),
  });
}

function readDocument(text: string, label: string): JsonReader {
  let root: JsonReader;
  try {
    root = new JsonReader(JSON.parse(text));
  } catch (error) {
    throw new InvalidSourceDataError(`Document ${label} illisible : ${error instanceof Error ? error.message : error}`);
  }
  const schema = root.number('schema');
  if (schema !== SUPPORTED_SCHEMA) {
    throw new InvalidSourceDataError(
      `Document ${label} au format schema ${schema}, seul le schema ${SUPPORTED_SCHEMA} est pris en charge`,
    );
  }
  return root;
}

function readDate(reader: JsonReader): Date {
  const date = new Date(reader.string());
  if (Number.isNaN(date.getTime())) {
    throw new InvalidSourceDataError(`${reader.path} : date invalide`);
  }
  return date;
}

function readElement(reader: JsonReader): CardElement {
  return {
    id: reader.string('id'),
    name: reader.string('name'),
    order: reader.number('order'),
    icon: reader.string('icon'),
    color: reader.string('color'),
  };
}

function readRarity(reader: JsonReader): Rarity {
  return {
    id: reader.string('id'),
    name: reader.string('name'),
    order: reader.number('order'),
    gem: reader.string('gem'),
    textColor: reader.nullableString('textColor'),
  };
}

function readKeyword(reader: JsonReader): Keyword {
  const decoration = reader.optional('decoration');
  return {
    id: reader.string('id'),
    title: reader.string('title'),
    description: reader.string('description'),
    descriptionRich: reader.string('descriptionRich'),
    tooltip: reader.string('tooltip'),
    color: decoration?.nullableString('color') ?? null,
    icon: decoration?.optional('icon')?.string('src') ?? null,
  };
}

function readCard(reader: JsonReader): CardData {
  const artwork = reader.get('artwork');
  const artist = artwork.get('artist');
  const lore = reader.get('lore');
  return {
    id: reader.string('id'),
    slug: reader.string('slug'),
    number: reader.number('number'),
    name: reader.string('name'),
    element: reader.string('element'),
    rarity: reader.string('rarity'),
    spamton: reader.number('spamton'),
    hp: reader.number('hp'),
    resistances: Object.fromEntries(reader.entries('resistances').map(([element, value]) => [element, value.number()])),
    artwork: {
      file: artwork.string('file'),
      small: artwork.string('small'),
      tiny: artwork.string('tiny'),
      width: artwork.number('width'),
      height: artwork.number('height'),
      artist: { name: artist.string('name'), link: artist.nullableString('link') },
    },
    abilities: reader.array('abilities').map(readAbility),
    skills: reader.array('skills').map(readSkill),
    talents: reader.array('talents').map(readTalent),
    lore: {
      species: lore.string('species'),
      region: lore.string('region'),
      era: lore.string('era'),
      text: lore.string('text'),
    },
  };
}

function readAbility(reader: JsonReader): Ability {
  return {
    id: reader.string('id'),
    name: reader.string('name'),
    effect: reader.string('effect'),
    effectRich: reader.string('effectRich'),
    cooldown: reader.number('cooldown'),
    elements: reader.array('elements').map((element) => element.string()),
    precision: reader.number('precision'),
    critChance: reader.number('critChance'),
    critMultiplier: reader.number('critMultiplier'),
    duration: reader.number('duration'),
    uses: reader.number('uses'),
    cooldownResetChance: reader.number('cooldownResetChance'),
    actions: reader.array('actions').map(readAction),
  };
}

function readSkill(reader: JsonReader): Skill {
  return {
    id: reader.string('id'),
    name: reader.string('name'),
    effect: reader.string('effect'),
    effectRich: reader.string('effectRich'),
    rarity: reader.string('rarity'),
    element: reader.nullableString('element'),
    value: reader.number('value'),
    icon: reader.nullableString('icon'),
  };
}

function readTalent(reader: JsonReader): Talent {
  return {
    slot: reader.number('slot'),
    id: reader.string('id'),
    name: reader.string('name'),
    effect: reader.string('effect'),
    effectRich: reader.string('effectRich'),
    elements: reader.array('elements').map((element) => element.string()),
    grantsSkill: reader.nullableString('grantsSkill'),
    actions: reader.array('actions').map(readAction),
  };
}

function readAction(reader: JsonReader): CardAction {
  return {
    effect: reader.string('effect'),
    kind: reader.string('kind'),
    min: reader.number('min'),
    max: reader.number('max'),
    element: reader.nullableString('element'),
    chain: reader.number('chain'),
    percent: reader.boolean('percent', false),
  };
}
