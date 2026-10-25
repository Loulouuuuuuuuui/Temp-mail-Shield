import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vault } from '../scripts/vault.js';

function createMockStorage(initial = {}) {
  const store = { ...initial };
  return {
    _data: store,
    get: async (keys) => {
      if (!keys) return { ...store };
      const res = {};
      const keyList = Array.isArray(keys) ? keys : [keys];
      keyList.forEach(k => {
        if (k in store) res[k] = store[k];
      });
      return res;
    },
    set: async (items) => {
      Object.assign(store, items);
    },
    remove: async (keys) => {
      const keyList = Array.isArray(keys) ? keys : [keys];
      keyList.forEach(k => delete store[k]);
    }
  };
}

test('Vault stores and retrieves account by domain', async () => {
  const mockStorage = createMockStorage();
  const vault = new Vault({ storageArea: mockStorage });

  await vault.saveAccount('github.com', { email: 'dev@temp-mail.com', password: 'SecretPassword123!' });

  const account = await vault.getAccount('github.com');
  assert.equal(account.email, 'dev@temp-mail.com');
  assert.equal(account.password, 'SecretPassword123!');
  assert.ok(account.updatedAt);
});

test('Vault replaces existing account for domain without duplicates', async () => {
  const mockStorage = createMockStorage();
  const vault = new Vault({ storageArea: mockStorage });

  await vault.saveAccount('reddit.com', { email: 'old@temp.com', password: 'OldPass123!' });
  await vault.saveAccount('reddit.com', { email: 'new@temp.com', password: 'NewPass456!' });

  const accounts = await vault.getAllAccounts();
  assert.equal(Object.keys(accounts).length, 1);
  assert.equal(accounts['reddit.com'].email, 'new@temp.com');
});

test('Vault isolates active temporary sessions per domain', async () => {
  const mockStorage = createMockStorage();
  const vault = new Vault({ storageArea: mockStorage });

  await vault.setActiveSession('siteA.com', { email: 'a@mail.com', token: 'token_a' });
  await vault.setActiveSession('siteB.com', { email: 'b@mail.com', token: 'token_b' });

  const sessionA = await vault.getActiveSession('siteA.com');
  const sessionB = await vault.getActiveSession('siteB.com');

  assert.equal(sessionA.email, 'a@mail.com');
  assert.equal(sessionB.email, 'b@mail.com');

  await vault.clearActiveSession('siteA.com');
  assert.equal(await vault.getActiveSession('siteA.com'), null);
  assert.equal((await vault.getActiveSession('siteB.com')).email, 'b@mail.com');
});

test('Vault deletes account and exports accounts as JSON string', async () => {
  const mockStorage = createMockStorage();
  const vault = new Vault({ storageArea: mockStorage });

  await vault.saveAccount('twitter.com', { email: 't@temp.com', password: 'pwd1' });
  await vault.saveAccount('amazon.com', { email: 'a@temp.com', password: 'pwd2' });

  const jsonStr = await vault.exportJson();
  const parsed = JSON.parse(jsonStr);
  assert.equal(parsed['twitter.com'].email, 't@temp.com');
  assert.equal(parsed['amazon.com'].email, 'a@temp.com');

  await vault.deleteAccount('twitter.com');
  const afterDelete = await vault.getAllAccounts();
  assert.equal(afterDelete['twitter.com'], undefined);
  assert.ok(afterDelete['amazon.com']);
});
