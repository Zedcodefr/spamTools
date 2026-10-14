import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Ability, CardAction, CardData, Skill, Talent } from '../Card.js';
import type { Keyword } from '../References.js';
import { analyzeTraits } from './analyzeTraits.js';
import { ANALYSIS_VERSION } from './TraitTaxonomy.js';

const action = (effect: string, kind: string, element: string | null, chain = 0): CardAction => ({
  effect, kind, element, chain, min: 10, max: 10, percent: false,
});

const ability = (actions: CardAction[], effect = '', effectRich = effect): Ability => ({
  id: 'a', name: 'Capacité', effect, effectRich, cooldown: 1, elements: [], precision: 100, critChance: 0,
  critMultiplier: 2, duration: 0, uses: 0, cooldownResetChance: 0, actions,
});

const skill = (id: string, name: string, overrides: Partial<Skill> = {}): Skill => ({
  id, name, effect: `${name} : effet`, effectRich: '', rarity: 'common', element: null, value: 0, icon: null, ...overrides,
});

const talent = (overrides: Partial<Talent>): Talent => ({
  slot: 1, id: 't', name: 'Talent', effect: '', effectRich: '', elements: [], grantsSkill: null, actions: [], ...overrides,
});

const keyword = (id: string, title: string, tooltip = 'passive', icon: string | null = null): Keyword => ({
  id, title, tooltip, icon, description: `${title} : description`, descriptionRich: '', color: null,
});

function card(id: string, overrides: Partial<CardData>): CardData {
  return {
    id, slug: id, number: 1, name: id, element: 'shadow', rarity: 'common', spamton: 10, hp: 500,
    resistances: { fire: 10, water: 10, earth: 10, nature: 10, shadow: 10, light: 10 },
    abilities: [], skills: [], talents: [],
    artwork: { file: '', small: '', tiny: '', width: 1, height: 1, artist: { name: 'Atto', link: null } },
    lore: { species: '', region: '', era: '', text: '' },
    ...overrides,
  };
}

const keywords = [
  keyword('tox.Taunt', 'Provocation'),
  keyword('talent.TBrut', 'Brut'),
  keyword('random', 'Aléatoire', 'glossary'),
  keyword('talent.TCoeurEau_C', "Cœur d'eau"),
  keyword('talent.TPunchingBag', 'Sac de frappe'),
  keyword('choice', 'Choix', 'glossary'),
  keyword('critical', 'Critique', 'glossary'),
  keyword('ability.Souffle elementaire', 'Souffle élémentaire', 'active', 'img/elements/divine.webp'),
];

const cards = [
  card('striker', {
    abilities: [
      ability([action('damage', 'damage', 'fire'), action('AddAllPlayerAttack', 'other', 'water')]),
      ability([action('DamageWithCardElement', 'damage', null), action('healTarget', 'heal', 'light')]),
      ability([action('_NULL', 'other', null)], 'Applique Provocation', 'Applique {kw:tox.Taunt}Provocation{/kw} {kw:critical}x{/kw}'),
    ],
  }),
  card('bag', {
    element: 'nature',
    skills: [
      skill('PunchingBag_C', 'Sac de frappe', { icon: 'img/skills/tox_sac_de_frappe.webp' }),
      skill('CoeurFeu_R', 'Cœur de feu', { element: 'fire' }),
    ],
    talents: [talent({ grantsSkill: 'Brut_R' }), talent({ effect: 'Commence avec le passif Cœur de terre', grantsSkill: null })],
  }),
  card('multi', {
    abilities: [
      ability(
        [action('damage', 'damage', 'light', 0), action('damage', 'damage', 'light', 1)],
        'Cible aléatoirement les cartes adverses\nAttaque 3 Lumière X2',
      ),
      ability([action('DamageAll', 'damage', 'fire')], 'Cible toutes les cartes adverses\nAttaque 5 Feu'),
    ],
    talents: [talent({ effect: 'La carte est insensible aux Disparitions.', actions: [action('AddSInsensibleDisparition', 'other', null)] })],
  }),
  card('talented', {
    element: 'earth',
    skills: [skill('CoeurEau_C', "Cœur d'eau", { element: 'water' })],
    talents: [talent({ grantsSkill: 'PunchingBag_C' }), talent({ actions: [action('AddSCoeurCorrompu', 'other', null)] })],
  }),
  card('rainbow', {
    abilities: [
      ability(['fire', 'water', 'earth', 'nature', 'shadow', 'light'].map((element, chain) => action('damage', 'damage', element, chain))),
    ],
  }),
  card('random', {
    abilities: [ability([action('AddAllPlayerAttackRandomTeam', 'other', null)], 'Bonus (+35) dans un élément aléatoire')],
    talents: [talent({ effect: 'Augmente la résistance de tous les éléments', actions: [action('AddCardResistance', 'other', 'fire')] })],
  }),
  card('single', {
    abilities: [
      // Un coup dans trois éléments à la fois : pas une attaque multiple.
      ability([action('damage', 'damage', 'water'), action('damage', 'damage', 'light'), action('damage', 'damage', 'nature')]),
      // Alternatives d'un choix : pas une attaque multiple.
      ability(
        [action('_NULL', 'other', null, 0), action('damage', 'damage', 'fire', 1), action('damage', 'damage', 'shadow', 2)],
        'Choix',
        '{kw:choice}Choix{/kw}',
      ),
      ability([], 'Inflige 500 dégâts bruts'),
    ],
  }),
];

const traits = analyzeTraits({ cards, keywords });
const of = (id: string) => traits.byCard[id];

describe('analyzeTraits', () => {
  it('relève les éléments de frappe et de soin des capacités', () => {
    assert.deepEqual(of('striker')?.strikeElements, ['fire', 'shadow']);
    assert.deepEqual(of('striker')?.healElements, ['light']);
  });

  it('compte en bonus les capacités, le Sac de frappe (élément de la carte) et les Cœurs portés en tox', () => {
    assert.deepEqual(of('striker')?.bonusElements, ['water']);
    assert.deepEqual(of('bag')?.bonusElements, ['fire', 'nature']);
  });

  it('compte en bonus les passifs accordés par un talent (Sac de frappe : élément de la carte)', () => {
    assert.deepEqual(of('talented')?.bonusElements, ['earth', 'water']);
    assert.ok(of('talented')?.specialAbilities.includes('sac de frappe'));
  });

  it('marque multiélément : élément aléatoire, tous les éléments, ou Cœur aléatoire naturel', () => {
    assert.equal(of('random')?.multiElement, true);
    assert.equal(of('rainbow')?.multiElement, true);
    assert.equal(of('talented')?.multiElement, true);
    assert.equal(of('striker')?.multiElement, false);
    assert.deepEqual(of('rainbow')?.strikeElements, ['earth', 'fire', 'light', 'nature', 'shadow', 'water']);
  });

  it('relève passifs et mécaniques : tox, talents, mots-clés, actions et textes', () => {
    assert.deepEqual(of('striker')?.specialAbilities, ['provocation']);
    // « Cœur de terre » n'est connu que si un tox ou un mot-clé le nomme : ici, non.
    assert.deepEqual(of('bag')?.specialAbilities, ['brut', 'cœur de feu', 'sac de frappe']);
    assert.deepEqual(of('multi')?.specialAbilities, [
      'attaque de zone',
      'attaque multiple',
      'ennemis aleatoires',
      'insensible aux disparitions',
    ]);
  });

  it("ne confond pas un coup multi-élément, un choix ou « dégâts bruts » avec une capacité", () => {
    assert.deepEqual(of('single')?.specialAbilities, ['choix']);
  });

  it('range chaque capacité dans sa catégorie et ne liste que celles présentes', () => {
    assert.deepEqual(of('multi')?.categories, ['multitarget', 'protection']);
    assert.deepEqual(
      traits.categories.map((category) => category.id),
      ['multitarget', 'bonus', 'protection', 'elements', 'chance'],
    );
    assert.equal(traits.specialAbilities.some((special) => special.key === 'aleatoire'), false);
    assert.equal(traits.analysisVersion, ANALYSIS_VERSION);
  });

  it("préfère l'icône officielle du jeu et se rabat sur un symbole", () => {
    const icon = (key: string) => traits.specialAbilities.find((special) => special.key === key)?.icon;
    assert.deepEqual(icon('sac de frappe'), { type: 'asset', path: 'img/skills/tox_sac_de_frappe.webp' });
    assert.deepEqual(icon('attaque de zone'), { type: 'symbol', name: 'Expand' });
  });

  it('classe « Autres » une capacité inconnue de la taxonomie', () => {
    const unknown = analyzeTraits({ cards: [card('x', { skills: [skill('Nouveau_C', 'Nouveauté')] })], keywords: [] });
    assert.equal(unknown.specialAbilities[0]?.category, 'other');
  });
});
