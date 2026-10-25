import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPendingSessions } from '../background.js';

test('checkPendingSessions updates badge when unread messages are found', async () => {
  let badgeText = '';
  let badgeColor = '';

  const mockAction = {
    setBadgeText: ({ text }) => { badgeText = text; },
    setBadgeBackgroundColor: ({ color }) => { badgeColor = color; }
  };

  const mockVault = {
    getAllActiveSessions: async () => ({
      'example.com': {
        token: 'token_123',
        address: 'test@temp.com',
        createdAt: new Date().toISOString()
      }
    }),
    setActiveSession: async () => {}
  };

  const mockMailClient = {
    getMessages: async (token) => {
      assert.equal(token, 'token_123');
      return [
        { id: 'm1', seen: false, subject: 'Welcome' },
        { id: 'm2', seen: false, subject: 'Your Code: 1234' }
      ];
    }
  };

  const count = await checkPendingSessions({
    action: mockAction,
    vault: mockVault,
    mailClient: mockMailClient
  });

  assert.equal(count, 2);
  assert.equal(badgeText, '2');
  assert.equal(badgeColor, '#34c759');
});

test('checkPendingSessions clears badge when no active sessions have messages', async () => {
  let badgeText = 'old';

  const mockAction = {
    setBadgeText: ({ text }) => { badgeText = text; },
    setBadgeBackgroundColor: () => {}
  };

  const mockVault = {
    getAllActiveSessions: async () => ({})
  };

  const mockMailClient = {
    getMessages: async () => []
  };

  const count = await checkPendingSessions({
    action: mockAction,
    vault: mockVault,
    mailClient: mockMailClient
  });

  assert.equal(count, 0);
  assert.equal(badgeText, '');
});
