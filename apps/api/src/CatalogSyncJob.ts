import type { SyncCatalog } from '@spamtools/card-catalog';

/** Résumé de la dernière synchro terminée. */
export interface CatalogSyncResult {
  readonly version: string;
  readonly status: 'imported' | 'unchanged' | 'reanalyzed';
  readonly cardCount: number;
  readonly imagesDownloaded: number;
  readonly imageFailures: number;
}

export interface CatalogSyncState {
  readonly running: boolean;
  /** Dernier lancement (en cours ou terminé). */
  readonly startedAt: string | null;
  /** Administrateur qui l'a lancée ; null : mise à jour automatique. */
  readonly startedBy: string | null;
  readonly finishedAt: string | null;
  /** Issue du dernier lancement terminé : un résultat ou une erreur. */
  readonly result: CatalogSyncResult | null;
  readonly error: string | null;
  /** Prochaine mise à jour automatique ; null si elle est désactivée. */
  readonly nextRunAt: string | null;
}

export interface CatalogSyncLogger {
  info(message: string): void;
  error(message: string, error: unknown): void;
}

/**
 * Synchro du catalogue faite par le serveur : lancée par un administrateur depuis le site, ou
 * automatiquement à intervalle régulier. Elle tourne en arrière-plan, une seule à la fois
 * (téléchargement des images : plus long qu'une requête HTTP), et son état se consulte.
 * L'état reste en mémoire : il est perdu au redémarrage du serveur.
 */
export class CatalogSyncJob {
  private state: CatalogSyncState = {
    running: false,
    startedAt: null,
    startedBy: null,
    finishedAt: null,
    result: null,
    error: null,
    nextRunAt: null,
  };
  private pending: Promise<void> = Promise.resolve();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly syncCatalog: SyncCatalog,
    private readonly language: string,
    private readonly logger: CatalogSyncLogger = { info: () => {}, error: () => {} },
  ) {}

  current(): CatalogSyncState {
    return this.state;
  }

  /** Lance la synchro de la dernière version publiée, sauf si une est déjà en cours. */
  start(startedBy: string | null): CatalogSyncState {
    if (this.state.running) {
      return this.state;
    }
    this.state = { ...this.state, running: true, startedAt: new Date().toISOString(), startedBy, finishedAt: null };
    void this.run();
    return this.state;
  }

  /**
   * Mise à jour automatique : une première peu après le démarrage (un redémarrage fréquent ne doit
   * pas la repousser indéfiniment), puis à chaque intervalle.
   */
  schedule({ intervalMs, firstDelayMs }: { intervalMs: number; firstDelayMs: number }): void {
    this.unschedule();
    const plan = (delayMs: number) => {
      this.state = { ...this.state, nextRunAt: new Date(Date.now() + delayMs).toISOString() };
      this.timer = setTimeout(() => {
        this.start(null);
        plan(intervalMs);
      }, delayMs);
      // N'empêche pas le processus de s'arrêter.
      this.timer.unref();
    };
    plan(firstDelayMs);
  }

  unschedule(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.state = { ...this.state, nextRunAt: null };
  }

  /** Attend la fin de la synchro en cours (tests, arrêt du serveur). */
  whenIdle(): Promise<void> {
    return this.pending;
  }

  private run(): Promise<void> {
    const by = this.state.startedBy === null ? 'automatique' : `lancée par ${this.state.startedBy}`;
    this.pending = this.syncCatalog.execute({ language: this.language }).then(
      (output) => {
        const result: CatalogSyncResult = {
          version: output.version,
          status: output.status,
          cardCount: output.cardCount,
          imagesDownloaded: output.assets.downloaded,
          imageFailures: output.assets.failures.length,
        };
        this.logger.info(
          `Mise à jour du catalogue (${by}) : version ${result.version} ${result.status}, ` +
            `${result.imagesDownloaded} images téléchargées, ${result.imageFailures} en échec`,
        );
        this.finish({ result, error: null });
      },
      (error: unknown) => {
        this.logger.error(`Échec de la mise à jour du catalogue (${by})`, error);
        this.finish({ result: null, error: error instanceof Error ? error.message : String(error) });
      },
    );
    return this.pending;
  }

  private finish(outcome: Pick<CatalogSyncState, 'result' | 'error'>): void {
    this.state = { ...this.state, ...outcome, running: false, finishedAt: new Date().toISOString() };
  }
}
