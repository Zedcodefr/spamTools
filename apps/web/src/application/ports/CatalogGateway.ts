import type { Card } from '../../domain/Card.ts';
import type { CardLayout } from '../../domain/CardLayout.ts';
import type { CatalogOverview } from '../../domain/Catalog.ts';

/**
 * Port : accès au catalogue des cartes. Sans `version`, la plus récente importée.
 */
export interface CatalogGateway {
  getCatalog(version?: string): Promise<CatalogOverview>;
  listCards(version?: string): Promise<readonly Card[]>;
  getCardLayout(): Promise<CardLayout>;
  /** URL d'une image à partir de son chemin dans les données (ex. "img/elements/fire.webp"). */
  assetUrl(path: string): string;
}
