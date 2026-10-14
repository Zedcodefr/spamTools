import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Ability, CardAction, CardData, Talent } from '../Card.js';
import { computeCardStats, ENEMY_CARDS, FIELD_CARDS, type StatsContext } from './computeCardStats.js';

const BASE = ['fire', 'water', 'earth', 'nature', 'shadow', 'light'];

const action = (effect: string, kind: string, element: string | null, min = 10, max = min, chain = 0): CardAction => ({
  effect, kind, element, min, max, chain, percent: false,
});

const ability = (actions: CardAction[], overrides: Partial<Ability> = {}): Ability => ({
  id: 'a', name: 'Capacité', effect: '', effectRich: '', cooldown: 1, elements: [], precision: 100, critChance: 0,
  critMultiplier: 2, duration: 0, uses: 0, cooldownResetChance: 0, actions, ...overrides,
});

const talent = (slot: number, overrides: Partial<Talent>): Talent => ({
  slot, id: `t${slot}`, name: `Talent ${slot}`, effect: '', effectRich: '', elements: [], grantsSkill: null, actions: [],
  ...overrides,
});

function card(overrides: Partial<CardData>): CardData {
  return {
    id: 'c', slug: 'c', number: 1, name: 'Carte', element: 'nature', rarity: 'common', spamton: 10, hp: 500,
    resistances: { fire: 10, water: 20 }, abilities: [], skills: [], talents: [],
    artwork: { file: '', small: '', tiny: '', width: 1, height: 1, artist: { name: 'Atto', link: null } },
    lore: { species: '', region: '', era: '', text: '' },
    ...overrides,
  };
}

const context: StatsContext = {
  baseElements: BASE,
  elementIdByName: new Map([['feu', 'fire'], ['ombre', 'shadow'], ['nature', 'nature']]),
  grantedPassive: (granted) =>
    granted.grantsSkill === 'CoeurFeu_C'
      ? { key: 'cœur de feu', label: 'Cœur de feu', description: 'Bonus Feu (+1) par tour de jeu' }
      : granted.grantsSkill === 'PunchingBag_C'
        ? { key: 'sac de frappe', label: 'Sac de frappe', description: null }
        : undefined,
  passiveElement: (key) => (key === 'cœur de feu' ? 'fire' : undefined),
  keyOf: (label) => label.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase(),
};

const stats = (overrides: Partial<CardData>) => computeCardStats(card(overrides), context);
const model = (abilities: Ability[]) => stats({ abilities }).base.abilities;

describe('computeCardStats', () => {
  it('reprend les résistances de base', () => {
    assert.deepEqual(stats({}).base.resistances, { fire: 10, water: 20 });
  });

  it('décrit chaque capacité : période, précision, critique et lignes par élément', () => {
    const [first, second] = model([
      ability([action('damage', 'damage', 'fire', 10, 20), action('AddAllPlayerAttack', 'other', 'water', 2)], {
        precision: 50,
        critChance: 25,
        critMultiplier: 3,
      }),
      // Écho 50 % : disponible au tour suivant une fois sur deux -> période moyenne 0,5 × 1 + 0,5 × 3 = 2.
      ability([action('DamageAll', 'damage', 'shadow', 10)], { cooldown: 3, cooldownResetChance: 50 }),
    ]);
    assert.deepEqual(first?.damage, [{ value: 15, elements: { fire: 1 }, targets: 1, singleTarget: 1, weight: 1 }]);
    assert.deepEqual(first?.bonus, [{ value: 2, elements: { water: 1 }, targets: 1, singleTarget: 1, weight: 1 }]);
    assert.deepEqual([first?.period, first?.precision, first?.critChance, first?.critMultiplier], [1, 50, 25, 3]);
    assert.deepEqual([second?.cooldown, second?.echoChance, second?.period], [3, 0.5, 2]);
    assert.equal(second?.damage[0]?.targets, ENEMY_CARDS);
  });

  it('distingue dégâts totaux et cible unique selon le ciblage', () => {
    const targeting = (effect: string, effectCode = 'damage') =>
      model([ability([action(effectCode, 'damage', 'fire', 10)], { effect })])[0]?.damage.map((line) => [line.targets, line.singleTarget]);
    assert.deepEqual(targeting('Attaque 10 Feu'), [[1, 1]]);
    assert.deepEqual(targeting('Cible toutes les cartes adverses / Attaque 10 Feu'), [[ENEMY_CARDS, 1]]);
    assert.deepEqual(targeting('Attaque 5 Feu', 'DamageAll'), [[ENEMY_CARDS, 1]]);
    assert.deepEqual(targeting('Cible aléatoirement les cartes adverses / Attaque 3 Feu X18'), [[1, 1 / ENEMY_CARDS]]);
    assert.deepEqual(targeting('Attaque 25 Eau / Attaque 25 Eau / Ennemis aléatoires'), [[1, 1 / ENEMY_CARDS]]);
    assert.deepEqual(targeting('Cible aléatoirement les cartes du terrain / Attaque 30 Nature'), [
      [ENEMY_CARDS / FIELD_CARDS, 1 / FIELD_CARDS],
    ]);
  });

  it("pondère les options d'un Choix et répartit un élément aléatoire", () => {
    const [choice, random] = model([
      ability(
        [action('_NULL', 'other', null, 0, 0, 0), action('damage', 'damage', 'fire', 30, 30, 1), action('damage', 'damage', 'water', 10, 10, 2)],
        { effectRich: '{kw:choice}Choix{/kw}' },
      ),
      ability([action('AddAllPlayerAttackRandomTeam', 'other', null, 6)], { effect: 'Bonus (+6) dans un élément aléatoire' }),
      // Données incohérentes (Aidan) : l'action aléatoire porte l'élément de la carte.
      ability([action('AddAllPlayerAttackRandomTeam', 'other', 'fire', 12)], { effect: 'Bonus (+12) dans un élément aléatoire' }),
    ]);
    assert.deepEqual(choice?.damage.map((line) => line.weight), [0.5, 0.5]);
    assert.deepEqual(random?.bonus[0]?.elements, Object.fromEntries(BASE.map((element) => [element, 1 / 6])));
    assert.deepEqual(
      model([ability([action('AddAllPlayerAttackRandomTeam', 'other', 'fire', 12)], { effect: 'Bonus (+12) dans un élément aléatoire' })])[0]
        ?.bonus[0]?.elements,
      Object.fromEntries(BASE.map((element) => [element, 1 / 6])),
    );
  });

  it('relève les croissances par utilisation', () => {
    const [bonus, attack, heal, thisAttack] = model([
      ability([action('AddAllPlayerAttackCountActivation1', 'other', 'shadow', 1)], {
        effect: 'Bonus Ombre (+1). La valeur de base du bonus augmente de 1',
      }),
      ability([action('damage', 'damage', 'earth', 15), action('AddAbilityBaseDamage', 'other', null, 5)]),
      ability([action('healTarget', 'heal', 'water', 10), action('AddAbilityBaseDamage', 'other', null, 3)]),
      ability([action('damage', 'damage', 'nature', 20), action('AddCardBaseDamage', 'other', 'nature', 2)], {
        effect: 'Attaque 20 Nature / Les dégâts de base de cette attaque augmentent de (+2) après utilisation',
      }),
    ]);
    assert.deepEqual(bonus?.growth, { damage: 0, heal: 0, bonus: 1 });
    assert.deepEqual(attack?.growth, { damage: 5, heal: 0, bonus: 0 });
    assert.deepEqual(heal?.growth, { damage: 0, heal: 3, bonus: 0 });
    assert.deepEqual(thisAttack?.growth, { damage: 2, heal: 0, bonus: 0 });
    assert.deepEqual(thisAttack?.boosts, []);
  });

  it('relève les renforts et leur cible : lanceur, alliées, DPS, alliée au hasard ; ignore l’adversaire', () => {
    const boosts = (effect: string, actions: CardAction[], overrides: Partial<Ability> = {}) =>
      model([ability(actions, { effect, ...overrides })])[0]?.boosts;
    assert.deepEqual(boosts('Précision et Critique (+2%) pour le lanceur', [
      action('AddCardCriticChance', 'other', null, 2),
      action('AddCardMiss', 'other', null, -2),
    ]), [
      { stat: 'critChance', amount: 2, target: 'self', chance: 1 },
      { stat: 'precision', amount: 2, target: 'self', chance: 1 },
    ]);
    assert.deepEqual(boosts('Critique (+20%) sur toutes les cartes alliées', [action('AddAllPlayerCritick', 'other', null, 20)]), [
      { stat: 'critChance', amount: 20, target: 'allies', chance: 1 },
    ]);
    assert.deepEqual(boosts('Précision (+12%)', [action('AddOppCardMiss', 'other', null, -12)]), [
      { stat: 'precision', amount: 12, target: 'dps', chance: 1 },
    ]);
    assert.deepEqual(boosts('Critique (+25%) aléatoirement sur une carte alliée', [action('AddOppCardCriticChance', 'other', null, 25)]), [
      { stat: 'critChance', amount: 25, target: 'randomAlly', chance: 1 },
    ]);
    assert.deepEqual(
      boosts('Soigne 20 Nature / Critique (+10%) en cas de coup critique', [action('AddOppCardCriticChance', 'other', null, 10)], {
        critChance: 30,
      }),
      [{ stat: 'critChance', amount: 10, target: 'dps', chance: 0.3 }],
    );
    assert.deepEqual(boosts('Les valeurs de base des soins et des dégâts augmentent de 2', [action('AddOppCardBaseDamage', 'other', null, 2)]), [
      { stat: 'baseDamage', amount: 2, target: 'dps', chance: 1 },
      { stat: 'baseHeal', amount: 2, target: 'dps', chance: 1 },
    ]);
    assert.deepEqual(boosts('Cible toutes les cartes adverses / Précision (-10%)', [action('AddOppCardMiss', 'other', null, 10)]), []);
  });

  it('compte les coûts en éléments et signale les autres', () => {
    const base = stats({
      abilities: [
        ability([], { cooldown: 2, effect: '[Coût 2 Feu & 4 Ombre]\nAttaque' }),
        ability([], { name: 'Sacrifice', effect: '[Coût 100 PV]' }),
      ],
    }).base;
    assert.deepEqual(base.abilities[0]?.cost, { fire: 2, shadow: 4 });
    assert.deepEqual(base.unquantified.map((note) => note.source), ['Sacrifice']);
  });

  it('écarte les usages limités et les effets en pourcentage', () => {
    const base = stats({
      abilities: [
        ability([action('damage', 'damage', 'nature', 90)], { name: 'Valse', uses: 1 }),
        ability([{ ...action('DamageOpponentHPMAX', 'damage', 'fire', 30), percent: true }], { name: 'Ratio' }),
      ],
    }).base;
    assert.deepEqual(base.abilities.map((ability) => ability.name), ['Ratio']);
    assert.deepEqual(base.abilities[0]?.damage, []);
    assert.deepEqual(base.unquantified.map((note) => note.source), ['Valse', 'Ratio']);
  });

  it('compte les Cœurs portés en tox, le Sac de frappe par coup reçu, double les bonus avec Multiplicateur', () => {
    const skill = (id: string, name: string, value: number) => ({
      id, name, effect: '', effectRich: '', rarity: 'rare', element: name === 'Cœur de feu' ? 'fire' : null, value, icon: null,
    });
    const withSkills = stats({ skills: [skill('CoeurFeu_R', 'Cœur de feu', 2), skill('PunchingBag_C', 'Sac de frappe', 1)] });
    assert.deepEqual(withSkills.base.passiveBonusPerTurn, { fire: 2 });
    // Sac de frappe : +1 dans l'élément de la carte (nature) à chaque attaque subie.
    assert.deepEqual(withSkills.base.bonusPerHit, { nature: 1 });
    assert.deepEqual(withSkills.base.unquantified, []);
    assert.equal(stats({ skills: [skill('Multiplicator_R', 'Multiplicateur', 0)] }).bonusFactor, 2);
    assert.equal(withSkills.bonusFactor, 1);
  });

  it("calcule l'apport de chaque talent", () => {
    const { talents } = stats({
      talents: [
        talent(1, { grantsSkill: 'CoeurFeu_C' }),
        talent(2, {
          effect: 'Résistance feu (+25 %) / Résistance eau (+25 %)',
          actions: [action('AddCardResistance', 'other', 'fire', 25), action('AddCardResistance', 'other', 'water', 25)],
        }),
        talent(3, {
          effect: 'Augmente les résistances élémentaires de toutes les cartes alliées de (+10 %)',
          actions: [action('AddOppCardResistance', 'other', 'fire', 10)],
        }),
        talent(4, { effect: 'Bonus (+7) Eau.', actions: [action('AddAllPlayerAttack', 'other', 'water', 7)] }),
        talent(5, {
          name: 'Résilience',
          effect: 'Tant que les PV de cette carte sont sous 50 %, ses résistances augmentent de (+25 %).',
          actions: [action('AddCardResistance', 'other', 'fire', 25)],
        }),
        talent(6, {
          effect: 'Les critiques et la précision de toutes vos cartes augmentent de (+1 %) par tour',
          actions: [action('AddOppCardCriticChance', 'other', null, 1), action('AddOppCardMiss', 'other', null, -1)],
        }),
        talent(7, { effect: 'Bonus critique (+10 %)', actions: [action('AddCardCriticChance', 'other', null, 10)] }),
      ],
    });
    assert.deepEqual(talents['1']?.passiveBonusPerTurn, { fire: 1 });
    assert.deepEqual(talents['2']?.resistances, { fire: 25, water: 25 });
    assert.deepEqual(talents['3']?.allyResistances, { fire: 10 });
    assert.deepEqual(talents['4']?.startingBonus, { water: 7 });
    assert.deepEqual(talents['5']?.resistances, {});
    assert.deepEqual(talents['5']?.unquantified.map((note) => note.source), ['Résilience']);
    assert.deepEqual(talents['6']?.boostsPerTurn, [
      { stat: 'critChance', amount: 1, target: 'allies', chance: 1 },
      { stat: 'precision', amount: 1, target: 'allies', chance: 1 },
    ]);
    assert.deepEqual(talents['7']?.startingBoosts, [{ stat: 'critChance', amount: 10, target: 'self', chance: 1 }]);
  });
});
