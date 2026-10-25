import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fillFormFields } from '../scripts/autofill.js';

function createMockInput({ type = 'text', name = '', id = '', placeholder = '', autocomplete = '' }) {
  const el = {
    type,
    name,
    id,
    placeholder,
    autocomplete,
    value: '',
    eventsDispatched: [],
    getAttribute: (attr) => el[attr] || null,
    setAttribute: (attr, val) => { el[attr] = val; },
    dispatchEvent: (event) => { el.eventsDispatched.push(event.type); }
  };
  return el;
}

test('fillFormFields identifies and populates explicit email and password inputs', () => {
  const emailInput = createMockInput({ type: 'email' });
  const pwdInput = createMockInput({ type: 'password' });

  const mockDoc = {
    querySelectorAll: (selector) => {
      if (selector.includes('input')) return [emailInput, pwdInput];
      return [];
    }
  };

  const result = fillFormFields(mockDoc, { email: 'john.doe@temp.com', password: 'P@ssword123!' });

  assert.equal(result.filledEmail, true);
  assert.equal(result.filledPassword, true);
  assert.equal(emailInput.value, 'john.doe@temp.com');
  assert.equal(pwdInput.value, 'P@ssword123!');
  assert.ok(emailInput.eventsDispatched.includes('input'));
  assert.ok(emailInput.eventsDispatched.includes('change'));
  assert.ok(pwdInput.eventsDispatched.includes('input'));
  assert.ok(pwdInput.eventsDispatched.includes('change'));
});

test('fillFormFields uses heuristics when type is text for email/username', () => {
  const usernameInput = createMockInput({ type: 'text', name: 'user_email', placeholder: 'Enter your email' });
  const pwdInput = createMockInput({ type: 'password', name: 'user_password' });

  const mockDoc = {
    querySelectorAll: () => [usernameInput, pwdInput]
  };

  const result = fillFormFields(mockDoc, { email: 'alice@temp.com', password: 'SecretKey123!' });

  assert.equal(result.filledEmail, true);
  assert.equal(usernameInput.value, 'alice@temp.com');
  assert.equal(pwdInput.value, 'SecretKey123!');
});

test('fillFormFields populates password confirmation field if present', () => {
  const emailInput = createMockInput({ type: 'email' });
  const pwdInput = createMockInput({ type: 'password', name: 'password' });
  const confirmPwdInput = createMockInput({ type: 'password', name: 'confirm_password' });

  const mockDoc = {
    querySelectorAll: () => [emailInput, pwdInput, confirmPwdInput]
  };

  const result = fillFormFields(mockDoc, { email: 'bob@temp.com', password: 'SuperPassword1!' });

  assert.equal(result.filledPassword, true);
  assert.equal(pwdInput.value, 'SuperPassword1!');
  assert.equal(confirmPwdInput.value, 'SuperPassword1!');
});

test('fillFormFields is self-contained when serialized via toString() (MV3 executeScript compliance)', () => {
  const serialized = `(${fillFormFields.toString()})(mockDoc, { email: 'test@mail.com', password: 'pwd' })`;
  const inputs = [
    { type: 'email', value: '', events: [], dispatchEvent(e) { this.events.push(e.type); } },
    { type: 'password', value: '', events: [], dispatchEvent(e) { this.events.push(e.type); } }
  ];
  const mockDoc = { querySelectorAll: () => inputs };

  const runIsolated = new Function('mockDoc', `return ${serialized}`);
  const result = runIsolated(mockDoc);
  assert.equal(result.filledEmail, true);
  assert.equal(result.filledPassword, true);
  assert.equal(inputs[0].value, 'test@mail.com');
});

test('fillFormFields supports single-argument credentials object using globalThis.document', () => {
  const emailInput = createMockInput({ type: 'email' });
  const pwdInput = createMockInput({ type: 'password' });

  const prevDoc = globalThis.document;
  globalThis.document = {
    querySelectorAll: () => [emailInput, pwdInput]
  };

  try {
    const result = fillFormFields({ email: 'direct@temp.com', password: 'SingleArgPassword1!' });
    assert.equal(result.filledEmail, true);
    assert.equal(result.filledPassword, true);
    assert.equal(emailInput.value, 'direct@temp.com');
    assert.equal(pwdInput.value, 'SingleArgPassword1!');
  } finally {
    globalThis.document = prevDoc;
  }
});

