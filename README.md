# 🛡️ TempMail Shield — Extension Google Chrome

> **Générez instantanément des adresses e-mail jetables et des mots de passe robustes pour vos inscriptions sur le web, remplissez les formulaires en un clic et recevez vos codes de vérification sans polluer votre boîte e-mail personnelle.**

---

## ✨ Fonctionnalités Clés

- **⚡ Génération instantanée** : Dès l'ouverture de l'extension, une adresse e-mail temporaire (via le service gratuit [Mail.tm](https://mail.tm)) et un mot de passe sécurisé à haute entropie (16 caractères) sont générés.
- **🪄 Remplissage automatique contrôlé** : Un bouton dédié « **Pré-remplir le formulaire** » injecte automatiquement l'e-mail et le mot de passe dans les champs appropriés de la page web active (compatible avec les formulaires classiques, React, Vue et Angular).
- **📬 Boîte de réception intégrée & Extraction de code** : Recevez les e-mails de confirmation en direct. L'extension analyse le contenu et extrait automatiquement les **codes de vérification** (ex: `849201`) et les **liens d'activation**, affichés en grand avec un bouton de copie rapide.
- **🔔 Pastille de notification sur l'icône Chrome** : Si vous fermez la fenêtre pendant l'inscription, un Service Worker d'arrière-plan surveille l'arrivée du message et affiche une pastille verte (`1`) sur l'icône de l'extension dans votre barre d'outils.
- **🔐 Coffre-fort local des comptes** : Enregistrez vos identifiants par nom de domaine (`domaine.com`, e-mail, mot de passe). Vos mots de passe restent strictement stockés sur votre machine (`chrome.storage.local`) et ne transitent par aucun serveur tiers.
- **🔄 Reconnexion intelligente** : En retournant sur un site déjà enregistré, l'extension vous propose en priorité de réinjecter vos identifiants existants, tout en vous laissant la possibilité de générer une nouvelle adresse qui remplacera la précédente.
- **📥 Exportation sécurisée** : Sauvegardez l'ensemble de vos comptes au format JSON à tout moment.

---

## 🚀 Installation dans Google Chrome (Mode Développeur)

L'extension est conçue en **Vanilla JavaScript natif (Manifest V3)** sans aucune dépendance ni étape de compilation. Vous pouvez la charger immédiatement :

1. Ouvrez **Google Chrome**.
2. Dans la barre d'adresse, tapez : `chrome://extensions` (ou allez dans *Menu ⋮* > *Extensions* > *Gérer les extensions*).
3. En haut à droite, activez l'interrupteur **« Mode développeur »**.
4. Cliquez sur le bouton **« Charger l'extension non empaquetée »** (Load unpacked) en haut à gauche.
5. Sélectionnez le dossier du projet :
   ```text
   C:\Users\louis.steffen\.gemini\antigravity\scratch\temp-mail-extension
   ```
6. **C'est prêt !** L'icône de bouclier **TempMail Shield** apparaît dans votre barre d'outils Chrome (pensez à cliquer sur l'icône puzzle 🧩 pour l'épingler).

---

## 📖 Guide d'Utilisation

### 1. S'inscrire sur un nouveau site
1. Rendez-vous sur la page d'inscription de n'importe quel site internet.
2. Cliquez sur l'icône de l'extension **TempMail Shield**.
3. Vous disposez immédiatement d'une adresse jetable et d'un mot de passe fort.
4. Cliquez sur **« ⚡ Pré-remplir le formulaire »** pour remplir automatiquement les champs, ou utilisez les boutons **📋 Copier**.
5. Cliquez sur **« 💾 Enregistrer pour ce site »** si vous souhaitez conserver ces identifiants pour vous reconnecter plus tard.

### 2. Récupérer le code de confirmation
1. Validez le formulaire sur le site.
2. Basculez sur l'onglet **« 📬 Boîte »** de l'extension (ou attendez la pastille verte sur l'icône si vous avez fermé la fenêtre).
3. Le code de confirmation à 6 chiffres apparaît automatiquement dans un encadré bleu en haut. Cliquez sur **« 📋 Copier le code »** et collez-le sur le site !

### 3. Se reconnecter à un site déjà enregistré
1. Retournez sur le site web.
2. Ouvrez l'extension : celle-ci détecte immédiatement le domaine et affiche votre compte existant.
3. Cliquez sur **« ⚡ Pré-remplir la connexion »** pour renseigner instantanément vos identifiants.

---

## 🏗️ Structure du Projet

```text
temp-mail-extension/
├── manifest.json            # Déclaration Manifest V3 (Service worker, permissions, popup)
├── background.js            # Service worker d'arrière-plan (alarmes & badge Chrome)
├── popup/
│   ├── popup.html           # Interface utilisateur à 3 onglets (Générateur, Boîte, Coffre)
│   ├── popup.css            # Feuille de style moderne (thèmes sombre/clair automatiques)
│   └── popup.js            # Contrôleur d'interface et logique applicative
├── scripts/
│   ├── password.js          # Générateur cryptographique de mots de passe
│   ├── mail-api.js          # Client API Mail.tm et extracteur de codes de confirmation
│   ├── vault.js             # Gestion du stockage local chrome.storage.local
│   ├── autofill.js          # Script d'injection DOM pour le pré-remplissage
│   └── generate-icons.js   # Script de génération des icônes PNG
├── icons/                   # Icônes de l'extension (16x16, 48x48, 128x128)
└── tests/                   # Suite de tests unitaires (Node.js test runner natif)
```

---

## 🧪 Tests Unitaires

Le projet utilise le runner de test natif de Node.js (`node --test`), ne nécessitant aucun paquet npm tiers :

```bash
npm test
# ou directement :
node --test tests/*.test.js
```

Tous les modules (générateur de mot de passe, client Mail.tm, extracteur regex de codes, coffre-fort avec isolation multi-domaines, injection autofill et service worker d'arrière-plan) sont couverts par 19 tests unitaires automatisés.
