/**
 * Texte riche des effets de cartes :
 *   `{icon:fire}`           icône d'élément
 *   `{el:fire}Feu{/el}`     texte coloré par élément
 *   `{kw:luck}Chance{/kw}`  mot-clé (passif, statut, glossaire...)
 * Une balise inconnue ou mal fermée est conservée telle quelle.
 */

export type RichNode =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'icon'; readonly id: string }
  | { readonly type: 'element' | 'keyword'; readonly id: string; readonly children: readonly RichNode[] };

const TOKEN = /\{(icon|el|kw):([^{}]+)\}|\{\/(el|kw)\}/g;

const CONTAINER_TYPES = { el: 'element', kw: 'keyword' } as const;

interface OpenContainer {
  readonly tag: 'el' | 'kw';
  readonly id: string;
  readonly raw: string;
  readonly children: RichNode[];
}

export function parseRichText(source: string): RichNode[] {
  const root: RichNode[] = [];
  const stack: OpenContainer[] = [];
  const current = (): RichNode[] => stack.at(-1)?.children ?? root;
  const pushText = (text: string) => {
    if (text === '') {
      return;
    }
    const nodes = current();
    const last = nodes.at(-1);
    if (last?.type === 'text') {
      nodes[nodes.length - 1] = { type: 'text', text: last.text + text };
    } else {
      nodes.push({ type: 'text', text });
    }
  };

  let cursor = 0;
  for (const match of source.matchAll(TOKEN)) {
    pushText(source.slice(cursor, match.index));
    cursor = match.index + match[0].length;
    const [raw, openTag, id, closeTag] = match;

    if (openTag === 'icon' && id !== undefined) {
      current().push({ type: 'icon', id });
    } else if ((openTag === 'el' || openTag === 'kw') && id !== undefined) {
      stack.push({ tag: openTag, id, raw, children: [] });
    } else if (closeTag !== undefined && stack.at(-1)?.tag === closeTag) {
      const closed = stack.pop() as OpenContainer;
      current().push({ type: CONTAINER_TYPES[closed.tag], id: closed.id, children: closed.children });
    } else {
      pushText(raw);
    }
  }
  pushText(source.slice(cursor));

  // Balises restées ouvertes : on rend leur contenu comme du texte simple.
  while (stack.length > 0) {
    const unclosed = stack.pop() as OpenContainer;
    pushText(unclosed.raw);
    for (const child of unclosed.children) {
      if (child.type === 'text') {
        pushText(child.text);
      } else {
        current().push(child);
      }
    }
  }
  return root;
}
