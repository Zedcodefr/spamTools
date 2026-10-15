import type { CardView } from '@spamtools/card-catalog';
import type { Container } from '../container.js';

/**
 * Référencement : le front est une application React, que tous les robots n'exécutent pas. Le serveur
 * complète donc index.html pour chaque URL : titre, description, URL canonique, Open Graph, données
 * structurées (JSON-LD), et un contenu lisible sans JavaScript (<noscript>). Chaque carte a sa page
 * (/?card=<slug>), listée dans le sitemap.
 */

export const SITE_NAME = 'spamTools';

/** Pages réservées aux comptes ou techniques : jamais indexées. */
const PRIVATE_PATHS = new Set(['/compte', '/admin', '/mot-de-passe', '/connexion', '/collection']);

export interface SeoPage {
  readonly title: string;
  readonly description: string;
  /** Chemin canonique (avec ?card= pour une carte). */
  readonly path: string;
  readonly indexable: boolean;
  readonly jsonLd: readonly Record<string, unknown>[];
  /** Contenu HTML (déjà échappé) affiché sans JavaScript. */
  readonly noscript: string;
}

interface CatalogSnapshot {
  readonly version: string;
  readonly cards: readonly CardView[];
  readonly elementNames: ReadonlyMap<string, string>;
  readonly rarityNames: ReadonlyMap<string, string>;
}

const CACHE_MS = 5 * 60 * 1000;

/** Catalogue le plus récent, gardé quelques minutes (une synchro est prise en compte ensuite). */
export function catalogSnapshots(container: Container): () => Promise<CatalogSnapshot | undefined> {
  let cached: { at: number; snapshot: CatalogSnapshot | undefined } | undefined;
  return async () => {
    if (cached !== undefined && Date.now() - cached.at < CACHE_MS) {
      return cached.snapshot;
    }
    const { language } = container.config;
    let snapshot: CatalogSnapshot | undefined;
    try {
      const [overview, list] = await Promise.all([
        container.getCatalogOverview.execute({ language }),
        container.listCards.execute({ language }),
      ]);
      snapshot = {
        version: list.version,
        cards: list.cards,
        elementNames: new Map(overview.elements.map((element) => [element.id, element.name])),
        rarityNames: new Map(overview.rarities.map((rarity) => [rarity.id, rarity.name])),
      };
    } catch {
      snapshot = undefined; // Pas encore de catalogue importé : pages génériques.
    }
    cached = { at: Date.now(), snapshot };
    return snapshot;
  };
}

export function seoFor(pathname: string, cardSlug: string | null, catalog: CatalogSnapshot | undefined, baseUrl: string): SeoPage {
  const card = cardSlug === null ? undefined : catalog?.cards.find((candidate) => candidate.slug === cardSlug);
  if (card !== undefined && catalog !== undefined) {
    return cardPage(card, catalog, baseUrl);
  }
  const indexable = !PRIVATE_PATHS.has(pathname);
  const scope = catalog === undefined ? '' : ` (${catalog.cards.length} cartes, version ${catalog.version})`;
  switch (pathname) {
    case '/deck':
      return {
        title: `Deck builder Spam : simulez et optimisez vos decks | ${SITE_NAME}`,
        description:
          'Composez un deck de 4 cartes Spam, choisissez les talents et simulez les dégâts, soins et bonus élémentaires tour par tour. Recherche automatique du meilleur deck.',
        path: '/deck',
        indexable,
        jsonLd: [webApplication(baseUrl, '/deck', 'Deck builder Spam')],
        noscript: `<h1>Deck builder Spam</h1><p>Simulation tour par tour des dégâts, soins, bonus élémentaires et recharges d'un deck de 4 cartes, avec recherche du meilleur deck. Activez JavaScript pour utiliser l'outil.</p>`,
      };
    case '/':
      return {
        title: `SpamDex : toutes les cartes de Spam, capacités et talents | ${SITE_NAME}`,
        description: `Toutes les cartes du jeu Spam${scope} : capacités, talents, éléments, raretés, filtres et recherche. Outils gratuits et non officiels pour les joueurs.`,
        path: '/',
        indexable,
        jsonLd: [website(baseUrl), webApplication(baseUrl, '/', 'SpamDex')],
        noscript: cardIndex(catalog),
      };
    default:
      return {
        title: SITE_NAME,
        description: 'Outils non officiels pour les joueurs de Spam : SpamDex, deck builder, collection.',
        path: pathname,
        indexable,
        jsonLd: [],
        noscript: '',
      };
  }
}

function cardPage(card: CardView, catalog: CatalogSnapshot, baseUrl: string): SeoPage {
  const element = catalog.elementNames.get(card.element) ?? card.element;
  const rarity = catalog.rarityNames.get(card.rarity) ?? card.rarity;
  const abilities = card.abilities.map((ability) => `${ability.name} : ${oneLine(ability.effect)}`);
  const description = truncate(
    `${card.name}, carte ${rarity.toLowerCase()} ${element} de Spam (${card.hp} PV). ${abilities.join(' · ')}`,
    160,
  );
  const path = `/?card=${encodeURIComponent(card.slug)}`;
  return {
    title: `${card.name} : carte ${rarity} ${element} de Spam | ${SITE_NAME}`,
    description,
    path,
    indexable: true,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'SpamDex', item: `${baseUrl}/` },
          { '@type': 'ListItem', position: 2, name: card.name, item: `${baseUrl}${path}` },
        ],
      },
    ],
    noscript: [
      `<h1>${escapeHtml(card.name)}</h1>`,
      `<p>Carte ${escapeHtml(rarity.toLowerCase())} ${escapeHtml(element)} · ${card.hp} PV</p>`,
      card.abilities.length === 0
        ? ''
        : `<h2>Capacités</h2><ul>${card.abilities
            .map((ability) => `<li><strong>${escapeHtml(ability.name)}</strong> : ${escapeHtml(oneLine(ability.effect))}</li>`)
            .join('')}</ul>`,
      card.talents.length === 0
        ? ''
        : `<h2>Talents</h2><ul>${card.talents
            .map((talent) => `<li><strong>${escapeHtml(talent.name)}</strong> : ${escapeHtml(oneLine(talent.effect))}</li>`)
            .join('')}</ul>`,
      card.lore.text === '' ? '' : `<p>${escapeHtml(oneLine(card.lore.text))}</p>`,
      `<p>Illustration : ${escapeHtml(card.artwork.artist.name)}</p>`,
      `<p><a href="/">Toutes les cartes</a></p>`,
    ].join(''),
  };
}

function cardIndex(catalog: CatalogSnapshot | undefined): string {
  const intro =
    '<h1>SpamDex : toutes les cartes de Spam</h1><p>Capacités, talents, éléments et raretés de chaque carte, deck builder et simulation de decks.</p>';
  if (catalog === undefined) {
    return intro;
  }
  const links = catalog.cards
    .map((card) => `<li><a href="/?card=${encodeURIComponent(card.slug)}">${escapeHtml(card.name)}</a></li>`)
    .join('');
  return `${intro}<ul>${links}</ul><p><a href="/deck">Deck builder</a></p>`;
}

function website(baseUrl: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: `${baseUrl}/`,
    inLanguage: 'fr',
    description: 'Outils non officiels pour les joueurs de Spam : SpamDex, deck builder, simulation de decks.',
  };
}

function webApplication(baseUrl: string, path: string, name: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: `${name} · ${SITE_NAME}`,
    url: `${baseUrl}${path}`,
    applicationCategory: 'GameApplication',
    operatingSystem: 'Tous (navigateur web)',
    inLanguage: 'fr',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  };
}

/** Balises de tête de page, à la place du bloc par défaut d'index.html. */
export function headTags(page: SeoPage, baseUrl: string): string {
  const url = `${baseUrl}${page.path}`;
  const json = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');
  return [
    `<title>${escapeHtml(page.title)}</title>`,
    `<meta name="description" content="${escapeHtml(page.description)}" />`,
    `<meta name="robots" content="${page.indexable ? 'index, follow, max-image-preview:large' : 'noindex, nofollow'}" />`,
    page.indexable ? `<link rel="canonical" href="${escapeHtml(url)}" />` : '',
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:locale" content="fr_FR" />`,
    `<meta property="og:title" content="${escapeHtml(page.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(page.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta name="twitter:card" content="summary" />`,
    ...page.jsonLd.map((data) => `<script type="application/ld+json">${json(data)}</script>`),
  ]
    .filter((tag) => tag !== '')
    .join('\n    ');
}

export function robotsTxt(baseUrl: string): string {
  return [
    'User-agent: *',
    'Allow: /',
    'Allow: /api/assets/',
    'Disallow: /api/',
    ...[...PRIVATE_PATHS].map((path) => `Disallow: ${path}`),
    '',
    `Sitemap: ${baseUrl}/sitemap.xml`,
    '',
  ].join('\n');
}

export function sitemapXml(baseUrl: string, catalog: CatalogSnapshot | undefined): string {
  const urls = [
    { loc: `${baseUrl}/`, priority: '1.0' },
    { loc: `${baseUrl}/deck`, priority: '0.9' },
    ...(catalog?.cards ?? []).map((card) => ({ loc: `${baseUrl}/?card=${encodeURIComponent(card.slug)}`, priority: '0.7' })),
  ];
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => `  <url><loc>${escapeHtml(url.loc)}</loc><priority>${url.priority}</priority></url>`),
    '</urlset>',
    '',
  ].join('\n');
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function oneLine(text: string): string {
  return text.replace(/\s*\n\s*/g, ' · ').replace(/\s+/g, ' ').trim();
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}
