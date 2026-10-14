import { SpamGameCatalogSource } from '@spamtools/card-catalog/infrastructure';
import { cardDocument, cardsDocument, indexDocument, layoutDocument } from '@spamtools/card-catalog/testing';

const BASE = 'https://example.test/data/';

/**
 * Source spamgame.com simulée : versions 1.9 et 1.10 (pour vérifier l'ordre numérique),
 * et une image par chemin demandé sous img/.
 */
export function fakeSpamGameSource(): SpamGameCatalogSource {
  const files: Record<string, unknown> = {
    'index.json': indexDocument({ latest: '1.10', versions: [{ version: '1.9' }, { version: '1.10' }] }),
    'layout.json': layoutDocument(),
    '1.9/cards.fr.json': cardsDocument({ version: '1.9', cards: [cardDocument({ hp: 400 })] }),
    '1.10/cards.fr.json': cardsDocument({ version: '1.10' }),
  };
  const fetchImpl = (async (input: string | URL | Request) => {
    const path = String(input).slice(BASE.length);
    if (path.startsWith('img/')) {
      return new Response(`image:${path}`);
    }
    const body = files[path];
    return body === undefined ? new Response('', { status: 404 }) : new Response(JSON.stringify(body));
  }) as typeof fetch;
  return new SpamGameCatalogSource(BASE, fetchImpl);
}
