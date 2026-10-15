import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { createContainer, type Container } from '../container.js';
import { fakeSpamGameSource } from '../test-support/fakeSpamGameSource.js';
import { signInAdmin, signInAs, type Inject } from '../test-support/signIn.js';
import { SESSION_COOKIE } from './authentication.js';
import { createServer } from './createServer.js';

const FIRE_SPIRIT = '18bca5cf-7aa1-421c-85ec-4ed0b6a8ca70';

describe('API : connexion et comptes', () => {
  let container: Container;
  let app: FastifyInstance;
  let admin: Inject;

  before(async () => {
    container = await createContainer(
      { databasePath: ':memory:', language: 'fr', assetsDirectory: '/nonexistent', secureCookies: true },
      { catalogSource: fakeSpamGameSource() },
    );
    await container.syncCatalog.execute({ language: 'fr' });
    app = createServer(container, { logger: false });
    ({ inject: admin } = await signInAdmin(app, container));
  });

  after(async () => {
    await app.close();
    await container.close();
  });

  /** Crée un membre et le connecte. */
  const member = async (username: string) => {
    const created = await admin({ method: 'POST', url: '/api/admin/accounts', payload: { username, role: 'member' } });
    assert.equal(created.statusCode, 201);
    return { inject: await signInAs(app, created.json().token), id: created.json().account.id as string };
  };

  it('exige une connexion pour toute l’API, images comprises ; la sonde de santé reste ouverte', async () => {
    for (const url of ['/api/catalog', '/api/cards', '/api/decks', '/api/collection', '/api/assets/img/x.webp', '/api/auth/me']) {
      const response = await app.inject({ method: 'GET', url });
      assert.equal(response.statusCode, 401, url);
      assert.deepEqual(response.json(), { error: 'Connexion requise' });
    }
    assert.equal((await app.inject({ method: 'GET', url: '/api/health' })).statusCode, 200);
    assert.equal((await app.inject({ method: 'GET', url: '/api/cards', cookies: { [SESSION_COOKIE]: 'inventé' } })).statusCode, 401);
  });

  it('connecte avec un cookie HttpOnly, Secure, SameSite=Strict ; la déconnexion ferme la session', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'zed', password: 'mot de passe de test' } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().username, 'zed');
    assert.equal(response.json().passwordHash, undefined);
    const cookie = response.cookies.find((candidate) => candidate.name === SESSION_COOKIE);
    assert.ok(cookie);
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.secure, true);
    assert.equal(cookie.sameSite, 'Strict');
    const cookies = { [SESSION_COOKIE]: cookie.value };

    assert.equal((await app.inject({ method: 'GET', url: '/api/auth/me', cookies })).json().role, 'admin');
    assert.equal((await app.inject({ method: 'POST', url: '/api/auth/logout', cookies })).statusCode, 204);
    assert.equal((await app.inject({ method: 'GET', url: '/api/auth/me', cookies })).statusCode, 401);
  });

  it('refuse un mauvais mot de passe avec un message neutre', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'zed', password: 'faux' } });
    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.json(), { error: 'Identifiant ou mot de passe incorrect' });
  });

  it('refuse une modification venant d’un autre site', async () => {
    const payload = { cardIds: [FIRE_SPIRIT], owned: true };
    const crossSite = await admin({ method: 'PUT', url: '/api/collection/cards', payload, headers: { origin: 'https://pirate.example' } });
    assert.equal(crossSite.statusCode, 403);
    const fetchMeta = await admin({ method: 'PUT', url: '/api/collection/cards', payload, headers: { 'sec-fetch-site': 'cross-site' } });
    assert.equal(fetchMeta.statusCode, 403);
    const sameSite = await admin({ method: 'PUT', url: '/api/collection/cards', payload, headers: { origin: 'http://localhost:80', host: 'localhost:80' } });
    assert.equal(sameSite.statusCode, 200);
  });

  it('donne à chaque compte ses decks et sa collection', async () => {
    const alice = await member('alice');
    const deck = await admin({ method: 'POST', url: '/api/decks', payload: { name: 'Zed', version: '1.10', slots: [] } });
    assert.equal(deck.statusCode, 201);
    await admin({ method: 'PUT', url: '/api/collection/cards', payload: { cardIds: [FIRE_SPIRIT], owned: true } });

    assert.deepEqual((await alice.inject({ method: 'GET', url: '/api/decks' })).json(), []);
    assert.deepEqual((await alice.inject({ method: 'GET', url: '/api/collection' })).json().cardIds, []);
    assert.equal((await alice.inject({ method: 'GET', url: `/api/decks/${deck.json().id}` })).statusCode, 404);
    assert.equal((await alice.inject({ method: 'DELETE', url: `/api/decks/${deck.json().id}` })).statusCode, 404);
    assert.equal((await admin({ method: 'GET', url: '/api/decks' })).json().length, 1);
  });

  it('réserve l’administration aux administrateurs', async () => {
    const bob = await member('bob');
    assert.equal((await bob.inject({ method: 'GET', url: '/api/admin/accounts' })).statusCode, 403);
    assert.equal((await bob.inject({ method: 'POST', url: '/api/admin/accounts', payload: { username: 'eve', role: 'admin' } })).statusCode, 403);
    const accounts = (await admin({ method: 'GET', url: '/api/admin/accounts' })).json();
    assert.ok(accounts.some((account: { username: string }) => account.username === 'bob'));
    assert.ok(accounts.every((account: Record<string, unknown>) => account['passwordHash'] === undefined));
  });

  it('désactive un compte (session fermée), réinitialise son mot de passe, le supprime', async () => {
    const carol = await member('carol');
    const disable = await admin({ method: 'PATCH', url: `/api/admin/accounts/${carol.id}`, payload: { disabled: true } });
    assert.equal(disable.json().disabled, true);
    assert.equal((await carol.inject({ method: 'GET', url: '/api/auth/me' })).statusCode, 401);

    await admin({ method: 'PATCH', url: `/api/admin/accounts/${carol.id}`, payload: { disabled: false } });
    const reset = await admin({ method: 'POST', url: `/api/admin/accounts/${carol.id}/password-link` });
    const inspect = await app.inject({ method: 'POST', url: '/api/auth/password-link/inspect', payload: { token: reset.json().token } });
    assert.deepEqual(inspect.json(), { username: 'carol' });
    const again = await signInAs(app, reset.json().token, 'nouveau mot de passe');
    assert.equal((await again({ method: 'GET', url: '/api/auth/me' })).json().username, 'carol');

    assert.equal((await admin({ method: 'DELETE', url: `/api/admin/accounts/${carol.id}` })).statusCode, 204);
    assert.equal((await again({ method: 'GET', url: '/api/auth/me' })).statusCode, 401);
  });

  it('change son mot de passe : les autres sessions sont fermées', async () => {
    const dan = await member('dan');
    const other = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'dan', password: 'mot de passe de test' } });
    const otherCookies = { [SESSION_COOKIE]: other.cookies.find((cookie) => cookie.name === SESSION_COOKIE)!.value };
    const change = await dan.inject({
      method: 'POST',
      url: '/api/account/password',
      payload: { currentPassword: 'mot de passe de test', newPassword: 'un tout nouveau mot de passe' },
    });
    assert.equal(change.statusCode, 204);
    assert.equal((await dan.inject({ method: 'GET', url: '/api/auth/me' })).statusCode, 200);
    assert.equal((await app.inject({ method: 'GET', url: '/api/auth/me', cookies: otherCookies })).statusCode, 401);
  });

  it('limite les tentatives de connexion (10 par minute et par adresse)', async () => {
    const attempt = () =>
      app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'zed', password: 'faux' }, remoteAddress: '203.0.113.9' });
    const statuses = [];
    for (let i = 0; i < 11; i++) {
      statuses.push((await attempt()).statusCode);
    }
    assert.deepEqual(statuses, [...Array(10).fill(401), 429]);
    assert.match((await attempt()).json().error, /Trop de tentatives/);
  });
});
