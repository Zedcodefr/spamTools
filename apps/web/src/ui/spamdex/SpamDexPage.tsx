import type { CatalogData } from '../useCatalogData.ts';
import { CardGallery } from './CardGallery.tsx';

/**
 * SpamDex : consultation des cartes. Un clic droit sur une carte ouvre sa vue détail.
 */
export function SpamDexPage({ data, onVersionChange }: { data: CatalogData; onVersionChange: (version: string) => void }) {
  return <CardGallery data={data} onVersionChange={onVersionChange} />;
}
