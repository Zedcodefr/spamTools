import type { DeckCardStats, DeckSlot } from '../../domain/index.js';

/**
 * Port : statistiques chiffrées des cartes d'un deck, fournies par le catalogue des cartes.
 * Lève NotFoundError si une carte ou un talent n'existe pas dans cette version.
 */
export interface DeckCardStatsProvider {
  statsFor(version: string, language: string, slots: readonly DeckSlot[]): Promise<DeckCardStats[]>;
}
