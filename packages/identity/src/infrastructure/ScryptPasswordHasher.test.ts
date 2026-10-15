import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CryptoSecretTokens } from './CryptoSecretTokens.js';
import { ScryptPasswordHasher } from './ScryptPasswordHasher.js';

describe('ScryptPasswordHasher', () => {
  it('vérifie le bon mot de passe, refuse les autres, sel aléatoire', async () => {
    const hasher = new ScryptPasswordHasher();
    const hash = await hasher.hash('cœur de feu 42');
    assert.match(hash, /^scrypt:[\w-]+:[\w-]+$/);
    assert.equal(await hasher.verify('cœur de feu 42', hash), true);
    assert.equal(await hasher.verify('cœur de feu 43', hash), false);
    assert.notEqual(await hasher.hash('cœur de feu 42'), hash);
    await assert.rejects(hasher.verify('x', '$2a$14$bcrypt'), /Empreinte de mot de passe invalide/);
  });
});

describe('CryptoSecretTokens', () => {
  it('génère des jetons distincts et une empreinte stable', () => {
    const tokens = new CryptoSecretTokens();
    const token = tokens.generate();
    assert.equal(token.length, 43);
    assert.notEqual(tokens.generate(), token);
    assert.equal(tokens.hash(token), tokens.hash(token));
    assert.notEqual(tokens.hash(token), token);
  });
});
