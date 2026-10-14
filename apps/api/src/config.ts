import path from 'node:path';

export interface AppConfig {
  readonly databasePath: string;
  /** Images des cartes, rangées comme dans le dossier data/ de spamgame.com. */
  readonly assetsDirectory: string;
}

/** Par défaut : dossier `data/` à la racine du dépôt (ignoré par git). */
const DEFAULT_DATA_DIRECTORY = path.resolve(__dirname, '../../../data');

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const dataDirectory = path.resolve(env['SPAMTOOLS_DATA_DIR'] ?? DEFAULT_DATA_DIRECTORY);
  return {
    databasePath: path.join(dataDirectory, 'spamtools.sqlite'),
    assetsDirectory: path.join(dataDirectory, 'assets'),
  };
}
