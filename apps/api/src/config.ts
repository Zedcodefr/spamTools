import path from 'node:path';

export interface AppConfig {
  readonly databasePath: string;
  /** Front compilé à servir (production) ; absent en développement, où Vite le sert. */
  readonly webDirectory?: string | undefined;
  /** Langue des textes de cartes importés et servis. */
  readonly language: string;
  /** Images des cartes, rangées comme dans le dossier data/ de spamgame.com. */
  readonly assetsDirectory: string;
  /** Cookie de session réservé au HTTPS (production) ; désactivé en développement local (HTTP). */
  readonly secureCookies?: boolean | undefined;
  /** Derrière un reverse proxy : l'adresse du client est lue dans X-Forwarded-For (limitation des tentatives). */
  readonly trustProxy?: boolean | undefined;
  /** Adresse publique du site (https://spamtools.fr) : URL canoniques, sitemap, liens d'invitation. */
  readonly publicUrl?: string | undefined;
  /** Mise à jour automatique du catalogue toutes les N heures ; absente : désactivée. */
  readonly catalogSyncIntervalHours?: number | undefined;
}

/** Par défaut : dossier `data/` à la racine du dépôt (ignoré par git). */
const DEFAULT_DATA_DIRECTORY = path.resolve(__dirname, '../../../data');

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const dataDirectory = path.resolve(env['SPAMTOOLS_DATA_DIR'] ?? DEFAULT_DATA_DIRECTORY);
  const webDirectory = env['SPAMTOOLS_WEB_DIR'];
  const flag = (name: string, fallback: boolean) => {
    const value = env[name];
    return value === undefined || value === '' ? fallback : ['1', 'true', 'oui'].includes(value.toLowerCase());
  };
  // Par défaut, une fois par jour en production ; 0 désactive.
  const syncHours = Number(env['SPAMTOOLS_SYNC_INTERVAL_HOURS'] || (env['NODE_ENV'] === 'production' ? 24 : 0));
  if (!Number.isFinite(syncHours) || syncHours < 0) {
    throw new Error(`SPAMTOOLS_SYNC_INTERVAL_HOURS invalide : "${env['SPAMTOOLS_SYNC_INTERVAL_HOURS']}"`);
  }
  return {
    databasePath: path.join(dataDirectory, 'spamtools.sqlite'),
    ...(webDirectory !== undefined && webDirectory !== '' && { webDirectory: path.resolve(webDirectory) }),
    language: 'fr',
    assetsDirectory: path.join(dataDirectory, 'assets'),
    secureCookies: flag('SPAMTOOLS_SECURE_COOKIES', env['NODE_ENV'] === 'production'),
    trustProxy: flag('SPAMTOOLS_TRUST_PROXY', false),
    ...(syncHours > 0 && { catalogSyncIntervalHours: syncHours }),
    ...(env['SPAMTOOLS_PUBLIC_URL'] && { publicUrl: env['SPAMTOOLS_PUBLIC_URL'].replace(/\/+$/, '') }),
  };
}
