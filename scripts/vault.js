/**
 * Local Vault and Multi-Domain Session Storage
 * Uses chrome.storage.local for zero-leak local persistence.
 */

const KEY_ACCOUNTS = 'vault_accounts';
const KEY_SESSIONS = 'active_sessions';

/**
 * Clean and normalize a domain string (e.g. "https://www.google.com/search" -> "google.com")
 * @param {string} rawDomain
 * @returns {string}
 */
export function normalizeDomain(rawDomain = '') {
  if (!rawDomain) return '';
  let domain = rawDomain.trim().toLowerCase();
  try {
    if (domain.includes('://')) {
      const parsed = new URL(domain);
      domain = parsed.hostname;
    }
  } catch {
    // fallback string manipulation
  }
  domain = domain.replace(/^www\./, '');
  domain = domain.split('/')[0].split(':')[0];
  return domain;
}

export class Vault {
  constructor(options = {}) {
    this.storage = options.storageArea || globalThis.chrome?.storage?.local || this._createMemoryStorage();
  }

  _createMemoryStorage() {
    const memory = {};
    return {
      get: async (keys) => {
        if (!keys) return { ...memory };
        const res = {};
        const keyList = Array.isArray(keys) ? keys : [keys];
        keyList.forEach(k => { if (k in memory) res[k] = memory[k]; });
        return res;
      },
      set: async (items) => { Object.assign(memory, items); },
      remove: async (keys) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        keyList.forEach(k => delete memory[k]);
      }
    };
  }

  async _getStored(key, defaultValue = {}) {
    const res = await this.storage.get(key);
    return res && res[key] ? res[key] : defaultValue;
  }

  async _setStored(key, value) {
    await this.storage.set({ [key]: value });
  }

  /**
   * Save or replace an account for a domain.
   * @param {string} domain
   * @param {{ email: string, password: string }} credentials
   * @returns {Promise<{ email: string, password: string, updatedAt: string }>}
   */
  async saveAccount(domain, { email, password }) {
    const norm = normalizeDomain(domain);
    if (!norm) throw new Error('Domain cannot be empty');

    const accounts = await this._getStored(KEY_ACCOUNTS, {});
    const entry = {
      domain: norm,
      email: email.trim(),
      password: password,
      updatedAt: new Date().toISOString()
    };

    accounts[norm] = entry;
    await this._setStored(KEY_ACCOUNTS, accounts);
    return entry;
  }

  /**
   * Retrieve an account by domain.
   * @param {string} domain
   * @returns {Promise<Object | null>}
   */
  async getAccount(domain) {
    const norm = normalizeDomain(domain);
    const accounts = await this._getStored(KEY_ACCOUNTS, {});
    return accounts[norm] || null;
  }

  /**
   * Retrieve all saved accounts.
   * @returns {Promise<Record<string, Object>>}
   */
  async getAllAccounts() {
    return this._getStored(KEY_ACCOUNTS, {});
  }

  /**
   * Delete an account by domain.
   * @param {string} domain
   * @returns {Promise<void>}
   */
  async deleteAccount(domain) {
    const norm = normalizeDomain(domain);
    const accounts = await this._getStored(KEY_ACCOUNTS, {});
    if (accounts[norm]) {
      delete accounts[norm];
      await this._setStored(KEY_ACCOUNTS, accounts);
    }
  }

  /**
   * Export accounts as formatted JSON string.
   * @returns {Promise<string>}
   */
  async exportJson() {
    const accounts = await this.getAllAccounts();
    return JSON.stringify(accounts, null, 2);
  }

  /**
   * Retrieve the active temporary email session for a domain.
   * @param {string} domain
   * @returns {Promise<Object | null>}
   */
  async getActiveSession(domain) {
    const norm = normalizeDomain(domain);
    const sessions = await this._getStored(KEY_SESSIONS, {});
    return sessions[norm] || null;
  }

  /**
   * Store the active temporary email session for a domain.
   * @param {string} domain
   * @param {Object} sessionData
   * @returns {Promise<void>}
   */
  async setActiveSession(domain, sessionData) {
    const norm = normalizeDomain(domain);
    if (!norm) return;

    const sessions = await this._getStored(KEY_SESSIONS, {});
    sessions[norm] = {
      ...sessionData,
      domain: norm,
      updatedAt: new Date().toISOString()
    };
    await this._setStored(KEY_SESSIONS, sessions);
  }

  /**
   * Clear the active temporary session for a domain.
   * @param {string} domain
   * @returns {Promise<void>}
   */
  async clearActiveSession(domain) {
    const norm = normalizeDomain(domain);
    const sessions = await this._getStored(KEY_SESSIONS, {});
    if (sessions[norm]) {
      delete sessions[norm];
      await this._setStored(KEY_SESSIONS, sessions);
    }
  }

  /**
   * Retrieve all active sessions across all domains.
   * @returns {Promise<Record<string, Object>>}
   */
  async getAllActiveSessions() {
    return this._getStored(KEY_SESSIONS, {});
  }
}
