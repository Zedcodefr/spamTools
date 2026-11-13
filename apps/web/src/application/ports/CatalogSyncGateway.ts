/** Résumé de la dernière mise à jour terminée. */
export interface CatalogSyncResult {
  readonly version: string;
  /** `unchanged` : version déjà présente ; `reanalyzed` : déjà présente, caractéristiques recalculées. */
  readonly status: 'imported' | 'unchanged' | 'reanalyzed';
  readonly cardCount: number;
  readonly imagesDownloaded: number;
  readonly imageFailures: number;
}

export interface CatalogSyncState {
  readonly running: boolean;
  readonly startedAt: string | null;
  /** Administrateur qui l'a lancée ; null : mise à jour automatique. */
  readonly startedBy: string | null;
  readonly finishedAt: string | null;
  readonly result: CatalogSyncResult | null;
  readonly error: string | null;
  /** Prochaine mise à jour automatique ; null si elle est désactivée. */
  readonly nextRunAt: string | null;
}

/**
 * Port : mise à jour des cartes depuis le site officiel (réservée aux administrateurs).
 */
export interface CatalogSyncGateway {
  state(): Promise<CatalogSyncState>;
  /** Lance la mise à jour en arrière-plan (sans effet si une est déjà en cours). */
  start(): Promise<CatalogSyncState>;
}
