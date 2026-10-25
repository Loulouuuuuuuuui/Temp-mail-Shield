import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractVerificationDetails, MailClient } from '../scripts/mail-api.js';

test('extractVerificationDetails captures 6-digit verification code', () => {
  const body = "Bonjour,\n\nVotre code de confirmation est : 849201. Ne le communiquez à personne.";
  const res = extractVerificationDetails("Code de vérification", body);
  assert.equal(res.code, "849201");
});

test('extractVerificationDetails captures alphanumeric verification code', () => {
  const body = "Votre code d'activation est CODE: X8K9-M2P.";
  const res = extractVerificationDetails("Activation de compte", body);
  assert.equal(res.code, "X8K9-M2P");
});

test('extractVerificationDetails captures activation link when present', () => {
  const body = "Veuillez cliquer sur ce lien pour activer votre compte: https://example.com/auth/verify?token=abc123xyz";
  const res = extractVerificationDetails("Activez votre compte", body);
  assert.equal(res.activationUrl, "https://example.com/auth/verify?token=abc123xyz");
});

test('extractVerificationDetails captures code wrapped inside HTML tags', () => {
  const htmlBody = '<p>Votre code de confirmation est : <strong>849201</strong>. Ne le partagez pas.</p>';
  const res = extractVerificationDetails('Validation', htmlBody);
  assert.equal(res.code, '849201');
});

test('MailClient fetches available domains', async () => {
  const mockFetch = async (url) => {
    if (url.includes('/domains')) {
      return {
        ok: true,
        json: async () => ({
          'hydra:member': [
            { domain: 'temp-domain.com', isActive: true },
            { domain: 'old-domain.com', isActive: false }
          ]
        })
      };
    }
    throw new Error('Not found');
  };

  const client = new MailClient({ fetchFn: mockFetch });
  const domains = await client.getAvailableDomains();
  assert.deepEqual(domains, ['temp-domain.com']);
});

test('MailClient creates account and authenticates', async () => {
  const mockFetch = async (url, options) => {
    if (url.includes('/accounts') && options?.method === 'POST') {
      return {
        ok: true,
        json: async () => ({ id: 'acc_123', address: 'user@temp-domain.com' })
      };
    }
    if (url.includes('/token') && options?.method === 'POST') {
      return {
        ok: true,
        json: async () => ({ token: 'jwt_mock_token' })
      };
    }
    throw new Error('Unexpected route: ' + url);
  };

  const client = new MailClient({ fetchFn: mockFetch });
  const account = await client.createAccount('user@temp-domain.com', 'SecurePass123!');
  assert.equal(account.address, 'user@temp-domain.com');
  assert.equal(account.token, 'jwt_mock_token');
});

test('MailClient fetches messages list and single message with code extraction', async () => {
  const mockFetch = async (url, options) => {
    if (url.endsWith('/messages') && options?.headers?.Authorization) {
      return {
        ok: true,
        json: async () => ({
          'hydra:member': [
            {
              id: 'msg_999',
              from: { address: 'no-reply@service.com', name: 'Service Support' },
              subject: 'Votre code : 932841',
              intro: 'Voici votre code de sécurité : 932841',
              createdAt: '2026-10-25T15:00:00Z',
              seen: false
            }
          ]
        })
      };
    }
    if (url.includes('/messages/msg_999')) {
      return {
        ok: true,
        json: async () => ({
          id: 'msg_999',
          from: { address: 'no-reply@service.com', name: 'Service Support' },
          subject: 'Votre code : 932841',
          text: 'Voici votre code de sécurité : 932841.\nMerci pour votre confiance.',
          html: ['<p>Voici votre code de sécurité : <strong>932841</strong>.</p>'],
          createdAt: '2026-10-25T15:00:00Z'
        })
      };
    }
    throw new Error('Unexpected route: ' + url);
  };

  const client = new MailClient({ fetchFn: mockFetch });
  const messages = await client.getMessages('jwt_mock_token');
  assert.equal(messages.length, 1);
  assert.equal(messages[0].subject, 'Votre code : 932841');

  const fullMsg = await client.getMessage('jwt_mock_token', 'msg_999');
  assert.equal(fullMsg.extracted.code, '932841');
});
