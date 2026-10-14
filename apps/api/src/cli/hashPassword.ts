import { hashPassword } from '../http/basicAuth.js';

/**
 * Empreinte d'un mot de passe pour SPAMTOOLS_AUTH_PASSWORD_HASH, lu sur l'entrée standard
 * (pour qu'il n'apparaisse ni dans l'historique du shell ni dans la liste des processus) :
 *   printf '%s' 'mot de passe' | node dist/cli/hashPassword.js
 */
async function main(): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  const password = Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
  if (password.length < 12) {
    throw new Error('Mot de passe trop court : 12 caractères au moins');
  }
  console.log(await hashPassword(password));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
