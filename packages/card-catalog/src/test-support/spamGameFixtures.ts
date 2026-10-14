/**
 * Documents minimaux au format publié sur spamgame.com/data, pour les tests.
 */

export function indexDocument(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 1,
    latest: '1.21',
    versions: [{ version: '1.20' }, { version: '1.21' }],
    languages: ['fr', 'en'],
    cards: '{version}/cards.{language}.json',
    layout: 'layout.json',
    ...overrides,
  };
}

export function layoutDocument(): Record<string, unknown> {
  return {
    schema: 1,
    width: 961,
    height: 1375,
    body: { image: 'img/frame/body-{element}.webp' },
    rows: { ability: { bar: { image: 'img/frame/ability-bar.webp' } } },
    rarityGem: { image: 'img/frame/rarity-{rarity}.webp' },
  };
}

export function cardDocument(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '18bca5cf-7aa1-421c-85ec-4ed0b6a8ca70',
    slug: 'esprit_feu',
    number: 1,
    name: 'Esprit Feu',
    element: 'fire',
    rarity: 'common',
    spamton: 10,
    hp: 500,
    resistances: { fire: 10, water: 10 },
    artwork: {
      file: 'img/illustrations/1024/esprit_feu.webp',
      small: 'img/illustrations/512/esprit_feu.webp',
      tiny: 'img/illustrations/128/esprit_feu.webp',
      width: 716,
      height: 1024,
      artist: { name: 'Atto', link: 'https://x.com/Atto_Wnd' },
    },
    abilities: [
      {
        id: 'Souffle de feu',
        name: 'Souffle de feu',
        effect: 'Attaque 10 Feu',
        effectRich: 'Attaque 10 {icon:fire} {el:fire}Feu{/el}',
        cooldown: 1,
        elements: ['fire'],
        precision: 100,
        critChance: 1,
        critMultiplier: 2,
        duration: 0,
        uses: 0,
        cooldownResetChance: 0,
        actions: [{ effect: 'damage', kind: 'damage', min: 10, max: 10, element: 'fire', chain: 0 }],
      },
    ],
    skills: [
      {
        id: 'Chance_C',
        name: 'Chanceur',
        effect: 'Augmente votre Chance',
        effectRich: 'Augmente votre {kw:luck}Chance{/kw}',
        rarity: 'common',
        element: null,
        value: 0.5,
        icon: 'img/skills/tox_luck.webp',
      },
    ],
    talents: [
      {
        slot: 1,
        id: 'Terrain aquatique',
        name: 'Terrain aquatique',
        effect: 'Bonus (+7) Eau.',
        effectRich: 'Bonus (+7) Eau.',
        elements: ['water'],
        grantsSkill: null,
        actions: [{ effect: 'AddAllPlayerAttack', kind: 'other', min: 7, max: 7, element: 'water', chain: 0, percent: true }],
      },
    ],
    lore: { species: 'Esprit', region: 'Volcans', era: 'Ère prospère', text: 'Un esprit de feu.' },
    styles: ['cardstyle-standard'],
    ...overrides,
  };
}

export function cardsDocument(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 1,
    version: '1.21',
    language: 'fr',
    generatedAt: '2026-10-09T07:12:00Z',
    elements: [
      { id: 'fire', name: 'Feu', order: 1, icon: 'img/elements/fire.webp', color: '#FC873E' },
      { id: 'water', name: 'Eau', order: 2, icon: 'img/elements/water.webp', color: '#3E9BFC' },
    ],
    rarities: [
      { id: 'common', name: 'Commune', order: 1, gem: 'img/frame/rarity-common.webp', textColor: '#9692A0' },
      { id: 'divine', name: 'Divine', order: 5, gem: 'img/frame/rarity-divine.webp', textColor: null },
    ],
    keywords: [
      {
        id: 'precision',
        title: 'Précision',
        description: 'Chance de toucher',
        descriptionRich: 'Chance de toucher',
        tooltip: 'glossary',
        decoration: { color: '#FFFF59', icon: { src: 'img/keywords/icon-precision.webp', spaced: true } },
      },
    ],
    cards: [
      cardDocument(),
      cardDocument({
        id: '6428d28c-4897-46e4-bcc5-5165484fda2b',
        slug: 'hibernatus',
        number: 12,
        name: 'Hibernatus',
        element: 'water',
        skills: [],
        abilities: [],
        talents: [],
      }),
    ],
    ...overrides,
  };
}
