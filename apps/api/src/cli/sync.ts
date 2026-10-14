import { parseArgs } from 'node:util';
import type { SyncCatalogOutput } from '@spamtools/card-catalog';
import { SpamGameCatalogSource } from '@spamtools/card-catalog/infrastructure';
import { loadConfig } from '../config.js';
import { createContainer } from '../container.js';

const USAGE = `Usage : pnpm sync [--version <x.y>] [--all] [--language <code>]

Importe le catalogue des cartes depuis spamgame.com dans la base locale,
avec les images manquantes. Une version déjà importée n'est pas réimportée.

  --version <x.y>    version à importer (par défaut : la dernière publiée)
  --all              toutes les versions publiées
  --language <code>  langue des textes (par défaut : fr)`;

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      version: { type: 'string' },
      all: { type: 'boolean', default: false },
      language: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log(USAGE);
    return 0;
  }
  if (values.all && values.version !== undefined) {
    console.error('--version et --all sont incompatibles\n');
    console.error(USAGE);
    return 2;
  }

  const versions = values.all
    ? (await new SpamGameCatalogSource().fetchIndex()).versions.map((version) => version.value)
    : [values.version];

  const config = loadConfig();
  const container = await createContainer(config);
  try {
    let hasFailures = false;
    for (const version of versions) {
      const result = await container.syncCatalog.execute({ language: values.language ?? config.language, version });
      report(result);
      hasFailures ||= result.assets.failures.length > 0;
    }
    return hasFailures ? 1 : 0;
  } finally {
    await container.close();
  }
}

function report(result: SyncCatalogOutput): void {
  const status = result.status === 'imported' ? 'importée' : 'déjà présente';
  const { downloaded, alreadyPresent, failures, unavailableFrameVariants } = result.assets;
  console.log(`Version ${result.version} (${result.language}) : ${status}, ${result.cardCount} cartes`);
  console.log(`  Images : ${downloaded} téléchargées, ${alreadyPresent} déjà présentes, ${failures.length} en échec`);
  for (const failure of failures) {
    console.log(`    ✗ ${failure.path} : ${failure.reason}`);
  }
  if (unavailableFrameVariants.length > 0) {
    const paths = unavailableFrameVariants.map((variant) => variant.path).join(', ');
    console.log(`  Variantes de cadre non publiées par le jeu (ignorées) : ${paths}`);
  }
}

main().then(
  (exitCode) => {
    process.exitCode = exitCode;
  },
  (error: unknown) => {
    console.error(error instanceof Error ? `Échec de la synchronisation : ${error.message}` : error);
    process.exitCode = 1;
  },
);
