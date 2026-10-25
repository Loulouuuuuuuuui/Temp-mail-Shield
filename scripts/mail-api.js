/**
 * Mail.tm API Client and Verification Code Extractor
 * Pure ES6 module for disposable inbox creation and message retrieval.
 */

const DEFAULT_BASE_URL = 'https://api.mail.tm';

/**
 * Extract verification codes (4-8 digits or alphanumeric) and activation links from email text or HTML.
 * @param {string} subject
 * @param {string} body
 * @returns {{ code: string | null, activationUrl: string | null, links: string[] }}
 */
export function extractVerificationDetails(subject = '', body = '') {
  let code = null;
  let activationUrl = null;
  const linksSet = new Set();

  // 1. Collect all URLs from body (including HTML href attributes) and subject
  const hrefRegex = /href\s*=\s*["'](https?:\/\/[^"'>\s]+)["']/gi;
  let match;
  while ((match = hrefRegex.exec(body)) !== null) {
    const clean = match[1].replace(/[.,;)]+$/, '').trim();
    if (clean) linksSet.add(clean);
  }

  // Match raw URLs in text (including subject and body)
  const rawUrlRegex = /https?:\/\/[^\s"'<>]+/gi;
  const fullRawText = `${subject}\n${body}`;
  while ((match = rawUrlRegex.exec(fullRawText)) !== null) {
    const clean = match[0].replace(/[.,;)]+$/, '').trim();
    if (clean) linksSet.add(clean);
  }

  const allLinks = Array.from(linksSet);

  // 2. Determine best activation/verification URL
  if (allLinks.length > 0) {
    // Priority 1: URL with explicit verification/activation keywords
    const keywordMatch = allLinks.find(url =>
      /(?:verify|activate|confirm|validation|validate|auth|token=|code=|action=)/i.test(url)
    );

    if (keywordMatch) {
      activationUrl = keywordMatch;
    } else {
      // Priority 2: First URL that is not an unsubscribe/privacy link
      const nonUnsubMatch = allLinks.find(url =>
        !/(?:unsubscribe|optout|privacy|desabonner|terms|help|support|mailto:)/i.test(url)
      );
      activationUrl = nonUnsubMatch || allLinks[0];
    }
  }

  // 3. Strip HTML tags for clean text matching of codes
  const cleanBody = body.replace(/<[^>]+>/g, ' ');
  const combined = `${subject}\n${cleanBody}`;

  // 4. Look for explicit code keywords followed by code (e.g. "code : 849201", "CODE: X8K9-M2P")
  const explicitCodeMatch = combined.match(/(?:code|validation|confirmation|pin|sécurité|security|otp)\s*(?:d'activation|de vérification|de confirmation)?\s*(?:est|is|:)\s*(?:code\s*[:=]?\s*)?([A-Za-z0-9\-]{4,10})\b/i);
  if (explicitCodeMatch && explicitCodeMatch[1] && explicitCodeMatch[1].toLowerCase() !== 'code') {
    code = explicitCodeMatch[1].trim();
  }

  // 5. Fallback: look for 4 to 8 consecutive digits in subject or body
  if (!code) {
    const digitMatch = combined.match(/\b([0-9]{4,8})\b/);
    if (digitMatch && digitMatch[1]) {
      code = digitMatch[1];
    }
  }

  return { code, activationUrl, links: allLinks };
}

export class MailClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || DEFAULT_BASE_URL;
    this.fetchFn = options.fetchFn || globalThis.fetch.bind(globalThis);
  }

  async _request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const res = await this.fetchFn(url, { ...options, headers });
    if (!res.ok) {
      let errDetail = '';
      try {
        const errJson = await res.json();
        errDetail = errJson.message || errJson['hydra:description'] || JSON.stringify(errJson);
      } catch {
        errDetail = res.statusText;
      }
      const err = new Error(`Mail.tm request failed (${res.status}): ${errDetail}`);
      err.status = res.status;
      throw err;
    }

    return res.json();
  }

  /**
   * Fetch active disposable domains.
   * Handles both JSON-LD Hydra format and direct JSON array format.
   * @returns {Promise<string[]>}
   */
  async getAvailableDomains() {
    const data = await this._request('/domains');
    const members = Array.isArray(data) ? data : (data['hydra:member'] || []);
    return members
      .filter(item => item.isActive !== false)
      .map(item => item.domain);
  }

  /**
   * Create an account on Mail.tm and obtain JWT token.
   * Uses sanitized address returned by Mail.tm for token retrieval.
   * @param {string} address
   * @param {string} password
   * @returns {Promise<{ id: string, address: string, token: string }>}
   */
  async createAccount(address, password) {
    const accountData = await this._request('/accounts', {
      method: 'POST',
      body: JSON.stringify({ address, password })
    });

    const validAddress = accountData.address || address;

    const tokenData = await this._request('/token', {
      method: 'POST',
      body: JSON.stringify({ address: validAddress, password })
    });

    return {
      id: accountData.id,
      address: validAddress,
      token: tokenData.token
    };
  }

  /**
   * Log into an existing Mail.tm account.
   * @param {string} address
   * @param {string} password
   * @returns {Promise<string>} JWT token
   */
  async login(address, password) {
    const data = await this._request('/token', {
      method: 'POST',
      body: JSON.stringify({ address, password })
    });
    return data.token;
  }

  /**
   * List messages for an authenticated inbox.
   * Handles both JSON-LD Hydra format and direct JSON array format.
   * @param {string} token
   * @returns {Promise<Array>}
   */
  async getMessages(token) {
    const data = await this._request('/messages', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return Array.isArray(data) ? data : (data['hydra:member'] || []);
  }

  /**
   * Get full message content with parsed verification details.
   * @param {string} token
   * @param {string} messageId
   * @returns {Promise<Object>}
   */
  async getMessage(token, messageId) {
    const msg = await this._request(`/messages/${messageId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const bodyText = msg.text || (Array.isArray(msg.html) ? msg.html.join(' ') : (msg.intro || ''));
    const extracted = extractVerificationDetails(msg.subject || '', bodyText);

    return {
      ...msg,
      extracted
    };
  }
}
