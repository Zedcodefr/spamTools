import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { loadConfig } from '../config.js';
import { createContainer, type Container } from '../container.js';
import { fakeSpamGameSource } from '../test-support/fakeSpamGameSource.js';
import { hashPassword, verifyPassword } from './basicAuth.js';
import { createServer } from './createServer.js';

const basic = (user: string, password: string) => `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;

describe('Empreinte de mot de passe', () => {
  it('vérifie le bon mot de passe et refuse les autres', async () => {
    const hash = await hashPassword('cœur de feu 42');
    assert.match(hash, /^scrypt:[\w-]+:[\w-]+$/);
    assert.equal(await verifyPassword('cœur de feu 42', hash), true);
    assert.equal(await verifyPassword('cœur de feu 43', hash), false);
    assert.notEqual(await hashPassword('cœur de feu 42'), hash, 'sel aléatoire');
  });

  it('rejette une empreinte mal formée', async () => {
    await assert.rejects(verifyPassword('x', '$2a$14$bcrypt'), /Empreinte de mot de passe invalide/);
  });
});

describe('Configuration de l’accès', () => {
  it('exige l’utilisateur et l’empreinte ensemble', () => {
    assert.equal(loadConfig({}).auth, undefined);
    assert.deepEqual(loadConfig({ SPAMTOOLS_AUTH_USER: 'moi', SPAMTOOLS_AUTH_PASSWORD_HASH: 'scrypt:a:b' }).auth, {
      user: 'moi',
      passwordHash: 'scrypt:a:b',
    });
    assert.throws(() => loadConfig({ SPAMTOOLS_AUTH_USER: 'moi' }), /vont ensemble/);
  });
});

describe('API protégée par mot de passe', () => {
  let container: Container;
  let app: FastifyInstance;

  before(async () => {
    container = await createContainer(
      {
        databasePath: ':memory:',
        language: 'fr',
        assetsDirectory: '/nonexistent',
        auth: { user: 'moi', passwordHash: await hashPassword('mot de passe secret') },
      },
      { catalogSource: fakeSpamGameSource() },
    );
    app = createServer(container, { logger: false });
  });

  after(async () => {
    await app.close();
    await container.close();
  });

  const get = (url: string, authorization?: string) =>
    app.inject({ method: 'GET', url, headers: authorization === undefined ? {} : { authorization } });

  it('demande le mot de passe sans identifiants ou avec de faux identifiants', async () => {
    for (const authorization of [undefined, basic('moi', 'faux'), basic('autre', 'mot de passe secret'), 'Bearer x']) {
      const response = await get('/api/collection', authorization);
      assert.equal(response.statusCode, 401);
      assert.match(String(response.headers['www-authenticate']), /^Basic realm="spamTools"/);
    }
  });

  it('laisse passer les bons identifiants, à chaque requête', async () => {
    assert.equal((await get('/api/collection', basic('moi', 'mot de passe secret'))).statusCode, 200);
    assert.equal((await get('/api/collection', basic('moi', 'mot de passe secret'))).statusCode, 200);
  });

  it('laisse la sonde de santé ouverte', async () => {
    assert.equal((await get('/api/health')).statusCode, 200);
    assert.equal((await get('/api/health?x=1')).statusCode, 200);
  });
});
