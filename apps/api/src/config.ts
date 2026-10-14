import path from 'node:path';

export interface AppConfig {
  readonly databasePath: string;
  /** Front compilé à servir (production) ; absent en développement, où Vite le sert. */
  readonly webDirectory?: string | undefined;
  /** Langue des textes de cartes importés et servis. */
  readonly language: string;
  /** Images des cartes, rangées comme dans le dossier data/ de spamgame.com. */
  readonly assetsDirectory: string;
}

/** Par défaut : dossier `data/` à la racine du dépôt (ignoré par git). */
const DEFAULT_DATA_DIRECTORY = path.resolve(__dirname, '../../../data');

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const dataDirectory = path.resolve(env['SPAMTOOLS_DATA_DIR'] ?? DEFAULT_DATA_DIRECTORY);
  const webDirectory = env['SPAMTOOLS_WEB_DIR'];
  return {
    databasePath: path.join(dataDirectory, 'spamtools.sqlite'),
    ...(webDirectory !== undefined && webDirectory !== '' && { webDirectory: path.resolve(webDirectory) }),
    language: 'fr',
    assetsDirectory: path.join(dataDirectory, 'assets'),
  };
}
