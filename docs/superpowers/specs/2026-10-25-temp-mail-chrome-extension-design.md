# Document de Conception Technique : Extension Chrome d'Adresses E-mail Temporaires & Générateur d'Identifiants

**Date** : 2026-10-25  
**Auteur** : Antigravity & Utilisateur  
**Statut** : Validé techniquement, soumis à approbation finale  
**Cible** : Google Chrome Extension (Manifest V3)

---

## 1. Contexte & Intention (Le Pourquoi)
Lors des inscriptions sur divers sites internet (forums, newsletters, essais gratuits, téléchargements de fichiers), les utilisateurs sont contraints de renseigner une adresse e-mail personnelle. Cela entraîne une prolifération de spams, l'exposition des données personnelles en cas de fuite et la vente d'adresses à des courtiers de données.

L'objectif de cette extension Google Chrome est d'offrir une solution intégrée, immédiate et gratuite pour :
1. Générer une adresse e-mail temporaire (jetable) et un mot de passe robuste directement au moment de s'inscrire.
2. Remplir le formulaire du site web d'un simple clic (ou par copier-coller).
3. Sauvegarder localement l'association du compte (domaine du site, e-mail utilisé, mot de passe généré) afin de pouvoir se reconnecter ultérieurement.
4. Consulter en direct les messages de confirmation et les codes d'activation reçus sur cette adresse éphémère sans quitter la page, avec pastille de notification sur l'icône Chrome même si la popup se ferme.

---

## 2. Objectifs, Non-Objectifs & Anti-Objectifs

### Objectifs (In Scope)
- **Génération instantanée** : Création d'une boîte de réception temporaire via l'API publique et gratuite de **Mail.tm**, associée à un mot de passe fort généré localement (16 caractères avec minuscules, majuscules, chiffres et symboles).
- **Copie rapide** : Boutons de copie en un clic avec retour visuel clair pour l'adresse e-mail et le mot de passe.
- **Remplissage automatique contrôlé** : Bouton d'action permettant, à la demande explicite de l'utilisateur, d'injecter automatiquement l'e-mail et le mot de passe dans les champs appropriés (`<input type="email">`, `<input type="password">`) du site web actif.
- **Boîte de réception intégrée & surveillance continue** : 
  - Affichage des e-mails en direct dans l'onglet dédié avec mise en avant immédiate des codes de validation (ex. code à 4-8 chiffres ou lien d'activation).
  - Pastille badge sur l'icône de l'extension dans la barre d'outils Chrome (`1`, `2`...) via un Service Worker en arrière-plan lorsque la popup est fermée.
- **Coffre-fort local des comptes** : Enregistrement persistant dans `chrome.storage.local` avec le nom de domaine, l'adresse e-mail, le mot de passe et la date de création.
- **Reconnexion intelligente sur site déjà enregistré** :
  - Détection automatique si le site actif possède déjà un compte dans le coffre-fort.
  - Proposition prioritaire de réinjecter les identifiants existants pour se reconnecter.
  - Option de générer une nouvelle adresse jetable qui écrasera et remplacera l'ancienne pour ce site.
- **Gestionnaire d'historique** : Consultation des comptes enregistrés par domaine, recherche/filtrage, copie rapide des anciens identifiants, suppression et export au format JSON.
- **Expérience utilisateur fluide** : Interface organisée en 3 onglets distincts (Générateur, Boîte de réception, Comptes enregistrés).

### Non-Objectifs (Out of Scope)
- **Envoi d'e-mails** : L'extension est un récepteur passif d'e-mails de confirmation ; elle n'a pas vocation à rédiger ni à émettre des e-mails.
- **Pérennité de la boîte de messagerie** : Les boîtes d'e-mails temporaires sont éphémères par nature (dépendantes de Mail.tm). Les identifiants restent stockés localement dans Chrome pour se reconnecter au site, mais la réception de nouveaux e-mails sur cette adresse temporaire cessera après expiration du compte Mail.tm.
- **Synchronisation multi-appareils dans le cloud** : Les identifiants sont strictement conservés dans le profil Chrome local de l'utilisateur.

### Anti-Objectifs
- **Pas de remplissage sauvage ou intrusif** : L'extension ne doit jamais modifier les formulaires de la page web sans que l'utilisateur n'ait cliqué expressément sur le bouton de remplissage.
- **Zéro fuite de données** : Aucun mot de passe ni identifiant ne doit être envoyé sur un serveur tiers. Seule l'API Mail.tm est interrogée pour l'attribution et la lecture de la boîte de réception jetable.
- **Zéro surcouche de build** : Aucune dépendance npm de build, aucun bundler complexe. L'extension doit pouvoir être chargée directement en mode développeur dans Chrome.

---

## 3. Contraintes Techniques
1. **Manifest V3** : Conformité totale avec les spécifications modernes de Google Chrome (Service Worker d'arrière-plan, permissions ciblées).
2. **Permissions minimales** :
   - `storage` : pour persister les comptes enregistrés et l'état des sessions actives par domaine.
   - `activeTab` : pour détecter l'URL courante et permettre l'injection du script de remplissage uniquement sur l'onglet sélectionné.
   - `scripting` : pour exécuter la fonction de pré-remplissage des champs du formulaire.
   - `clipboardWrite` : pour copier facilement l'e-mail ou le mot de passe dans le presse-papier.
   - `alarms` : pour cadencer la surveillance discrète en arrière-plan sans épuiser les ressources.
   - `host_permissions` : `https://api.mail.tm/*` pour communiquer avec l'API de messagerie.
3. **Vanilla Web** : Code écrit en HTML5, CSS3 moderne (variables CSS, support light/dark) et JavaScript ES6 modulaire.

---

## 4. Approches Considérées & Décision

| Approche | Description | Avantages | Inconvénients | Décision |
|---|---|---|---|---|
| **Approche 1 : Native Vanilla (HTML, CSS, JS ES6)** | Extension écrite directement avec les API web et Chrome Manifest V3, sans bundler. | Zéro compilation, chargement immédiat dans Chrome, audit et maintenance faciles, taille plume (< 50 Ko). | Rendu DOM natif sans framework réactif. | **Retenue (choix validé par l'utilisateur)** |
| **Approche 2 : Framework packagé (React / Vite)** | Extension compilée avec React et Tailwind CSS via Vite/CRXJS. | Composants réactifs pour la synchronisation d'état. | Configuration lourde, dépendances volumineuses, compilation requise à chaque modification. | Écartée |

---

## 5. Spécifications Détaillées des Composants

### 5.1 Architecture des Fichiers
```text
temp-mail-extension/
├── manifest.json            # Déclaration Manifest V3 (Service worker, permissions, popup)
├── background.js            # Service worker : surveillance Mail.tm et badge Chrome
├── popup/
│   ├── popup.html           # Structure de la fenêtre avec les 3 onglets
│   ├── popup.css            # Styles modernes, variables de thèmes et responsive popup
│   └── popup.js            # Orchestration de l'interface et logique utilisateur
├── scripts/
│   ├── mail-api.js          # Client HTTP pour l'API Mail.tm (domaines, création, messages)
│   ├── password.js          # Générateur cryptographique de mots de passe robustes
│   ├── vault.js             # Gestion du stockage local chrome.storage (CRUD, sessions & export)
│   └── autofill.js          # Script injecté pour détecter et remplir les champs du site
└── icons/                   # Icônes de l'extension (16x16, 48x48, 128x128)
```

### 5.2 Parcours & Fonctionnalités par Onglet

#### Onglet 1 : Générateur / Connexion
- **Détection du contexte du site actif** :
  - L'extension extrait le domaine de l'onglet actif (ex: `forum.hardware.fr`).
- **Cas 1 : Compte existant trouvé pour ce domaine dans le coffre-fort** :
  - Affichage d'un encadré clair : *"Compte enregistré trouvé pour ce site"*.
  - Affiche l'adresse e-mail et le mot de passe masqué (avec icône œil pour afficher).
  - Bouton principal : **« ⚡ Pré-remplir la connexion »** (injecte dans les champs e-mail et mot de passe de la page).
  - Bouton secondaire : **« 🔄 Générer un nouveau compte jetable (remplacer) »**. Si cliqué, génère une nouvelle adresse Mail.tm et un nouveau mot de passe ; l'enregistrement viendra écraser l'ancienne entrée pour ce domaine.
- **Cas 2 : Aucun compte existant pour ce site** :
  - Si une session temporaire non enregistrée est déjà en cours pour ce domaine, elle est restaurée.
  - Sinon, création automatique immédiate d'une adresse Mail.tm et d'un mot de passe fort via `crypto.getRandomValues`.
  - Boutons de copie rapide pour l'e-mail et le mot de passe.
  - Bouton **« ⚡ Pré-remplir le formulaire »** : injecte dans le formulaire d'inscription du site.
  - Bouton **« 💾 Enregistrer pour ce site »** : persiste dans le coffre-fort local.

#### Onglet 2 : Boîte de Réception
- **Surveillance continue & pastille de notification** :
  - Tant que la popup est ouverte : polling toutes les 3 secondes ou réception des messages.
  - Lorsque la popup est fermée : le `background.js` prend le relais via une alarme Chrome discrète pour mettre à jour la pastille badge (`1`) sur l'icône de l'extension dans Chrome.
  - Dès réouverture de la popup, la pastille est réinitialisée et le nouveau message s'affiche.
- **Affichage des messages** :
  - Liste chronologique des e-mails reçus sur l'adresse active.
  - **Extraction intelligente du code** : Détection automatique des codes de confirmation (4 à 8 chiffres/lettres ou lien d'activation) affichés en grand avec bouton **« Copier le code »**.
  - Vue dépliable du corps complet du message si l'utilisateur souhaite lire le contenu complet.

#### Onglet 3 : Comptes Enregistrés (Coffre-fort)
- **Liste globale classée par domaine** : Consultation de tous les comptes enregistrés.
- **Recherche instantanée** : Filtre en temps réel sur le nom de domaine ou l'e-mail.
- **Actions rapides** : Copie en 1 clic de l'e-mail, du mot de passe, ou suppression de l'entrée.
- **Export sécurisé** : Bouton **« Exporter en JSON »** pour sauvegarder ses comptes localement.

---

## 6. Décisions d'Implémentation Résolues (Builder Calls)
- **Cycle de vie du Service Worker** : `background.js` surveille uniquement la boîte de réception active tant qu'elle n'est pas expirée ou enregistrée, et met à jour `chrome.action.setBadgeText`.
- **Isolation multi-domaines** : L'état des sessions temporaires est indexé par domaine (`activeSessions[domain]`) afin de ne jamais mélanger les inscriptions simultanées entre plusieurs onglets.
- **Script d'injection `autofill.js`** : Détecte à la fois les formulaires d'inscription et de connexion en ciblant intelligemment les `input[type="email"]`, `input[type="text"][autocomplete*="username"]`, `input[type="password"]` et déclenche les événements `input` et `change` natifs pour assurer la compatibilité avec React, Vue et Angular.
