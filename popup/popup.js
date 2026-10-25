/**
 * TempMail Shield Popup Controller
 * Manages tab switching, identity generation, autofill triggers, inbox polling and vault operations.
 */

import { generatePassword } from '../scripts/password.js';
import { MailClient, extractVerificationDetails } from '../scripts/mail-api.js';
import { Vault, normalizeDomain } from '../scripts/vault.js';
import { fillFormFields } from '../scripts/autofill.js';

// DOM Element references
const elements = {
  // Header
  currentDomainText: document.getElementById('current-domain-text'),
  inboxBadge: document.getElementById('inbox-badge'),
  vaultCounter: document.getElementById('vault-counter'),
  tabButtons: document.querySelectorAll('.tab-btn'),
  tabPanels: document.querySelectorAll('.tab-panel'),

  // Tab 1: Existing account
  existingAccountCard: document.getElementById('existing-account-card'),
  existingEmail: document.getElementById('existing-email'),
  existingPassword: document.getElementById('existing-password'),
  btnCopyExistingEmail: document.getElementById('btn-copy-existing-email'),
  btnToggleExistingPwd: document.getElementById('btn-toggle-existing-pwd'),
  btnCopyExistingPwd: document.getElementById('btn-copy-existing-pwd'),
  btnAutofillExisting: document.getElementById('btn-autofill-existing'),
  btnReplaceExisting: document.getElementById('btn-replace-existing'),

  // Tab 1: New generation
  newAccountCard: document.getElementById('new-account-card'),
  tempEmail: document.getElementById('temp-email'),
  tempPassword: document.getElementById('temp-password'),
  btnCopyEmail: document.getElementById('btn-copy-email'),
  btnTogglePassword: document.getElementById('btn-toggle-password'),
  btnCopyPassword: document.getElementById('btn-copy-password'),
  btnAutofillForm: document.getElementById('btn-autofill-form'),
  btnSaveAccount: document.getElementById('btn-save-account'),
  btnRefreshIdentity: document.getElementById('btn-refresh-identity'),
  inboxDomainTag: document.getElementById('inbox-domain-tag'),

  // Tab 2: Inbox
  inboxAddressPreview: document.getElementById('inbox-address-preview'),
  btnRefreshInbox: document.getElementById('btn-refresh-inbox'),
  verificationCodeCard: document.getElementById('verification-code-card'),
  extractedCodeValue: document.getElementById('extracted-code-value'),
  btnCopyExtractedCode: document.getElementById('btn-copy-extracted-code'),
  activationLinkContainer: document.getElementById('activation-link-container'),
  btnOpenActivationLink: document.getElementById('btn-open-activation-link'),
  messagesList: document.getElementById('messages-list'),
  inboxEmptyState: document.getElementById('inbox-empty-state'),
  messageDetailModal: document.getElementById('message-detail-modal'),
  btnCloseModal: document.getElementById('btn-close-modal'),
  modalMsgSubject: document.getElementById('modal-msg-subject'),
  modalMsgFrom: document.getElementById('modal-msg-from'),
  modalMsgDate: document.getElementById('modal-msg-date'),
  modalMsgBody: document.getElementById('modal-msg-body'),

  // Tab 3: Vault
  vaultSearchInput: document.getElementById('vault-search-input'),
  btnExportVault: document.getElementById('btn-export-vault'),
  vaultItemsList: document.getElementById('vault-items-list'),
  vaultEmptyState: document.getElementById('vault-empty-state'),

  // Toast
  toast: document.getElementById('toast-notification')
};

// Global State
const state = {
  currentDomain: 'inconnu',
  activeTabId: null,
  activeAccount: null, // { address, password, token }
  existingVaultAccount: null,
  messages: [],
  lastProcessedMsgId: null,
  inboxPollingInterval: null
};

const vault = new Vault();
const mailClient = new MailClient();

/** Show a temporary notification toast */
function showToast(message, duration = 2000) {
  elements.toast.textContent = message;
  elements.toast.classList.remove('hidden');
  clearTimeout(elements.toast._timeout);
  elements.toast._timeout = setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, duration);
}

/** Clear toolbar badge if Chrome action API is available */
function clearToolbarBadge() {
  if (typeof chrome !== 'undefined') {
    if (chrome.action?.setBadgeText) {
      chrome.action.setBadgeText({ text: '' });
    }
    if (chrome.runtime?.sendMessage) {
      try {
        chrome.runtime.sendMessage({ type: 'CLEAR_BADGE' }, () => {});
      } catch {
        // ignore
      }
    }
  }
}

/** Copy text to clipboard and show feedback */
async function copyToClipboard(text, label = 'Copié !') {
  if (!text) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    showToast(label);
  } catch (err) {
    showToast('Erreur lors de la copie');
  }
}

/** Switch active tab */
function switchTab(tabName) {
  elements.tabButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  elements.tabPanels.forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${tabName}`);
  });

  if (tabName === 'inbox') {
    clearToolbarBadge();
    refreshInboxMessages();
  } else if (tabName === 'vault') {
    renderVaultList();
  }
}

/** Get active Chrome tab and domain */
async function detectCurrentDomain() {
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs && tabs[0] && tabs[0].url) {
        state.activeTabId = tabs[0].id;
        state.currentDomain = normalizeDomain(tabs[0].url) || 'site-web';
      }
    } catch (e) {
      state.currentDomain = 'site-web';
    }
  }
  elements.currentDomainText.textContent = state.currentDomain;
}

/** Generate a brand-new disposable identity */
async function generateNewIdentity(force = false) {
  try {
    elements.tempEmail.value = 'Création en cours...';
    elements.tempPassword.value = '';

    const domains = await mailClient.getAvailableDomains();
    if (!domains || domains.length === 0) {
      throw new Error('Aucun domaine disponible');
    }

    const domain = domains[Math.floor(Math.random() * domains.length)];
    elements.inboxDomainTag.textContent = domain;

    const usernamePrefix = `usr${Math.random().toString(36).substring(2, 8)}${Date.now().toString().slice(-4)}`;
    const emailAddress = `${usernamePrefix}@${domain}`;
    const password = generatePassword(16);

    const account = await mailClient.createAccount(emailAddress, password);
    state.activeAccount = {
      address: account.address,
      token: account.token,
      password: password
    };
    state.lastProcessedMsgId = null;

    elements.tempEmail.value = state.activeAccount.address;
    elements.tempPassword.value = state.activeAccount.password;
    elements.inboxAddressPreview.textContent = state.activeAccount.address;

    await vault.setActiveSession(state.currentDomain, state.activeAccount);
    startInboxPolling();
  } catch (err) {
    console.error('Identity generation failed:', err);
    elements.tempEmail.value = 'Erreur de connexion';
    elements.tempPassword.value = generatePassword(16);
    showToast('Erreur serveur Mail.tm, réessayez');
  }
}

/** Initialize state for current domain */
async function initializeDomainState() {
  clearToolbarBadge();
  await detectCurrentDomain();

  // 1. Check if an account already exists in Vault
  const existing = await vault.getAccount(state.currentDomain);
  state.existingVaultAccount = existing;

  if (existing) {
    // Show only existing account card by default to avoid confusion
    elements.existingAccountCard.classList.remove('hidden');
    elements.newAccountCard.classList.add('hidden');
    elements.existingEmail.value = existing.email;
    elements.existingPassword.value = existing.password;
  } else {
    elements.existingAccountCard.classList.add('hidden');
    elements.newAccountCard.classList.remove('hidden');
  }

  // 2. Check if an active session exists
  const activeSession = await vault.getActiveSession(state.currentDomain);
  if (activeSession && activeSession.address && activeSession.token) {
    state.activeAccount = activeSession;
    elements.tempEmail.value = activeSession.address;
    elements.tempPassword.value = activeSession.password;
    elements.inboxAddressPreview.textContent = activeSession.address;
    startInboxPolling();
  } else if (!existing) {
    await generateNewIdentity();
  }

  updateVaultCounter();
}

/** Autofill webpage form with given credentials */
async function triggerAutofill(email, password) {
  if (!state.activeTabId && typeof chrome !== 'undefined' && chrome.tabs) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) state.activeTabId = tabs[0].id;
  }

  if (!state.activeTabId || !chrome?.scripting) {
    showToast('Impossible d\'injecter sur cette page');
    return;
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: state.activeTabId },
      func: fillFormFields,
      args: [undefined, { email, password }]
    });

    const res = results && results[0] && results[0].result;
    if (res && (res.filledEmail || res.filledPassword)) {
      showToast('Formulaire pré-rempli ! ⚡');
    } else {
      showToast('Champs non détectés : utilisez Copier');
    }
  } catch (err) {
    console.warn('Script injection failed:', err);
    showToast('Page protégée : utilisez Copier');
  }
}

/** Save currently active credentials to local vault */
async function saveCurrentAccountToVault() {
  const email = elements.tempEmail.value;
  const password = elements.tempPassword.value;

  if (!email || email.includes('en cours') || email.includes('Erreur')) {
    showToast('Aucun e-mail valide à enregistrer');
    return;
  }

  await vault.saveAccount(state.currentDomain, { email, password });
  state.existingVaultAccount = { email, password };
  showToast('Enregistré dans vos comptes ! 💾');
  updateVaultCounter();
}

/** Refresh inbox messages and scan for verification codes */
async function refreshInboxMessages() {
  if (!state.activeAccount || !state.activeAccount.token) {
    elements.inboxEmptyState.classList.remove('hidden');
    elements.inboxAddressPreview.textContent = 'Aucune boîte active';
    return;
  }

  try {
    const messages = await mailClient.getMessages(state.activeAccount.token);
    state.messages = messages || [];

    // Update badge inside popup header
    const count = state.messages.length;
    if (count > 0) {
      elements.inboxBadge.textContent = String(count);
      elements.inboxBadge.classList.remove('hidden');
    } else {
      elements.inboxBadge.classList.add('hidden');
    }

    // Render list
    renderMessagesList();

    // Cache latest message ID to avoid redundant full-message requests every 4 seconds
    if (state.messages.length > 0) {
      const latestMsg = state.messages[0];
      if (latestMsg.id !== state.lastProcessedMsgId) {
        state.lastProcessedMsgId = latestMsg.id;
        const fullMsg = await mailClient.getMessage(state.activeAccount.token, latestMsg.id);
        if (fullMsg.extracted && fullMsg.extracted.code) {
          elements.extractedCodeValue.textContent = fullMsg.extracted.code;
          elements.verificationCodeCard.classList.remove('hidden');
        }
        if (fullMsg.extracted && fullMsg.extracted.activationUrl) {
          elements.btnOpenActivationLink.href = fullMsg.extracted.activationUrl;
          elements.activationLinkContainer.classList.remove('hidden');
        }
      }
    }
  } catch (err) {
    console.warn('Inbox refresh error:', err);
  }
}

/** Render list of message items in Tab 2 */
function renderMessagesList() {
  const existingItems = elements.messagesList.querySelectorAll('.message-item');
  existingItems.forEach(el => el.remove());

  if (state.messages.length === 0) {
    elements.inboxEmptyState.classList.remove('hidden');
    return;
  }

  elements.inboxEmptyState.classList.add('hidden');

  state.messages.forEach(msg => {
    const item = document.createElement('div');
    item.className = 'message-item';

    const sender = (msg.from && (msg.from.name || msg.from.address)) || 'Expéditeur inconnu';
    const timeStr = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    item.innerHTML = `
      <div class="msg-header-row">
        <span class="msg-sender">${escapeHtml(sender)}</span>
        <span class="msg-time">${timeStr}</span>
      </div>
      <div class="msg-subject">${escapeHtml(msg.subject || '(Sans objet)')}</div>
      <div class="msg-intro">${escapeHtml(msg.intro || '')}</div>
    `;

    item.addEventListener('click', () => openMessageDetail(msg.id));
    elements.messagesList.appendChild(item);
  });
}

/** Open message detail view */
async function openMessageDetail(messageId) {
  try {
    const msg = await mailClient.getMessage(state.activeAccount.token, messageId);
    elements.modalMsgSubject.textContent = msg.subject || '(Sans objet)';
    elements.modalMsgFrom.textContent = `De : ${msg.from?.name || ''} <${msg.from?.address || ''}>`;
    elements.modalMsgDate.textContent = msg.createdAt ? new Date(msg.createdAt).toLocaleString() : '';

    const textContent = msg.text || (Array.isArray(msg.html) ? msg.html.join(' ') : msg.intro) || 'Aucun contenu texte';
    elements.modalMsgBody.textContent = textContent;

    elements.messagesList.classList.add('hidden');
    elements.messageDetailModal.classList.remove('hidden');
  } catch (err) {
    showToast('Erreur lors de la lecture du message');
  }
}

function closeMessageDetail() {
  elements.messageDetailModal.classList.add('hidden');
  elements.messagesList.classList.remove('hidden');
}

/** Render list of saved accounts in Vault */
async function renderVaultList(filterQuery = '') {
  const accounts = await vault.getAllAccounts();
  const entries = Object.entries(accounts || {});

  elements.vaultItemsList.querySelectorAll('.vault-card').forEach(el => el.remove());

  const filtered = entries.filter(([domain, acc]) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return domain.toLowerCase().includes(q) || (acc.email || '').toLowerCase().includes(q);
  });

  if (filtered.length === 0) {
    elements.vaultEmptyState.classList.remove('hidden');
    return;
  }

  elements.vaultEmptyState.classList.add('hidden');

  filtered.forEach(([domain, acc]) => {
    const card = document.createElement('div');
    card.className = 'vault-card';

    card.innerHTML = `
      <div class="vault-card-header">
        <span class="vault-domain">${escapeHtml(domain)}</span>
        <button class="btn-delete-account" title="Supprimer ce compte">🗑️</button>
      </div>
      <div class="vault-field">
        <span>${escapeHtml(acc.email)}</span>
        <button class="btn btn-secondary btn-icon btn-copy-v-email" title="Copier l'e-mail">📋</button>
      </div>
      <div class="vault-field">
        <span class="pwd-text">••••••••••••</span>
        <button class="btn btn-secondary btn-icon btn-copy-v-pwd" title="Copier le mot de passe">📋</button>
      </div>
    `;

    card.querySelector('.btn-copy-v-email').addEventListener('click', () => copyToClipboard(acc.email, 'E-mail copié !'));
    card.querySelector('.btn-copy-v-pwd').addEventListener('click', () => copyToClipboard(acc.password, 'Mot de passe copié !'));
    card.querySelector('.btn-delete-account').addEventListener('click', async () => {
      await vault.deleteAccount(domain);
      card.remove();
      updateVaultCounter();
      showToast(`Compte pour ${domain} supprimé`);
      if (domain === state.currentDomain) {
        elements.existingAccountCard.classList.add('hidden');
        elements.newAccountCard.classList.remove('hidden');
      }
    });

    elements.vaultItemsList.appendChild(card);
  });
}

/** Update vault counter badge */
async function updateVaultCounter() {
  const accounts = await vault.getAllAccounts();
  const count = Object.keys(accounts || {}).length;
  elements.vaultCounter.textContent = `(${count})`;
}

/** Export vault to JSON file */
async function exportVaultAsJson() {
  const jsonStr = await vault.exportJson();
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tempmail-vault-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Fichier JSON téléchargé ! 📥');
}

/** Start polling for messages when popup is active */
function startInboxPolling() {
  if (state.inboxPollingInterval) clearInterval(state.inboxPollingInterval);
  refreshInboxMessages();
  state.inboxPollingInterval = setInterval(() => {
    refreshInboxMessages();
  }, 4000);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// EVENT LISTENERS SETUP
function setupEventListeners() {
  // Tab Switching
  elements.tabButtons.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Copy Buttons in Generator
  elements.btnCopyEmail.addEventListener('click', () => copyToClipboard(elements.tempEmail.value, 'E-mail copié !'));
  elements.btnCopyPassword.addEventListener('click', () => copyToClipboard(elements.tempPassword.value, 'Mot de passe copié !'));

  // Toggle Password Visibility
  elements.btnTogglePassword.addEventListener('click', () => {
    const isPwd = elements.tempPassword.type === 'password';
    elements.tempPassword.type = isPwd ? 'text' : 'password';
  });

  // Action Buttons
  elements.btnAutofillForm.addEventListener('click', () => {
    triggerAutofill(elements.tempEmail.value, elements.tempPassword.value);
  });

  elements.btnSaveAccount.addEventListener('click', saveCurrentAccountToVault);

  elements.btnRefreshIdentity.addEventListener('click', () => generateNewIdentity(true));

  // Existing Account Card Actions
  elements.btnCopyExistingEmail.addEventListener('click', () => copyToClipboard(elements.existingEmail.value, 'E-mail copié !'));
  elements.btnCopyExistingPwd.addEventListener('click', () => copyToClipboard(elements.existingPassword.value, 'Mot de passe copié !'));
  elements.btnToggleExistingPwd.addEventListener('click', () => {
    const isPwd = elements.existingPassword.type === 'password';
    elements.existingPassword.type = isPwd ? 'text' : 'password';
  });

  elements.btnAutofillExisting.addEventListener('click', () => {
    triggerAutofill(elements.existingEmail.value, elements.existingPassword.value);
  });

  elements.btnReplaceExisting.addEventListener('click', async () => {
    elements.existingAccountCard.classList.add('hidden');
    elements.newAccountCard.classList.remove('hidden');
    await generateNewIdentity(true);
    showToast('Nouveau compte généré. Cliquez sur Enregistrer pour remplacer.');
  });

  // Inbox Actions
  elements.btnRefreshInbox.addEventListener('click', refreshInboxMessages);
  elements.btnCopyExtractedCode.addEventListener('click', () => {
    copyToClipboard(elements.extractedCodeValue.textContent.trim(), 'Code de confirmation copié !');
  });
  elements.btnCloseModal.addEventListener('click', closeMessageDetail);

  // Vault Actions
  elements.vaultSearchInput.addEventListener('input', (e) => {
    renderVaultList(e.target.value.trim());
  });
  elements.btnExportVault.addEventListener('click', exportVaultAsJson);
}

// Start application
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  initializeDomainState();
});
