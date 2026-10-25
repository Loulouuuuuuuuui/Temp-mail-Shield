# Plan de Réalisation : Extension Chrome d'Adresses E-mail Temporaires & Générateur d'Identifiants

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire une extension Google Chrome Manifest V3 complète permettant de générer des e-mails jetables (API Mail.tm) et des mots de passe robustes, de pré-remplir les formulaires à la demande, de surveiller la réception des codes d'activation (avec pastille sur l'icône Chrome) et de stocker les comptes dans un coffre-fort local indexé par domaine.

**Architecture:** Pure Vanilla Web (HTML5, CSS3, JavaScript ES6 modulaire) sans dépendances de build lourdes. Architecture Manifest V3 avec Service Worker d'arrière-plan pour les alarmes et la pastille badge, modules métier isolés et testables unitairement via le runner natif Node.js (`node --test`), et script injecté pour l'autofill DOM.

**Tech Stack:** JavaScript ES6, Chrome Extensions Manifest V3 APIs (`storage`, `activeTab`, `scripting`, `alarms`, `action`, `clipboardWrite`), Node.js `node --test`.

**Spec:** [docs/superpowers/specs/2026-10-25-temp-mail-chrome-extension-design.md](file:///C:/Users/louis.steffen/.gemini/antigravity/scratch/temp-mail-extension/docs/superpowers/specs/2026-10-25-temp-mail-chrome-extension-design.md)

---

## Global Constraints
- Manifest V3 compliant : pas de code arbitraire évalué (`eval`, `new Function`), permissions limitées au strict nécessaire.
- Zéro dépendance d'exécution : l'extension finale ne doit requérir aucun outil de compilation ou bundler.
- Stockage des identifiants strictement local via `chrome.storage.local`.
- L'API externe autorisée est uniquement `https://api.mail.tm/*`.
- Tests unitaires exécutables nativement avec `node --test`.

## Review Focus
1. **Échec réseau de Mail.tm (hors ligne / quota)** : L'extension doit afficher un message d'erreur clair et une option de réessai sans planter ni bloquer l'interface.
2. **Formulaires avec champs masqués ou spécifiques (ex. React/Vue synthetic events)** : L'injection autofill doit déclencher explicitement `new Event('input', { bubbles: true })` et `new Event('change', { bubbles: true })`.
3. **Extraction de codes avec formats variés** : La détection doit identifier aussi bien un code à 6 chiffres (`849201`), un code alphanumérique court (`KJ89-21`), qu'un lien d'activation (`https://.../activate?...`).
4. **Collision de domaines sur plusieurs onglets** : Deux onglets ouverts sur des sites différents doivent maintenir chacun leur session temporaire active sans écrasement mutuel.
5. **Remplacement d'un compte existant** : Lorsqu'un utilisateur demande à remplacer un compte enregistré, le coffre-fort doit mettre à jour l'entrée existante pour ce domaine sans créer de doublon.

---

### Task 1: Initialisation du Projet & Configuration des Tests

**Files:**
- Create: `package.json`
- Test: `tests/smoke.test.js`

**Interfaces:**
- Produces: Base de test unitaire exécutable avec `npm test` via le test runner natif de Node.js.

- [ ] **Step 1: Créer le test smoke de validation**

```javascript
// tests/smoke.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('smoke test: Node.js test runner is functional', () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 2: Créer le package.json minimal**

Créer `package.json` avec `"type": "module"` et `"scripts": { "test": "node --test tests/**/*.test.js" }`.

- [ ] **Step 3: Exécuter le test smoke**

Run: `node --test tests/smoke.test.js`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add package.json tests/smoke.test.js
git commit -m "chore: initialize project with native node test runner"
```

---

### Task 2: Générateur Cryptographique de Mots de Passe (`scripts/password.js`)

**Files:**
- Create: `scripts/password.js`
- Test: `tests/password.test.js`

**Interfaces:**
- Produces: `generatePassword(length?: number, options?: { lowercase?: boolean, uppercase?: boolean, numbers?: boolean, symbols?: boolean }): string`

- [ ] **Step 1: Écrire les tests unitaires pour le générateur de mot de passe**

```javascript
// tests/password.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePassword } from '../scripts/password.js';

test('generatePassword creates a password of specified length', () => {
  const pwd = generatePassword(20);
  assert.equal(pwd.length, 20);
});

test('generatePassword defaults to 16 characters with mixed entropy', () => {
  const pwd = generatePassword();
  assert.equal(pwd.length, 16);
  assert.match(pwd, /[a-z]/);
  assert.match(pwd, /[A-Z]/);
  assert.match(pwd, /[0-9]/);
  assert.match(pwd, /[^a-zA-Z0-9]/);
});
```

- [ ] **Step 2: Exécuter le test pour vérifier l'échec initial**

Run: `node --test tests/password.test.js`
Expected: FAIL avec import error / module non trouvé.

- [ ] **Step 3: Implémenter `generatePassword` dans `scripts/password.js`**

Utiliser `crypto.getRandomValues` (ou `crypto.randomBytes` en fallback universel) pour garantir une entropie cryptographique sécurisée et éviter tout biais de modulo.

- [ ] **Step 4: Exécuter le test pour vérifier le succès**

Run: `node --test tests/password.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/password.js tests/password.test.js
git commit -m "feat: implement secure cryptographic password generator"
```

---

### Task 3: Client API Mail.tm & Extracteur de Codes (`scripts/mail-api.js`)

**Files:**
- Create: `scripts/mail-api.js`
- Test: `tests/mail-api.test.js`

**Interfaces:**
- Produces:
  - `MailClient`: classe fournissant `getAvailableDomains(): Promise<string[]>`, `createAccount(address, password): Promise<{ id, address, token }>`, `getMessages(token): Promise<Array>`, `getMessage(token, id): Promise<Object>`
  - `extractVerificationDetails(subject, body): { code: string | null, activationUrl: string | null }`

- [ ] **Step 1: Écrire les tests unitaires pour l'extraction de codes et les requêtes Mail.tm**

```javascript
// tests/mail-api.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractVerificationDetails, MailClient } from '../scripts/mail-api.js';

test('extractVerificationDetails captures 6-digit verification code', () => {
  const body = "Votre code de confirmation est : 849201. Ne le partagez pas.";
  const res = extractVerificationDetails("Code de vérification", body);
  assert.equal(res.code, "849201");
});

test('extractVerificationDetails captures activation link when present', () => {
  const body = "Cliquez sur ce lien pour activer votre compte: https://example.com/auth/verify?token=abc123xyz";
  const res = extractVerificationDetails("Activez votre compte", body);
  assert.equal(res.activationUrl, "https://example.com/auth/verify?token=abc123xyz");
});

test('MailClient formats requests to mail.tm api correctly', async () => {
  const mockFetch = async (url, options) => {
    if (url.includes('/domains')) {
      return { ok: true, json: async () => ({ 'hydra:member': [{ domain: 'temp-mail.org', isActive: true }] }) };
    }
    return { ok: false };
  };
  const client = new MailClient({ fetchFn: mockFetch });
  const domains = await client.getAvailableDomains();
  assert.deepEqual(domains, ['temp-mail.org']);
});
```

- [ ] **Step 2: Exécuter le test pour vérifier l'échec initial**

Run: `node --test tests/mail-api.test.js`
Expected: FAIL avec module non trouvé.

- [ ] **Step 3: Implémenter `scripts/mail-api.js`**

Implémenter `extractVerificationDetails` avec des expressions régulières robustes (détection de codes 4 à 8 chiffres/lettres et URLs de confirmation). Implémenter la classe `MailClient` avec gestion des erreurs HTTP (statuts 429 quota, 401 token expiré, 500) et fallback de `fetch`.

- [ ] **Step 4: Exécuter le test pour vérifier le succès**

Run: `node --test tests/mail-api.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/mail-api.js tests/mail-api.test.js
git commit -m "feat: implement Mail.tm client and verification code extractor"
```

---

### Task 4: Coffre-fort Local & Gestionnaire de Sessions par Domaine (`scripts/vault.js`)

**Files:**
- Create: `scripts/vault.js`
- Test: `tests/vault.test.js`

**Interfaces:**
- Produces:
  - `Vault`: classe d'accès à `chrome.storage.local` avec méthodes :
    - `saveAccount(domain, { email, password }): Promise<void>` (remplace si existant)
    - `getAccount(domain): Promise<{ email, password, updatedAt } | null>`
    - `getAllAccounts(): Promise<Record<string, { email, password, updatedAt }>>`
    - `deleteAccount(domain): Promise<void>`
    - `exportJson(): Promise<string>`
    - `getActiveSession(domain): Promise<Object | null>`
    - `setActiveSession(domain, sessionData): Promise<void>`
    - `clearActiveSession(domain): Promise<void>`

- [ ] **Step 1: Écrire les tests unitaires pour le Vault**

```javascript
// tests/vault.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vault } from '../scripts/vault.js';

test('Vault stores and retrieves account by domain', async () => {
  const store = {};
  const mockStorage = {
    get: async (keys) => {
      const res = {};
      const keyList = Array.isArray(keys) ? keys : [keys];
      keyList.forEach(k => { if (k in store) res[k] = store[k]; });
      return res;
    },
    set: async (items) => { Object.assign(store, items); },
    remove: async (keys) => { (Array.isArray(keys) ? keys : [keys]).forEach(k => delete store[k]); }
  };

  const vault = new Vault({ storageArea: mockStorage });
  await vault.saveAccount('github.com', { email: 'test@mail.com', password: 'Secret123!' });

  const account = await vault.getAccount('github.com');
  assert.equal(account.email, 'test@mail.com');
  assert.equal(account.password, 'Secret123!');
});

test('Vault isolates active sessions per domain', async () => {
  const store = {};
  const mockStorage = {
    get: async () => store,
    set: async (items) => { Object.assign(store, items); }
  };
  const vault = new Vault({ storageArea: mockStorage });
  await vault.setActiveSession('siteA.com', { email: 'a@mail.com' });
  await vault.setActiveSession('siteB.com', { email: 'b@mail.com' });

  assert.equal((await vault.getActiveSession('siteA.com')).email, 'a@mail.com');
  assert.equal((await vault.getActiveSession('siteB.com')).email, 'b@mail.com');
});
```

- [ ] **Step 2: Exécuter le test pour vérifier l'échec initial**

Run: `node --test tests/vault.test.js`
Expected: FAIL.

- [ ] **Step 3: Implémenter `scripts/vault.js`**

Gérer la persistance dans `chrome.storage.local` avec indexation propre des comptes sous la clé `vault_accounts` et des sessions sous `active_sessions`. Fournir des fallbacks mémoire si `chrome.storage` n'est pas injecté (environnement de test).

- [ ] **Step 4: Exécuter le test pour vérifier le succès**

Run: `node --test tests/vault.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/vault.js tests/vault.test.js
git commit -m "feat: implement local vault and domain-scoped session storage"
```

---

### Task 5: Script d'Injection & Remplissage de Formulaires (`scripts/autofill.js`)

**Files:**
- Create: `scripts/autofill.js`
- Test: `tests/autofill.test.js`

**Interfaces:**
- Produces:
  - `fillFormFields(documentRoot, { email, password }): { filledEmail: boolean, filledPassword: boolean }`
  - Code auto-exécutable lors de l'injection via `chrome.scripting.executeScript`.

- [ ] **Step 1: Écrire les tests unitaires pour la détection et l'injection des champs**

```javascript
// tests/autofill.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fillFormFields } from '../scripts/autofill.js';

test('fillFormFields identifies and populates email and password inputs', () => {
  const inputs = [
    { type: 'email', value: '', events: [], setAttribute() {}, dispatchEvent(e) { this.events.push(e.type); } },
    { type: 'password', value: '', events: [], setAttribute() {}, dispatchEvent(e) { this.events.push(e.type); } }
  ];
  const mockDoc = {
    querySelectorAll: (sel) => {
      if (sel.includes('input')) return inputs;
      return [];
    }
  };

  const res = fillFormFields(mockDoc, { email: 'user@temp.com', password: 'Password123!' });
  assert.equal(res.filledEmail, true);
  assert.equal(res.filledPassword, true);
  assert.equal(inputs[0].value, 'user@temp.com');
  assert.equal(inputs[1].value, 'Password123!');
  assert.ok(inputs[0].events.includes('input'));
  assert.ok(inputs[0].events.includes('change'));
});
```

- [ ] **Step 2: Exécuter le test pour vérifier l'échec initial**

Run: `node --test tests/autofill.test.js`
Expected: FAIL.

- [ ] **Step 3: Implémenter `scripts/autofill.js`**

Parcourir les formulaires en priorisant les champs `type="email"`, `autocomplete="email"`, `name/id/placeholder` contenant "mail" ou "username", et `type="password"`. Déclencher les événements `input` et `change` standard pour assurer la prise en compte immédiate par React/Vue/Angular.

- [ ] **Step 4: Exécuter le test pour vérifier le succès**

Run: `node --test tests/autofill.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/autofill.js tests/autofill.test.js
git commit -m "feat: implement robust form field autofill script"
```

---

### Task 6: Service Worker d'Arrière-Plan & Surveillance Badge (`background.js`)

**Files:**
- Create: `background.js`
- Test: `tests/background.test.js`

**Interfaces:**
- Consumes: `MailClient` (`scripts/mail-api.js`), `Vault` (`scripts/vault.js`)
- Produces: Gestionnaire d'alarmes périodiques `chrome.alarms` et mise à jour de la pastille badge `chrome.action.setBadgeText`.

- [ ] **Step 1: Écrire les tests unitaires pour la logique de synchronisation d'arrière-plan**

```javascript
// tests/background.test.js
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
    getActiveSessions: async () => ({
      'example.com': { token: 'valid-token', lastChecked: 0 }
    })
  };
  const mockMailClient = {
    getMessages: async () => [{ id: 'msg-1', seen: false }]
  };

  await checkPendingSessions({ action: mockAction, vault: mockVault, mailClient: mockMailClient });
  assert.equal(badgeText, '1');
  assert.equal(badgeColor, '#34c759');
});
```

- [ ] **Step 2: Exécuter le test pour vérifier l'échec initial**

Run: `node --test tests/background.test.js`
Expected: FAIL.

- [ ] **Step 3: Implémenter `background.js`**

Configurer l'écouteur `chrome.alarms.onAlarm`, la vérification des sessions actives créées depuis moins de 30 minutes, et l'affichage de la pastille verte de notification.

- [ ] **Step 4: Exécuter le test pour vérifier le succès**

Run: `node --test tests/background.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add background.js tests/background.test.js
git commit -m "feat: implement background service worker with alarm polling and badge alerts"
```

---

### Task 7: Interface Utilisateur Popup & Navigation par Onglets (`popup/`)

**Files:**
- Create: `popup/popup.html`
- Create: `popup/popup.css`
- Create: `popup/popup.js`

**Interfaces:**
- Consumes: `generatePassword` (`scripts/password.js`), `MailClient` (`scripts/mail-api.js`), `Vault` (`scripts/vault.js`), `fillFormFields` (`scripts/autofill.js`).
- Produces: Fenêtre complète de l'extension avec :
  - Barre d'onglets (Générateur, Boîte de réception avec pastille, Comptes enregistrés).
  - Onglet 1 : Détection de compte existant / Bouton de reconnexion / Génération jetable / Pré-remplissage / Enregistrement.
  - Onglet 2 : Boîte de réception live avec extraction proéminente du code de vérification à 6 chiffres et affichage du sujet/corps.
  - Onglet 3 : Liste des comptes enregistrés avec recherche, bouton copier mot de passe masqué, suppression et export JSON.

- [ ] **Step 1: Créer la structure HTML (`popup/popup.html`)**
- [ ] **Step 2: Créer la feuille de style moderne (`popup/popup.css`) avec thèmes clair/sombre et feedback visuel de copie**
- [ ] **Step 3: Implémenter le contrôleur `popup/popup.js`**
- [ ] **Step 4: Vérifier la cohérence de chargement des modules ES6 sans erreur de syntaxe**

Run: `node --check popup/popup.js`
Expected: PASS sans erreur.

- [ ] **Step 5: Commit**

```bash
git add popup/
git commit -m "feat: create modern 3-tab popup interface with generator, inbox and vault"
```

---

### Task 8: Configuration Manifest V3 & Ressources Graphiques (`manifest.json`, `icons/`)

**Files:**
- Create: `manifest.json`
- Create: `icons/icon-16.png`, `icons/icon-48.png`, `icons/icon-128.png`

**Interfaces:**
- Produces: Package d'extension Chrome installable valide.

- [ ] **Step 1: Créer le fichier `manifest.json` Manifest V3**
  - `"manifest_version": 3`
  - `"name": "TempMail Shield - E-mail Temporaire & Identifiants"`
  - `"permissions": ["storage", "activeTab", "scripting", "alarms", "clipboardWrite"]`
  - `"host_permissions": ["https://api.mail.tm/*"]`
  - `"background": { "service_worker": "background.js", "type": "module" }`
  - `"action": { "default_popup": "popup/popup.html" }`
- [ ] **Step 2: Générer les icônes de l'extension au format PNG (16x16, 48x48, 128x128)**
- [ ] **Step 3: Valider la conformité JSON du manifest**

Run: `node -e "JSON.parse(fs.readFileSync('manifest.json'))"`
Expected: PASS sans erreur.

- [ ] **Step 4: Commit**

```bash
git add manifest.json icons/
git commit -m "feat: add Manifest V3 configuration and extension icons"
```

---

### Task 9: Guide d'Installation & Suite Complète de Tests

**Files:**
- Create: `README.md`

- [ ] **Step 1: Exécuter l'intégralité des tests unitaires**

Run: `npm test`
Expected: 100% PASS sur tous les tests unitaires.

- [ ] **Step 2: Rédiger le guide d'utilisation pas à pas dans `README.md`**
  - Procédure de chargement dans Google Chrome (`chrome://extensions` > "Mode développeur" > "Charger l'extension non empaquetée").
  - Présentation des fonctionnalités clés et astuces d'utilisation.

- [ ] **Step 3: Commit final**

```bash
git add README.md
git commit -m "docs: add installation guide and usage instructions"
```
