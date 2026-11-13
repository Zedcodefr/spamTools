import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { createContainer, type Container } from '../container.js';
import { fakeSpamGameSource } from '../test-support/fakeSpamGameSource.js';
import { signInAdmin, signInAs, type Inject } from '../test-support/signIn.js';
import { createServer } from './createServer.js';

describe('API : mise à jour du catalogue par un administrateur', () => {
  let container: Container;
  let app: FastifyInstance;
  let admin: Inject;
  let member: Inject;

  before(async () => {
    container = await createContainer(
      { databasePath: ':memory:', language: 'fr', assetsDirectory: '/nonexistent', secureCookies: true },
      { catalogSource: fakeSpamGameSource() },
    );
    app = createServer(container, { logger: false });
    ({ inject: admin } = await signInAdmin(app, container));
    const created = await admin({ method: 'POST', url: '/api/admin/accounts', payload: { username: 'membre', role: 'member' } });
    member = await signInAs(app, created.json().token);
  });

  after(async () => {
    await app.close();
    await container.close();
  });

  it('est réservée aux administrateurs', async () => {
    assert.equal((await app.inject({ method: 'POST', url: '/api/admin/catalog/sync' })).statusCode, 401);
    assert.equal((await member({ method: 'POST', url: '/api/admin/catalog/sync' })).statusCode, 403);
    assert.equal((await member({ method: 'GET', url: '/api/admin/catalog/sync' })).statusCode, 403);
  });

  it('lance la synchro en arrière-plan et en donne le résultat', async () => {
    const started = await admin({ method: 'POST', url: '/api/admin/catalog/sync' });
    assert.equal(started.statusCode, 202);
    assert.equal(started.json().running, true);
    assert.equal(started.json().startedBy, 'zed');
    // Un second lancement pendant la synchro ne la relance pas.
    assert.equal((await admin({ method: 'POST', url: '/api/admin/catalog/sync' })).json().startedAt, started.json().startedAt);

    await container.catalogSyncJob.whenIdle();
    const state = (await admin({ method: 'GET', url: '/api/admin/catalog/sync' })).json();
    assert.equal(state.running, false);
    assert.equal(state.error, null);
    assert.equal(state.result.status, 'imported');
    assert.ok(state.result.cardCount > 0);
    assert.equal((await app.inject({ method: 'GET', url: '/api/catalog' })).json().version, state.result.version);
  });
});
