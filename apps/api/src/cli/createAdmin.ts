import { loadConfig } from '../config.js';
import { createContainer } from '../container.js';

/**
 * Crée un compte administrateur et affiche son lien d'invitation, à ouvrir pour choisir le mot de passe
 * (valable 3 jours, une seule fois). Le premier administrateur reçoit les decks et la collection
 * d'avant les comptes.
 *   node dist/cli/createAdmin.js <identifiant>
 * SPAMTOOLS_PUBLIC_URL (ex. https://spamtools.fr) complète le lien.
 */
async function main(): Promise<void> {
  const username = process.argv[2];
  if (username === undefined) {
    throw new Error('Usage : create-admin <identifiant>');
  }
  const container = await createContainer(loadConfig());
  try {
    const { link, claimed } = await container.bootstrapAdmin(username);
    const base = (process.env['SPAMTOOLS_PUBLIC_URL'] ?? '').replace(/\/$/, '');
    console.log(`Administrateur « ${link.account.username} » créé.`);
    if (claimed.decks + claimed.cards > 0) {
      console.log(`Données d'avant les comptes rattachées : ${claimed.decks} deck(s), ${claimed.cards} carte(s) possédée(s).`);
    }
    console.log(`Lien pour choisir le mot de passe (une seule fois, jusqu'au ${link.expiresAt.toLocaleString('fr-FR')}) :`);
    console.log(`${base}/mot-de-passe#${link.token}`);
  } finally {
    await container.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
