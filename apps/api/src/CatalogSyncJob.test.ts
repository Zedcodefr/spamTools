import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import type { SyncCatalog, SyncCatalogOutput } from '@spamtools/card-catalog';
import { CatalogSyncJob } from './CatalogSyncJob.js';

const output: SyncCatalogOutput = {
  version: '1.23',
  language: 'fr',
  status: 'unchanged',
  cardCount: 127,
  assets: { downloaded: 0, alreadyPresent: 10, failures: [], unavailableFrameVariants: [] },
};

describe('CatalogSyncJob : mise à jour automatique', () => {
  it('se lance après le premier délai puis à chaque intervalle', async (context) => {
    context.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    const execute = mock.fn(async () => output);
    const job = new CatalogSyncJob({ execute } as unknown as SyncCatalog, 'fr');

    job.schedule({ intervalMs: 1000, firstDelayMs: 100 });
    assert.equal(job.current().nextRunAt, new Date(100).toISOString());
    context.mock.timers.tick(99);
    assert.equal(execute.mock.callCount(), 0);

    context.mock.timers.tick(1);
    assert.equal(execute.mock.callCount(), 1);
    assert.equal(job.current().startedBy, null);
    assert.equal(job.current().nextRunAt, new Date(1100).toISOString());
    await job.whenIdle();
    assert.equal(job.current().result?.version, '1.23');

    context.mock.timers.tick(1000);
    assert.equal(execute.mock.callCount(), 2);
    await job.whenIdle();

    job.unschedule();
    assert.equal(job.current().nextRunAt, null);
    context.mock.timers.tick(5000);
    assert.equal(execute.mock.callCount(), 2);
  });

  it('garde l’erreur d’un échec', async () => {
    const execute = mock.fn(async () => {
      throw new Error('spamgame.com injoignable');
    });
    const job = new CatalogSyncJob({ execute } as unknown as SyncCatalog, 'fr');
    job.start(null);
    await job.whenIdle();
    assert.equal(job.current().running, false);
    assert.equal(job.current().error, 'spamgame.com injoignable');
  });
});
