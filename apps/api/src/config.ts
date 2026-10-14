import path from 'node:path';
import type { AuthConfig } from './http/basicAuth.js';

export interface AppConfig {
  readonly databasePath: string;
  /** Front compilé à servir (production) ; absent en développement, où Vite le sert. */
  readonly webDirectory?: string | undefined;
  /** Langue des textes de cartes importés et servis. */
  readonly language: string;
  /** Images des cartes, rangées comme dans le dossier data/ de spamgame.com. */
  readonly assetsDirectory: string;
  /** Accès protégé par mot de passe ; absent en développement local. */
  readonly auth?: AuthConfig | undefined;
}

/** Par défaut : dossier `data/` à la racine du dépôt (ignoré par git). */
const DEFAULT_DATA_DIRECTORY = path.resolve(__dirname, '../../../data');

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const dataDirectory = path.resolve(env['SPAMTOOLS_DATA_DIR'] ?? DEFAULT_DATA_DIRECTORY);
  const webDirectory = env['SPAMTOOLS_WEB_DIR'];
  const user = env['SPAMTOOLS_AUTH_USER'] ?? '';
  const passwordHash = env['SPAMTOOLS_AUTH_PASSWORD_HASH'] ?? '';
  if ((user === '') !== (passwordHash === '')) {
    throw new Error('SPAMTOOLS_AUTH_USER et SPAMTOOLS_AUTH_PASSWORD_HASH vont ensemble : définir les deux, ou aucun');
  }
  return {
    databasePath: path.join(dataDirectory, 'spamtools.sqlite'),
    ...(webDirectory !== undefined && webDirectory !== '' && { webDirectory: path.resolve(webDirectory) }),
    language: 'fr',
    assetsDirectory: path.join(dataDirectory, 'assets'),
    ...(user !== '' && { auth: { user, passwordHash } }),
  };
}
