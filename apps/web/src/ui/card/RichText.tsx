import { useMemo, type CSSProperties } from 'react';
import { parseRichText, type RichNode } from '../../domain/richText.ts';
import { useCardEnvironment } from './CardEnvironment.tsx';

/**
 * Affiche un texte d'effet avec ses icônes d'éléments, couleurs et mots-clés
 * (la description d'un mot-clé apparaît au survol).
 */
export function RichText({ source }: { source: string }) {
  const nodes = useMemo(() => parseRichText(source), [source]);
  return <span className="rich-text">{renderNodes(nodes)}</span>;
}

function renderNodes(nodes: readonly RichNode[]) {
  return nodes.map((node, index) => <RichNodeView key={index} node={node} />);
}

function RichNodeView({ node }: { node: RichNode }) {
  const { catalog, assetUrl } = useCardEnvironment();

  switch (node.type) {
    case 'text':
      return node.text;
    case 'icon': {
      const element = catalog.elements.get(node.id);
      return element === undefined ? null : (
        <img className="rich-text__icon" src={assetUrl(element.icon)} alt={element.name} />
      );
    }
    case 'element': {
      const color = catalog.elements.get(node.id)?.color;
      return (
        <span className="rich-text__element" style={color === undefined ? undefined : { color }}>
          {renderNodes(node.children)}
        </span>
      );
    }
    case 'keyword': {
      const keyword = catalog.keywords.get(node.id);
      const style: CSSProperties | undefined = keyword?.color ? { color: keyword.color } : undefined;
      return (
        <span className="rich-text__keyword" style={style} title={keyword?.description}>
          {keyword?.icon && <img className="rich-text__icon" src={assetUrl(keyword.icon)} alt="" />}
          {renderNodes(node.children)}
        </span>
      );
    }
  }
}
