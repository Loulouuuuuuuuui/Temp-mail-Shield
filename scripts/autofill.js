/**
 * Form Autofill Content Script
 * Heuristically detects registration and login fields on the active page and fills them safely.
 * Fully self-contained to support chrome.scripting.executeScript string serialization.
 */

/**
 * Scan DOM inputs and fill email and password.
 * Self-contained function suitable for direct serialization via chrome.scripting.executeScript.
 * @param {Document|Object} [doc=globalThis.document]
 * @param {{ email?: string, password?: string }} [credentials={}]
 * @returns {{ filledEmail: boolean, filledPassword: boolean }}
 */
export function fillFormFields(doc = globalThis.document, { email, password } = {}) {
  let filledEmail = false;
  let filledPassword = false;

  function dispatchEvents(element) {
    const EventCtor = globalThis.Event || function(type, opts) {
      return { type, bubbles: !!opts?.bubbles };
    };
    try {
      element.dispatchEvent(new EventCtor('input', { bubbles: true }));
      element.dispatchEvent(new EventCtor('change', { bubbles: true }));
    } catch {
      // ignore
    }
  }

  function setValue(element, val) {
    element.value = val;
    // Support React 16+ / Angular synthetic event tracker descriptors
    if (typeof globalThis.window !== 'undefined' && globalThis.window.HTMLInputElement) {
      const protoDesc = Object.getOwnPropertyDescriptor(globalThis.window.HTMLInputElement.prototype, 'value');
      if (protoDesc && protoDesc.set) {
        try {
          protoDesc.set.call(element, val);
        } catch {
          // fallback
        }
      }
    }
  }

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
    setValue(emailInput, email);
    dispatchEvents(emailInput);
    filledEmail = true;
  }

  // 2. Identify Password Inputs (e.g. main password + confirmation)
  const passwordInputs = inputs.filter(i => (i.type || '').toLowerCase() === 'password');

  if (passwordInputs.length > 0 && password) {
    passwordInputs.forEach(pwdInput => {
      setValue(pwdInput, password);
      dispatchEvents(pwdInput);
      filledPassword = true;
    });
  }

  return { filledEmail, filledPassword };
}

// Global registry when injected directly into top window
if (typeof globalThis.window !== 'undefined' && typeof globalThis.document !== 'undefined') {
  globalThis.__tempMailAutofill = fillFormFields;
}
