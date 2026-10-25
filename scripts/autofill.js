/**
 * Form Autofill Content Script
 * Heuristically detects registration and login fields on the active page and fills them safely.
 */

function dispatchInputEvents(element) {
  const EventConstructor = globalThis.Event || function(type, opts) {
    return { type, bubbles: !!opts?.bubbles };
  };

  try {
    element.dispatchEvent(new EventConstructor('input', { bubbles: true }));
    element.dispatchEvent(new EventConstructor('change', { bubbles: true }));
  } catch {
    // Ignore fallback errors in non-browser environments
  }
}

function setNativeValue(element, value) {
  element.value = value;
  // Handle React/Angular input tracker overrides
  if (typeof globalThis.window !== 'undefined' && globalThis.window.HTMLInputElement) {
    const protoDesc = Object.getOwnPropertyDescriptor(globalThis.window.HTMLInputElement.prototype, 'value');
    if (protoDesc && protoDesc.set) {
      try {
        protoDesc.set.call(element, value);
      } catch {
        // fallback to standard assignment
      }
    }
  }
}

/**
 * Scan DOM inputs and fill email and password.
 * @param {Document|Object} doc
 * @param {{ email?: string, password?: string }} credentials
 * @returns {{ filledEmail: boolean, filledPassword: boolean }}
 */
export function fillFormFields(doc = globalThis.document, { email, password } = {}) {
  let filledEmail = false;
  let filledPassword = false;

  if (!doc || !doc.querySelectorAll) {
    return { filledEmail, filledPassword };
  }

  const inputs = Array.from(doc.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"])'));

  // 1. Identify Email Input
  let emailInput = null;

  // First pass: type="email"
  emailInput = inputs.find(i => (i.type || '').toLowerCase() === 'email');

  // Second pass: autocomplete="email"
  if (!emailInput) {
    emailInput = inputs.find(i => ((i.getAttribute && i.getAttribute('autocomplete')) || '').toLowerCase().includes('email'));
  }

  // Third pass: name, id or placeholder contains email / mail / username / identifiant
  if (!emailInput) {
    emailInput = inputs.find(i => {
      const type = (i.type || '').toLowerCase();
      if (type !== 'text' && type !== '') return false;
      const descriptor = `${i.name || ''} ${i.id || ''} ${i.placeholder || ''}`.toLowerCase();
      return descriptor.includes('email') || descriptor.includes('mail') || descriptor.includes('username') || descriptor.includes('identifiant') || descriptor.includes('courriel');
    });
  }

  if (emailInput && email) {
    setNativeValue(emailInput, email);
    dispatchInputEvents(emailInput);
    filledEmail = true;
  }

  // 2. Identify Password Inputs (e.g. main password + confirmation)
  const passwordInputs = inputs.filter(i => (i.type || '').toLowerCase() === 'password');

  if (passwordInputs.length > 0 && password) {
    passwordInputs.forEach(pwdInput => {
      setNativeValue(pwdInput, password);
      dispatchInputEvents(pwdInput);
      filledPassword = true;
    });
  }

  return { filledEmail, filledPassword };
}

// Self-invoking handler when injected directly by chrome.scripting.executeScript
if (typeof globalThis.window !== 'undefined' && typeof globalThis.document !== 'undefined') {
  // Can be called directly or via script args
  globalThis.__tempMailAutofill = fillFormFields;
}
