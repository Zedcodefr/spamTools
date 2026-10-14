import { CatalogVersion, NotFoundError, type CatalogRepository } from '@spamtools/card-catalog';
import { NO_CONTRIBUTION, type DeckCardStats, type DeckCardStatsProvider, type DeckSlot } from '@spamtools/deck';

/**
 * Adaptateur : relie le port du package deck au catalogue des cartes. Les statistiques
 * viennent de l'analyse faite à l'import ; rien n'est recalculé ici.
 */
export class CatalogDeckCardStatsProvider implements DeckCardStatsProvider {
  constructor(private readonly catalogs: CatalogRepository) {}

  async statsFor(version: string, language: string, slots: readonly DeckSlot[]): Promise<DeckCardStats[]> {
    const catalog = await this.catalogs.find(language, CatalogVersion.of(version));
    if (catalog === undefined) {
      throw new NotFoundError(`Aucun catalogue importé pour ${version} en "${language}"`);
    }
    return slots.map((slot) => {
      const card = catalog.findCard(slot.cardId);
      if (card === undefined) {
        throw new NotFoundError(`Carte introuvable en ${version} : ${slot.cardId}`);
      }
      const { stats } = catalog.traitsOf(card);
      const base = { cardId: slot.cardId, cardName: card.name, base: stats.base, bonusFactor: stats.bonusFactor };
      if (slot.talentSlot === null) {
        return { ...base, talentName: null, talent: NO_CONTRIBUTION };
      }
      const talentStats = stats.talents[String(slot.talentSlot)];
      const talent = card.data.talents.find((candidate) => candidate.slot === slot.talentSlot);
      if (talentStats === undefined || talent === undefined) {
        throw new NotFoundError(`Talent ${slot.talentSlot} introuvable pour la carte "${card.name}"`);
      }
      return { ...base, talentName: talent.name, talent: talentStats };
    });
  }
}
