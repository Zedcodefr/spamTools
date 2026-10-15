import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DomainError, ForbiddenError, NotFoundError, UnauthenticatedError } from '@spamtools/shared-kernel';
import {
  CryptoSecretTokens,
  InMemoryAccountRepository,
  InMemoryPasswordLinkRepository,
  InMemorySessionRepository,
} from '../infrastructure/index.js';
import type { PasswordHasher } from './ports/index.js';
import {
  Authenticate,
  BootstrapAdmin,
  ChangePassword,
  CreateAccount,
  DeleteAccount,
  InspectPasswordLink,
  IssuePasswordReset,
  ListAccounts,
  Login,
  Logout,
  LogoutEverywhere,
  RedeemPasswordLink,
  UpdateAccount,
  type IdentityDependencies,
} from './index.js';

/** Empreinte rapide pour les tests (scrypt est testé à part). */
const fakeHasher: PasswordHasher = {
  hash: async (password) => `h:${password}`,
  verify: async (password, hash) => hash === `h:${password}`,
};

function setup() {
  let time = new Date('2026-10-15T10:00:00Z');
  const deleted: string[] = [];
  const deps = {
    accounts: new InMemoryAccountRepository((id) => deleted.push(id)),
    sessions: new InMemorySessionRepository(),
    passwordLinks: new InMemoryPasswordLinkRepository(),
    hasher: fakeHasher,
    tokens: new CryptoSecretTokens(),
    clock: () => time,
  } satisfies IdentityDependencies;
  const advance = (ms: number) => {
    time = new Date(time.getTime() + ms);
  };
  /** Compte avec mot de passe choisi, et sa session. */
  const member = async (actorId: string, username: string, role: 'admin' | 'member' = 'member') => {
    const link = await new CreateAccount(deps).execute({ actorId, username, role });
    return new RedeemPasswordLink(deps).execute({ token: link.token, password: `${username} mot de passe` });
  };
  const admin = async () => {
    const link = await new BootstrapAdmin(deps).execute({ username: 'Zed' });
    return new RedeemPasswordLink(deps).execute({ token: link.token, password: 'zed mot de passe' });
  };
  return { deps, advance, member, admin, deleted };
}

const DAY = 24 * 60 * 60 * 1000;

describe('Identité : premier administrateur et invitation', () => {
  it('crée le compte sans mot de passe ; le lien sert une fois et ouvre une session', async () => {
    const { deps } = setup();
    const link = await new BootstrapAdmin(deps).execute({ username: ' Zed ' });
    assert.equal(link.account.username, 'zed');
    assert.equal(link.account.hasPassword, false);
    await assert.rejects(new Login(deps).execute({ username: 'zed', password: 'nimporte quoi' }), UnauthenticatedError);

    assert.deepEqual(await new InspectPasswordLink(deps).execute({ token: link.token }), { username: 'zed' });
    await assert.rejects(new RedeemPasswordLink(deps).execute({ token: link.token, password: 'court' }), DomainError);
    const session = await new RedeemPasswordLink(deps).execute({ token: link.token, password: 'un mot de passe long' });
    assert.equal(session.account.hasPassword, true);
    assert.equal((await new Authenticate(deps).execute({ token: session.token }))?.account.username, 'zed');

    await assert.rejects(new RedeemPasswordLink(deps).execute({ token: link.token, password: 'un autre mot de passe' }), UnauthenticatedError);
    await assert.rejects(new InspectPasswordLink(deps).execute({ token: link.token }), NotFoundError);
  });

  it('refuse un lien expiré (3 jours) et un identifiant déjà pris ou invalide', async () => {
    const { deps, advance, admin } = setup();
    const zed = await admin();
    const link = await new CreateAccount(deps).execute({ actorId: zed.account.id, username: 'alice', role: 'member' });
    await assert.rejects(new CreateAccount(deps).execute({ actorId: zed.account.id, username: 'ALICE', role: 'member' }), /déjà pris/);
    await assert.rejects(new CreateAccount(deps).execute({ actorId: zed.account.id, username: 'a b', role: 'member' }), DomainError);
    advance(3 * DAY);
    await assert.rejects(new RedeemPasswordLink(deps).execute({ token: link.token, password: 'mot de passe alice' }), /expiré/);
  });
});

describe('Identité : connexion et sessions', () => {
  it('connecte avec le bon mot de passe, sans dire si l’identifiant existe', async () => {
    const { deps, admin } = setup();
    await admin();
    const session = await new Login(deps).execute({ username: 'ZED', password: 'zed mot de passe' });
    assert.equal(session.account.role, 'admin');
    for (const [username, password] of [['zed', 'faux mot de passe'], ['inconnu', 'zed mot de passe'], ['%%', 'x']]) {
      await assert.rejects(new Login(deps).execute({ username: username!, password: password! }), {
        name: 'UnauthenticatedError',
        message: 'Identifiant ou mot de passe incorrect',
      });
    }
  });

  it('expire une session après 30 jours ; la déconnexion la ferme', async () => {
    const { deps, advance, admin } = setup();
    const session = await admin();
    const authenticate = new Authenticate(deps);
    advance(29 * DAY);
    assert.notEqual(await authenticate.execute({ token: session.token }), null);
    advance(DAY);
    assert.equal(await authenticate.execute({ token: session.token }), null);

    const again = await new Login(deps).execute({ username: 'zed', password: 'zed mot de passe' });
    await new Logout(deps).execute({ token: again.token });
    assert.equal(await authenticate.execute({ token: again.token }), null);
    assert.equal(await authenticate.execute({ token: 'jeton inventé' }), null);
  });

  it('change le mot de passe : vérifie l’actuel, garde cette session, ferme les autres', async () => {
    const { deps, admin } = setup();
    const here = await admin();
    const elsewhere = await new Login(deps).execute({ username: 'zed', password: 'zed mot de passe' });
    const current = await new Authenticate(deps).execute({ token: here.token });
    const change = (currentPassword: string, newPassword: string) =>
      new ChangePassword(deps).execute({ accountId: here.account.id, currentPassword, newPassword, currentTokenHash: current!.tokenHash });

    await assert.rejects(change('faux', 'nouveau mot de passe'), /actuel incorrect/);
    await assert.rejects(change('zed mot de passe', 'court'), /trop court/);
    await change('zed mot de passe', 'nouveau mot de passe');
    assert.notEqual(await new Authenticate(deps).execute({ token: here.token }), null);
    assert.equal(await new Authenticate(deps).execute({ token: elsewhere.token }), null);
    await new Login(deps).execute({ username: 'zed', password: 'nouveau mot de passe' });

    await new LogoutEverywhere(deps).execute({ accountId: here.account.id });
    assert.equal(await new Authenticate(deps).execute({ token: here.token }), null);
  });
});

describe('Identité : administration', () => {
  it('réserve la gestion des comptes aux administrateurs', async () => {
    const { deps, admin, member } = setup();
    const zed = await admin();
    const alice = await member(zed.account.id, 'alice');
    const id = alice.account.id;
    await assert.rejects(new ListAccounts(deps).execute({ actorId: id }), ForbiddenError);
    await assert.rejects(new CreateAccount(deps).execute({ actorId: id, username: 'bob', role: 'admin' }), ForbiddenError);
    await assert.rejects(new DeleteAccount(deps).execute({ actorId: id, accountId: zed.account.id }), ForbiddenError);
    assert.deepEqual((await new ListAccounts(deps).execute({ actorId: zed.account.id })).map((a) => a.username), ['alice', 'zed']);
  });

  it('désactive un compte (sessions fermées, connexion refusée), le réactive, change son rôle', async () => {
    const { deps, admin, member } = setup();
    const zed = await admin();
    const alice = await member(zed.account.id, 'alice');
    const update = (input: { role?: 'admin' | 'member'; disabled?: boolean }) =>
      new UpdateAccount(deps).execute({ actorId: zed.account.id, accountId: alice.account.id, ...input });

    assert.equal((await update({ disabled: true })).disabled, true);
    assert.equal(await new Authenticate(deps).execute({ token: alice.token }), null);
    await assert.rejects(new Login(deps).execute({ username: 'alice', password: 'alice mot de passe' }), UnauthenticatedError);
    await assert.rejects(new IssuePasswordReset(deps).execute({ actorId: zed.account.id, accountId: alice.account.id }), /désactivé/);

    await update({ disabled: false });
    assert.equal((await update({ role: 'admin' })).role, 'admin');
    await new ListAccounts(deps).execute({ actorId: alice.account.id });
  });

  it('ne modifie ni ne supprime son propre compte : il reste toujours un administrateur actif', async () => {
    const { deps, admin } = setup();
    const zed = await admin();
    const self = { actorId: zed.account.id, accountId: zed.account.id };
    await assert.rejects(new UpdateAccount(deps).execute({ ...self, disabled: true }), ForbiddenError);
    await assert.rejects(new UpdateAccount(deps).execute({ ...self, role: 'member' }), ForbiddenError);
    await assert.rejects(new DeleteAccount(deps).execute(self), ForbiddenError);
  });

  it('réinitialise un mot de passe par lien : l’ancien ne marche plus, les sessions sont fermées', async () => {
    const { deps, admin, member } = setup();
    const zed = await admin();
    const alice = await member(zed.account.id, 'alice');
    const first = await new IssuePasswordReset(deps).execute({ actorId: zed.account.id, accountId: alice.account.id });
    const link = await new IssuePasswordReset(deps).execute({ actorId: zed.account.id, accountId: alice.account.id });
    await assert.rejects(new InspectPasswordLink(deps).execute({ token: first.token }), NotFoundError, 'remplacé');

    await new RedeemPasswordLink(deps).execute({ token: link.token, password: 'alice nouveau mot de passe' });
    assert.equal(await new Authenticate(deps).execute({ token: alice.token }), null);
    await assert.rejects(new Login(deps).execute({ username: 'alice', password: 'alice mot de passe' }), UnauthenticatedError);
    await new Login(deps).execute({ username: 'alice', password: 'alice nouveau mot de passe' });
  });

  it('supprime un compte', async () => {
    const { deps, admin, member, deleted } = setup();
    const zed = await admin();
    const alice = await member(zed.account.id, 'alice');
    await new DeleteAccount(deps).execute({ actorId: zed.account.id, accountId: alice.account.id });
    assert.deepEqual(deleted, [alice.account.id]);
    await assert.rejects(new DeleteAccount(deps).execute({ actorId: zed.account.id, accountId: alice.account.id }), NotFoundError);
  });
});
