/**
 * Manifest V3 Background Service Worker
 * Periodically checks active temporary inboxes and displays badges on the extension icon.
 */

import { MailClient } from './scripts/mail-api.js';
import { Vault } from './scripts/vault.js';

const ALARM_NAME = 'check_temp_mail_inboxes';
const MAX_SESSION_AGE_MS = 30 * 60 * 1000; // 30 minutes active window

/**
 * Check all active sessions and update toolbar badge accordingly.
 * @param {Object} options Dependency injection for testability
 * @returns {Promise<number>} Total unread count found
 */
export async function checkPendingSessions(options = {}) {
  const action = options.action || globalThis.chrome?.action;
  const vault = options.vault || new Vault();
  const mailClient = options.mailClient || new MailClient();

  if (!action) return 0;

  let totalUnread = 0;
  const now = Date.now();

  try {
    const sessions = await vault.getAllActiveSessions();
    const sessionList = Object.values(sessions || {});

    for (const session of sessionList) {
      if (!session || !session.token) continue;

      // Only check sessions active within the last 30 minutes
      const sessionTime = new Date(session.updatedAt || session.createdAt || 0).getTime();
      if (sessionTime && (now - sessionTime) > MAX_SESSION_AGE_MS) {
        continue;
      }

      try {
        const messages = await mailClient.getMessages(session.token);
        // Only count unread messages
        const unread = (messages || []).filter(m => !m.seen);
        totalUnread += unread.length;
      } catch (err) {
        console.warn(`[TempMail Background] Error checking session for ${session.domain}:`, err.message);
      }
    }

    if (totalUnread > 0) {
      await action.setBadgeText({ text: String(totalUnread) });
      if (action.setBadgeBackgroundColor) {
        await action.setBadgeBackgroundColor({ color: '#34c759' });
      }
    } else {
      await action.setBadgeText({ text: '' });
    }
  } catch (globalErr) {
    console.error('[TempMail Background] Check failed:', globalErr);
  }

  return totalUnread;
}

// Chrome Extension Runtime Lifecycle
if (typeof globalThis.chrome !== 'undefined' && globalThis.chrome.runtime) {
  const chrome = globalThis.chrome;

  // Initialize alarms on installation/startup
  chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create(ALARM_NAME, {
      periodInMinutes: 1
    });
    checkPendingSessions();
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
      checkPendingSessions();
    }
  });

  // Listen for message events from popup (e.g. user read messages or created new account)
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === 'REFRESH_BADGE') {
      checkPendingSessions().then(count => sendResponse({ count }));
      return true;
    }
    if (message?.type === 'CLEAR_BADGE') {
      if (chrome.action) {
        chrome.action.setBadgeText({ text: '' });
      }
      sendResponse({ success: true });
      return false;
    }
  });
}
