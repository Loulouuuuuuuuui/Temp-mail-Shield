import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePassword } from '../scripts/password.js';

test('generatePassword creates a password of specified length', () => {
  const pwd = generatePassword(24);
  assert.equal(pwd.length, 24);
});

test('generatePassword defaults to 16 characters with high entropy', () => {
  const pwd = generatePassword();
  assert.equal(pwd.length, 16);
  assert.match(pwd, /[a-z]/, 'should contain lowercase letters');
  assert.match(pwd, /[A-Z]/, 'should contain uppercase letters');
  assert.match(pwd, /[0-9]/, 'should contain digits');
  assert.match(pwd, /[^a-zA-Z0-9]/, 'should contain symbols');
});

test('generatePassword supports custom options', () => {
  const digitsOnly = generatePassword(10, { lowercase: false, uppercase: false, symbols: false, numbers: true });
  assert.equal(digitsOnly.length, 10);
  assert.match(digitsOnly, /^[0-9]+$/);
});
