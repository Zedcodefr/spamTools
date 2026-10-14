import { CatalogVersion, NotFoundError, type CatalogRepository } from '@spamtools/card-catalog';
import {
  NO_CONTRIBUTION,
  type CandidateCard,
  type DeckCardStats,
  type DeckCardStatsProvider,
  type DeckSlot,
} from '@spamtools/deck';

/**
 * Adaptateur : relie le port du package deck au catalogue des cartes. Les statistiques
 * viennent de l'analyse faite à l'import ; rien n'est recalculé ici.
 */
export class CatalogDeckCardStatsProvider implements DeckCardStatsProvider {
  constructor(private readonly catalogs: CatalogRepository) {}

  async candidates(version: string, language: string): Promise<CandidateCard[]> {
    const catalog = await this.catalog(version, language);
    return catalog.cards.map((card) => {
      const { stats } = catalog.traitsOf(card);
      return {
        cardId: card.id.value,
        cardName: card.name,
        base: stats.base,
        bonusFactor: stats.bonusFactor,
        talents: card.data.talents.flatMap((talent) => {
          const contribution = stats.talents[String(talent.slot)];
          return contribution === undefined ? [] : [{ slot: talent.slot, name: talent.name, contribution }];
        }),
      };
    });
  }

  async statsFor(version: string, language: string, slots: readonly DeckSlot[]): Promise<DeckCardStats[]> {
    const catalog = await this.catalog(version, language);
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

  private async catalog(version: string, language: string) {
    const catalog = await this.catalogs.find(language, CatalogVersion.of(version));
    if (catalog === undefined) {
      throw new NotFoundError(`Aucun catalogue importé pour ${version} en "${language}"`);
    }
    return catalog;
  }
}
