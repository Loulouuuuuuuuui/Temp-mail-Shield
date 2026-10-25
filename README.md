# 🛡️ TempMail Shield

<p align="center">
  <img src="icons/icon-128.png" alt="TempMail Shield Logo" width="100"/>
</p>

<p align="center">
  <strong>Extension Google Chrome pour générer des adresses e-mail jetables et des mots de passe robustes, pré-remplir les formulaires en un clic et recevoir vos codes de vérification instantanément.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Chrome_Extension-Manifest_V3-4285F4?logo=googlechrome&logoColor=white" alt="Manifest V3"/>
  <img src="https://img.shields.io/badge/Stack-Vanilla_JS_&_CSS3-F7DF1E?logo=javascript&logoColor=black" alt="Vanilla JS"/>
  <img src="https://img.shields.io/badge/Tests-25%2F25_Passing-success" alt="Tests 25/25 Passing"/>
  <img src="https://img.shields.io/badge/Privacy-100%25_Local_Storage-green" alt="Privacy First"/>
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License MIT"/>
</p>

---

## 💡 Pourquoi TempMail Shield ?

À chaque inscription sur un forum, un site de téléchargement ou un service d'essai, donner son adresse e-mail personnelle expose à :
- Des vagues de **spams et de newsletters indésirables** impossibles à désabonner.
- La revente de votre adresse à des courtiers de données tiers.
- Des risques de compromission lors de fuites de bases de données.

**TempMail Shield** résout ce problème à la source : en ouvrant l'extension au moment de l'inscription, vous obtenez une adresse e-mail temporaire (via l'infrastructure gratuite et fiable de [Mail.tm](https://mail.tm)) ainsi qu'un mot de passe fort généré localement. Vous n'avez plus besoin d'ouvrir un onglet séparé : le code de confirmation s'affiche directement dans l'extension !

---

## ✨ Fonctionnalités Principales

| Fonctionnalité | Description |
| :--- | :--- |
| **⚡ Génération Instantanée** | Dès l'ouverture, l'extension génère une adresse e-mail active et un mot de passe sécurisé à haute entropie (16 caractères avec chiffres et symboles). |
| **🪄 Remplissage Automatique (1 Clic)** | Un bouton dédié « **Pré-remplir le formulaire** » détecte les champs d'e-mail et de mot de passe sur la page web active et les remplit automatiquement (compatible avec React, Vue, Angular et HTML natif). |
| **📬 Boîte de Réception & Extraction de Code** | Visualisez les e-mails reçus en temps réel. L'extension isole automatiquement les **codes de vérification à 4-8 chiffres** (ex. `849201`) et les **liens d'activation** dans un encadré en grand avec copie rapide. |
| **🔔 Pastille de Notification Discrète** | Si vous fermez la fenêtre de l'extension pour valider le formulaire, un Service Worker d'arrière-plan surveille la réception et affiche un badge vert (`1`) sur l'icône Chrome dès que l'e-mail arrive. |
| **🔐 Coffre-Fort Local par Domaine** | Enregistrez vos identifiants par site. Tout est stocké de manière chiffrée et locale sur votre machine (`chrome.storage.local`) : **aucun mot de passe ne quitte votre navigateur**. |
| **🔄 Reconnexion Intelligente** | En revisitant un site déjà enregistré, l'extension vous propose directement de réinjecter vos identifiants existants pour vous reconnecter, ou de générer un nouveau compte jetable pour remplacer l'ancien. |
| **📥 Exportation JSON** | Sauvegardez l'ensemble de votre coffre-fort local dans un fichier JSON à tout moment. |

---

## 🚀 Installation Rapide dans Google Chrome

L'extension est construite en **Vanilla JavaScript natif** : aucun build, aucun `npm install` requis.

1. Clonez ou téléchargez ce dépôt :
   ```bash
   git clone https://github.com/Loulouuuuuuuuui/Temp-mail-Shield.git
   ```
2. Ouvrez **Google Chrome** et accédez à `chrome://extensions`.
3. Activez l'interrupteur **« Mode développeur »** en haut à droite.
4. Cliquez sur le bouton **« Charger l'extension non empaquetée »** en haut à gauche.
5. Sélectionnez le dossier du projet `Temp-mail-Shield`.
6. L'icône de bouclier **TempMail Shield** apparaît dans votre barre d'outils Chrome (pensez à l'épingler 📌).

---

## 📖 Guide d'Utilisation Pas à Pas

### 1. Inscription sur un nouveau site
1. Rendez-vous sur la page d'inscription de n'importe quel site internet.
2. Cliquez sur l'icône de l'extension **TempMail Shield**.
3. Cliquez sur **« ⚡ Pré-remplir le formulaire »** (ou utilisez les boutons de copie rapide **📋**).
4. Cliquez sur **« 💾 Enregistrer pour ce site »** si vous souhaitez conserver ces identifiants pour vous reconnecter plus tard.
5. Validez l'inscription sur le site.

### 2. Réception du code d'activation
1. Ouvrez l'onglet **« 📬 Boîte »** de l'extension (ou attendez la pastille verte `1` sur l'icône de l'extension si vous avez fermé la popup).
2. Le code de vérification à 6 chiffres s'affiche automatiquement en gros caractères. Cliquez sur **« 📋 Copier le code »** et collez-le sur le site !

### 3. Reconnexion à un site déjà enregistré
1. Retournez sur le site web.
2. Ouvrez l'extension : celle-ci détecte immédiatement le nom de domaine et affiche vos identifiants enregistrés.
3. Cliquez sur **« ⚡ Pré-remplir la connexion »** pour vous reconnecter immédiatement.

---

## 🏗️ Architecture du Projet

```text
Temp-mail-Shield/
├── manifest.json            # Déclaration Manifest V3 (Service worker, permissions, popup)
├── background.js            # Service worker d'arrière-plan (alarmes & badge d'icône)
├── popup/
│   ├── popup.html           # Interface utilisateur à 3 onglets (Générateur, Boîte, Coffre)
│   ├── popup.css            # Styles modernes avec support des thèmes clair et sombre
│   └── popup.js            # Contrôleur d'interface et orchestration des flux
├── scripts/
│   ├── password.js          # Générateur cryptographique sans biais de modulo (Web Crypto)
│   ├── mail-api.js          # Client HTTP pour l'API Mail.tm & extracteur regex de codes
│   ├── vault.js             # Gestion du stockage local chrome.storage (isolation par domaine)
│   ├── autofill.js          # Script d'injection DOM auto-contenu pour le remplissage
│   └── generate-icons.js   # Générateur programmatique d'icônes PNG
├── icons/                   # Icônes de l'extension (16x16, 48x48, 128x128)
└── tests/                   # Suite de tests unitaires exécutable nativement avec node --test
```

---

## 🧪 Tests Unitaires Automatisés

Le projet intègre une suite de 25 tests unitaires automatisés utilisant le test runner natif de Node.js, sans aucune dépendance npm :

```bash
npm test
# ou directement :
node --test tests/*.test.js
```

Couverture complète :
- `password.test.js` : Entropie, diversité de caractères, absence de biais.
- `mail-api.test.js` : Gestion des réponses Array et Hydra, assainissement des adresses, extraction de codes numériques, alphanumériques et URLs d'activation.
- `vault.test.js` : CRUD des comptes, non-duplication par domaine, isolation multi-onglets, export JSON.
- `autofill.test.js` : Sérialisation MV3 `executeScript`, heuristiques de détection, événements `input`/`change`.
- `background.test.js` : Filtre des messages non lus, filtrage des sessions de plus de 30 minutes, mise à jour et réinitialisation de la pastille badge.

---

## 🔒 Confidentialité & Sécurité

- **Zéro tracking** : Aucun système d'analyse ou de télémétrie n'est inclus.
- **Stockage 100% Local** : Vos mots de passe et vos comptes enregistrés sont conservés dans `chrome.storage.local` sur votre machine.
- **Remplissage contrôlé** : L'extension n'injecte rien sur les pages sans votre clic explicite sur le bouton d'action.

---

## 🤝 Contribution & Licence

Les contributions, signalements de bugs et suggestions de fonctionnalités sont les bienvenus ! N'hésitez pas à ouvrir une Issue ou à proposer une Pull Request.

Projet distribué sous licence **MIT**. Voir le fichier [LICENSE](LICENSE) pour plus de détails.
