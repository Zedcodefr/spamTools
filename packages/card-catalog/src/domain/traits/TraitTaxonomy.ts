import type { TraitCategory, TraitIcon } from './CardTraits.js';

/**
 * Classement des capacités particulières, à faire évoluer avec le jeu.
 * Toute modification des règles ou du classement doit incrémenter ANALYSIS_VERSION
 * pour que les catalogues déjà importés soient recalculés.
 */
export const ANALYSIS_VERSION = 7;

const symbol = (name: string): TraitIcon => ({ type: 'symbol', name });

export const TRAIT_CATEGORIES: readonly TraitCategory[] = [
  { id: 'multitarget', label: 'Multicible', description: 'Touche plusieurs cibles : zone, coups multiples ou cibles aléatoires', icon: symbol('Crosshair') },
  { id: 'damage', label: 'Dégâts', description: 'Dégâts supplémentaires, relances et dégâts particuliers', icon: symbol('Swords') },
  { id: 'bonus', label: 'Bonus', description: 'Renforce les dégâts et les soins, ou en ajoute', icon: symbol('ChevronsUp') },
  { id: 'affliction', label: 'Altérations', description: "Effets négatifs infligés à l'adversaire", icon: symbol('Skull') },
  { id: 'protection', label: 'Protection', description: 'Réduit, renvoie ou empêche les dégâts et les effets adverses', icon: symbol('Shield') },
  { id: 'healing', label: 'Soin et survie', description: 'Soigne, régénère ou ramène à la vie', icon: symbol('HeartPulse') },
  { id: 'elements', label: 'Passifs élémentaires', description: 'Génère, vole ou amplifie les éléments et les bonus élémentaires', icon: symbol('Atom') },
  { id: 'cooldown', label: 'Temps de recharge', description: 'Agit sur les temps de recharge des compétences', icon: symbol('Hourglass') },
  { id: 'economy', label: 'Économie', description: 'Spamtons, Chance et achats de tox', icon: symbol('Coins') },
  { id: 'chance', label: 'Hasard et transformation', description: 'Effets aléatoires, choix et métamorphoses', icon: symbol('Dices') },
  { id: 'usage', label: "Conditions d'utilisation", description: 'Coût, usages limités et contreparties', icon: symbol('Lock') },
  { id: 'other', label: 'Autres', description: 'Capacités pas encore classées', icon: symbol('Sparkles') },
];

export const DEFAULT_CATEGORY = 'other';

export interface KnownAbility {
  readonly category: string;
  /** Symbole utilisé si les données du jeu ne fournissent pas d'icône. */
  readonly symbol?: string;
}

/**
 * Capacités connues, par nom affiché. Une capacité nommée qui n'y figure pas
 * (nouveau tox d'une prochaine version) est quand même détectée, classée « Autres ».
 */
export const KNOWN_ABILITIES: Readonly<Record<string, KnownAbility>> = {
  // Multicible
  'Attaque multiple': { category: 'multitarget', symbol: 'Repeat2' },
  'Attaque de zone': { category: 'multitarget', symbol: 'Expand' },
  'Ennemis aléatoires': { category: 'multitarget', symbol: 'Shuffle' },
  AoE: { category: 'multitarget', symbol: 'Radar' },
  // Dégâts
  Bomba: { category: 'damage', symbol: 'Bomb' },
  Absorbe: { category: 'damage', symbol: 'Magnet' },
  Écho: { category: 'damage', symbol: 'Repeat' },
  Roulette: { category: 'damage', symbol: 'RefreshCw' },
  'Dégâts en % des PV max': { category: 'damage', symbol: 'Percent' },
  'Souffle élémentaire': { category: 'damage', symbol: 'Flame' },
  // Bonus
  Brut: { category: 'bonus', symbol: 'Axe' },
  Berserk: { category: 'bonus', symbol: 'BicepsFlexed' },
  Multiplicateur: { category: 'bonus', symbol: 'CopyPlus' },
  Érosion: { category: 'bonus', symbol: 'Mountain' },
  Revanche: { category: 'bonus', symbol: 'Skull' },
  Vengeur: { category: 'bonus', symbol: 'Sword' },
  // Altérations
  Gel: { category: 'affliction', symbol: 'Snowflake' },
  Poison: { category: 'affliction', symbol: 'Biohazard' },
  Disparition: { category: 'affliction', symbol: 'Ghost' },
  // Protection
  Provocation: { category: 'protection', symbol: 'Megaphone' },
  Immunité: { category: 'protection', symbol: 'ShieldCheck' },
  Renvoi: { category: 'protection', symbol: 'Undo2' },
  Ténacité: { category: 'protection', symbol: 'Anchor' },
  'Cœur résistance': { category: 'protection', symbol: 'ShieldHalf' },
  Fumée: { category: 'protection', symbol: 'CloudFog' },
  'Insensible aux Disparitions': { category: 'protection', symbol: 'EyeOff' },
  'Insensible aux Éternités': { category: 'protection', symbol: 'ShieldBan' },
  "Cœur d'acier": { category: 'protection', symbol: 'ShieldPlus' },
  'Chance vitale': { category: 'protection', symbol: 'Clover' },
  Paradoxe: { category: 'protection', symbol: 'ArrowLeftRight' },
  // Soin et survie
  Vampirisme: { category: 'healing', symbol: 'Droplets' },
  'Soin primitif': { category: 'healing', symbol: 'Leaf' },
  'Cœur vital': { category: 'healing', symbol: 'Heart' },
  Phénix: { category: 'healing', symbol: 'Bird' },
  Résurrection: { category: 'healing', symbol: 'Egg' },
  'Restauration des PV': { category: 'healing', symbol: 'BatteryCharging' },
  'PV doublés': { category: 'healing', symbol: 'HeartHandshake' },
  Inversement: { category: 'healing', symbol: 'RefreshCcw' },
  // Passifs élémentaires
  'Cœur de feu': { category: 'elements' },
  "Cœur d'eau": { category: 'elements' },
  'Cœur de terre': { category: 'elements' },
  'Cœur de nature': { category: 'elements' },
  "Cœur d'ombre": { category: 'elements' },
  'Cœur de lumière': { category: 'elements' },
  'Cœur aléatoire': { category: 'elements', symbol: 'Gem' },
  'Sac de frappe': { category: 'elements', symbol: 'Target' },
  Mimétisme: { category: 'elements', symbol: 'Eye' },
  Cimetière: { category: 'elements', symbol: 'Skull' },
  "Vol d'élément": { category: 'elements', symbol: 'Orbit' },
  // Temps de recharge
  Temporalité: { category: 'cooldown', symbol: 'Timer' },
  Éternité: { category: 'cooldown', symbol: 'Infinity' },
  Reset: { category: 'cooldown', symbol: 'RotateCcw' },
  'Recharge au maximum': { category: 'cooldown', symbol: 'TimerReset' },
  // Économie
  Spamland: { category: 'economy', symbol: 'Coins' },
  Chanceur: { category: 'economy', symbol: 'Clover' },
  'Tox chanceux': { category: 'economy', symbol: 'Gift' },
  'Petit prix': { category: 'economy', symbol: 'Receipt' },
  'Dette de Spamton': { category: 'economy', symbol: 'Banknote' },
  'Spamtons adverses à zéro': { category: 'economy', symbol: 'PiggyBank' },
  // Hasard et transformation
  'Métamorphe aléatoire': { category: 'chance', symbol: 'WandSparkles' },
  Mystère: { category: 'chance', symbol: 'Puzzle' },
  Évolution: { category: 'chance', symbol: 'TrendingUp' },
  Choix: { category: 'chance', symbol: 'Split' },
  // Conditions d'utilisation
  Coût: { category: 'usage', symbol: 'CircleDollarSign' },
  'Usage unique': { category: 'usage', symbol: 'Zap' },
  'Usage limité': { category: 'usage', symbol: 'Hash' },
  Contrecoup: { category: 'usage', symbol: 'Activity' },
};

/**
 * Mots-clés du glossaire qui sont des mécaniques (et non des statistiques ou des monnaies).
 * « Aléatoire » (random) est exclu : trop général ; les éléments aléatoires relèvent du
 * filtre multiélément, les cibles aléatoires d'« Ennemis aléatoires ».
 */
export const MECHANIC_KEYWORDS: ReadonlySet<string> = new Set([
  'absorb', 'echo', 'cost', 'singleUse', 'limitedUse', 'choice', 'randomEnemies',
]);

/** Capacités que les données ne nomment pas : reconnues à leur code d'action. */
export const UNNAMED_ACTIONS: Readonly<Record<string, string>> = {
  AddSParadoxe: 'Paradoxe',
  AddSInsensibleEternite: 'Insensible aux Éternités',
  AddSInsensibleDisparition: 'Insensible aux Disparitions',
  AddSCoeurAcier: "Cœur d'acier",
  AddSChanceVitale: 'Chance vitale',
  AddSPetitPrix: 'Petit prix',
  AddSToxChanceux: 'Tox chanceux',
  AddSRoulette: 'Roulette',
  AddSCoeurCorrompu: 'Cœur aléatoire',
  EffectEvolution: 'Évolution',
  Resurection: 'Résurrection',
  StealElement: "Vol d'élément",
  DamageAll: 'Attaque de zone',
  DamageOpponentHPMAX: 'Dégâts en % des PV max',
  SetHPInPercent: 'Restauration des PV',
  MultiplyAllHP_x2: 'PV doublés',
  ResetCooldownTarget: 'Recharge au maximum',
  SetSpamton: 'Dette de Spamton',
  ResetSpamton: 'Spamtons adverses à zéro',
};

/** Capacités reconnues à une ligne de texte d'effet (textes normalisés : sans accents, minuscules). */
export const TEXT_PATTERNS: readonly { readonly label: string; readonly pattern: RegExp }[] = [
  { label: 'Attaque de zone', pattern: /cible toutes les cartes adverses/ },
  { label: 'Ennemis aléatoires', pattern: /cible aleatoirement les cartes adverses/ },
];

/** Passifs « naturels » (tox de la carte ou donné par un talent) qui accordent un bonus élémentaire. */
export const PUNCHING_BAG = 'Sac de frappe';
export const RANDOM_HEART = 'Cœur aléatoire';

/** Effet dans un élément tiré au hasard (texte normalisé d'une ligne d'attaque, de soin ou de bonus). */
export const RANDOM_ELEMENT_LINE = /^(attaque|bonus|soigne|se soigne)\b.*element aleatoire|change aleatoirement l'element/;
/** Codes d'action agissant dans un élément aléatoire. */
export const RANDOM_ELEMENT_ACTION = /RandomTeam|ChangeElement.*Random/;
