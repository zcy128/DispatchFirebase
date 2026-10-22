# Plateforme de Dispatch pour Autobus Scolaires & Suite Mobile pour Flotte

<p align="center">
  <strong><a href="README.md">English</a></strong> |
  <strong>Français</strong> |
  <strong><a href="README.zh-CN.md">简体中文</a></strong>
</p>

---

Une solution complète, moderne et open-source de régulation de flotte, de planification et de suivi en direct des autobus scolaires, spécialement dimensionnée pour les **petites et moyennes entreprises de transport scolaire**.

### 🎯 Échelle d'Exploitation & Capacité
- **Tournées de dispatch quotidiennes** : $< 2,000$ tournées / jour
- **Effectifs chauffeurs & collaborateurs** : $< 1,000$ membres
- **Proposition de valeur** : Numérisation clé en main des opérations avec un coût d'infrastructure quasi nul en période creuse, déploiement rapide et mise à l'échelle sans serveur.

---

## 🌐 Démonstration en Ligne (Live Demo)

Un environnement de démonstration public complet est directement accessible sans installation locale :

| Module Applicatif | URL Publique | Modalités d'Accès & Instructions de Connexion |
| :--- | :--- | :--- |
| **Console de Régulation Web (`web`)** | [schoolbus.pcytech.ca](https://schoolbus.pcytech.ca/)<br>*(Miroir : [schoolbusdispatchapp.web.app](https://schoolbusdispatchapp.web.app/))* | Cliquez sur le bouton **« 1-Click Launch as Operations Admin »** sur l'écran d'accueil pour accéder instantanément à la console avec tous les privilèges d'administration, de régulation et de conformité.<br>*(Remarque : accédez à `/?mode=ai` pour ouvrir directement le Copilote IA en mode PWA autonome)* |
| **Application Chauffeur & Accompagnateur (`driver_app`)** | [schoolbus.pcytech.ca/driver](https://schoolbus.pcytech.ca/driver)<br>*(Miroir : [schoolbusdispatchapp.web.app/driver](https://schoolbusdispatchapp.web.app/driver))* | Cliquez sur **« Quick Demo Credentials »** en bas du formulaire pour remplir les identifiants de test (`driver@example.com` / `password123`), sélectionnez le rôle **Driver** ou **Attendant**, puis appuyez sur **Sign In** pour tester les tournées, l'inspection Pre-trip et le pointage des élèves. |
| **Application Parent de Suivi en Direct (`parent_app`)** | [schoolbus.pcytech.ca/parent](https://schoolbus.pcytech.ca/parent)<br>*(Miroir : [schoolbusdispatchapp.web.app/parent](https://schoolbusdispatchapp.web.app/parent))* | Fonctionne par code d'accès temporaire sans mot de passe. Cliquez sur **« Demo Phone »** ou **« Demo Email »** pour renseigner le contact de test, appuyez sur **Continue**, puis touchez le bandeau ambré **« Dev Passcode (Tap to autofill) »** pour vous connecter instantanément et suivre la position GPS du bus sur la carte avec l'estimation d'arrivée (ETA). |
| **Point de terminaison MCP (Model Context Protocol)** | `https://dispatch-api-kv7qum3dca-nn.a.run.app/api/mcp` | Point de terminaison standard du protocole Anthropic MCP, permettant aux agents IA externes (Claude Desktop, Cursor, Gemini CLI) de se connecter en toute sécurité avec un jeton MCP. |

---

## 🌟 Avantages Clés & Fonctionnalités Majeures

### 1. Coûts d'Exploitation Minimes (Architecture Cloud Sans Serveur)
- Conçu intégralement sur **Firebase + Google Cloud Run** avec un modèle de tarification à l'usage réel.
- Réduction automatique des instances à zéro en dehors des heures de pointe d'exploitation, maintenant les coûts d'infrastructure à un niveau extrêmement bas pour les transporteurs indépendants.

### 2. Couverture Intégrale du Cycle d'Exploitation
- **Poste de Dispatch Quotidien** : Gestion des services du matin, du midi et du soir, avec suivi en temps réel de la présence des chauffeurs et de l'état des tournées.
- **Gestion des Lignes & des Élèves** : Géolocalisation des points d'arrêt, listes d'élèves par bus, correspondances domicile-établissement scolaire.
- **Conformité des Chauffeurs & Véhicules** : Alertes d'expiration des permis de conduire commerciaux (CDL), fiches techniques et disponibilité du parc de véhicules.
- **Grilles Tarifaires & Paie Quotidienne** : Taux horaires et forfaits par tournée personnalisés, calcul automatique et instantané des heures après validation du service.
- **Sécurité & Incidents en Exploitation** : Déclaration, traitement et suivi des défectuosités mécaniques (Defects), des dangers sur la route (Hazards) et des rapports d'incidents élèves.

### 3. Synchronisation Temps Réel sur Tous les Écrans
- Intégration réactive profonde via les écouteurs Firebase Firestore et WebSockets.
- Des arrivées aux arrêts jusqu'aux demandes de congé, fiches d'incidents et tableau de répartition : **toutes les pages se mettent à jour instantanément sans aucun rechargement manuel**.

### 4. Flux de Travail par Courriel Sans Connexion (Frictionless Email)
- **Demande de congé sans mot de passe** : Les chauffeurs et accompagnateurs peuvent déposer une demande d'absence en envoyant simplement un courriel depuis leur adresse vérifiée, sans avoir à se connecter à l'application.
- **Validation RH en 1 clic dans la boîte de messagerie** : Les responsables RH et superviseurs peuvent approuver ou refuser les demandes de congé directement depuis le courriel reçu dans leur boîte professionnelle via un lien sécurisé, sans ouvrir la console web.

### 5. Notifications Push Mobiles Automatisées (Firebase Cloud Messaging)
- Envoi automatique de notifications de rappel aux chauffeurs : pointage de prise de service (Check-in), inspection avant départ obligatoire (Pre-trip Inspection) et modifications de planning en direct.

### 6. Remplacement & Planification Anticipée des Chauffeurs
- Dès qu'une demande de congé est validée à l'avance, les régulateurs peuvent programmer immédiatement les chauffeurs remplaçants (Cover/Substitute) sur le calendrier de dispatch, évitant ainsi les pénuries d'effectifs de dernière minute.

### 7. Gestion Complète du Parc & Entretien Réglementaire
- **Contrôle de Sécurité Semestriel Obligatoire (6 mois)** : Suivi rigoureux des dates d'échéance des inspections gouvernementales semestrielles et annuelles avec alertes préventives.
- **Cycle d'Entretien Courant** : Suivi des vidanges d'huile, de l'usure des freins et des pneus. Les véhicules en cours de réparation sont automatiquement retirés de la liste des bus disponibles pour le dispatch.

### 8. Messagerie Instantanée d'Équipe Intégrée (Real-time Chat)
- Canal de communication opérationnel sécurisé en temps réel entre le centre de dispatch, les responsables de dépôt et les chauffeurs sur la route.

### 9. Assistant IA Opérationnel à Double Moteur & Entrée/Sortie Vocale (Dual-Engine AI Copilot & Voice I/O)
- **Architecture Intelligente à Double Moteur** :
  - **Moteur Sémantique Intégré à Coût Zéro (Zero-Cost Built-in Engine)** : Exécution instantanée sans consommation de jetons LLM pour les requêtes quotidiennes à haute fréquence (synthèse des tournées, quarts vacants, inventaire des véhicules, incidents élèves, annuaire RH, congés, paie et notes de frais).
  - **Moteur Génératif Gemini de Secours** : Escalade fluide vers l'API Gemini pour les requêtes complexes et le raisonnement avancé, avec gestion des quotas par utilisateur et prévention de dépassement.
- **Cartes d'Actions Interactives (ActionCards)** : Affichage dynamique de cartes structurées et cliquables au cœur de la discussion (synthèse des affectations, confirmation d'attribution, fiches véhicules, rapports d'incidents, grilles tarifaires et remboursements).
- **Entrée/Sortie Vocale Multilingue (Voice I/O)** :
  - Dictée vocale en direct via l'API Web Speech (Français, Anglais, Chinois).
  - Synthèse vocale de haute qualité (TTS) avec lecture automatique des réponses pour un usage mains-libres en mobilité.
- **Mode PWA Autonome Mobile** :
  - Installation directe en tant qu'application autonome sur mobile ou ordinateur.
  - Accédez à `/?mode=ai` pour bénéficier d'un assistant vocal plein écran style talkie-walkie.

### 10. Intégration du Protocole Standard Anthropic Model Context Protocol (MCP)
- **Support Natif du Standard MCP** : Serveur MCP normalisé intégré prenant en charge le transport Stdio local (`server/cmd/mcp`) ainsi que le point de terminaison HTTP (`/api/mcp`).
- **Connectivité pour Agents IA Externes** : Permet aux outils IA externes (Claude Desktop, Cursor, Gemini CLI ou agents autonomes) d'interagir directement et en toute sécurité avec le dispatch pour consulter les plannings, identifier les lignes vacantes et effectuer des assignations.
- **Gestion Sécurisée des Jetons MCP** : Génération de jetons d'accès dédiés avec expiration personnalisée dans l'onglet **Paramètres (Settings)**, sécurisés par hachage SHA-256 et alignés sur les droits RBAC de l'opérateur.

### 11. Contrôle d'Accès Granulaire par Rôle (RBAC)
- Matrice détaillée de permissions basée sur les rôles, régissant précisément les droits de lecture et d'écriture pour chaque page et fonctionnalité (Administrateurs, Dispatchers, Superviseurs de dépôt, Responsables de sécurité, Comptabilité, Chauffeurs et Parents).

### 12. Archivage Sécurisé & Sauvegarde BigQuery
- Les données opérationnelles courantes restent dans Firestore pour une latence minimale et une synchronisation en direct.
- Les tournées terminées, journaux d'audit et relevés de présence sont archivés dans Google BigQuery, alliant conformité légale à long terme et sécurité des données sans surcharger les coûts de base de données.

### 13. Lignes staging BusPlanner
- **Staging Routes** affiche les services, arrêts et élèves importés depuis BusPlanner. Cette page n'affecte ni chauffeur, ni véhicule, ni accompagnateur.
- Un régulateur autorisé en écriture peut copier une ligne staging vers la ligne en service. Les affectations déjà en place restent inchangées.
- La copie automatique ne démarre qu'une fois la synchronisation BusPlanner activée. Chaque service est appliqué à 9 h, heure de Toronto, le jour ouvrable précédant sa date d'effet. Si ce jour tombe un week-end, la copie est avancée au vendredi à 9 h. L'ancien service continue pendant le week-end et se termine la veille calendaire de la date d'effet.
- Lorsque la synchronisation est désactivée, le mode démo recrée cinq lignes staging d'exemple chaque lundi à 9 h. Ces exemples ne sont pas copiés automatiquement vers les lignes en service. L'adresse BusPlanner par défaut est `https://school.mybusplanner.ca`.

### 14. Synchronisation externe et trace véhicule Zonar
- **External Data Sync** regroupe les réglages BambooHR, Zonar et BusPlanner. Les mots de passe et clés d'API restent sur le serveur et ne sont jamais renvoyés au navigateur.
- La synchronisation BambooHR lit uniquement les employés. Le relevé GPS Zonar et le renvoi des lignes vers Zonar sont deux interrupteurs distincts. Les données de ligne sont préparées localement et ne sont envoyées à Zonar qu'après activation du renvoi.
- Sur un arrêt de dispatch, la carte peut tracer le parcours Zonar du véhicule et ses arrêts au ralenti pour la journée du service, lorsque la synchronisation Zonar est activée.

---

## Architecture & Technologies

| Module | Technologies | Description |
| :--- | :--- | :--- |
| **Application Chauffeur (`driver_app`)** | **Flutter (Android / iOS / Web)** | Consultation des plannings de tournée, pointage, inspection Pre-trip, embarquement/débarquement des élèves avec scan, alertes de dispatch en temps réel |
| **Application Parent (`parent_app`)** | **Flutter (Android / iOS / Web)** | Connexion rapide sans mot de passe (code temporaire), suivi en direct de l'autobus sur carte OpenStreetMap, estimation d'arrivée (ETA), signalement d'absences |
| **Console Web de Dispatch (`web`)** | **React + TypeScript + Vite + Tailwind CSS** | Tableau de bord haute densité, planification des tournées, staging BusPlanner, affectations temporaires, conformité des véhicules et du personnel, Copilote IA vocal (PWA supporté) |
| **Serveur d'API Backend (`server`)** | **Go (Golang 1.24+) + Chi Router** | Microservices haute performance (architecture CQRS, passerelle SMS Twilio, staging BusPlanner, GPS Zonar, calcul d'itinéraires et ETA, Copilote IA à double moteur) |
| **Serveur MCP Standard (`server/cmd/mcp`)** | **Go + Anthropic MCP SDK** | Serveur officiel Model Context Protocol permettant aux outils Claude Desktop / Cursor d'exécuter des requêtes et actions de dispatch |
| **Données & Événements Cloud** | **Firebase / Firestore / Cloud Storage / Cloud Run** | Notifications push en temps réel, synchronisation d'événements distribués, hébergement sans serveur avec mise à l'échelle automatique |
| **Entrepôt de Données & Archivage** | **Google BigQuery** | Sauvegarde à long terme et analyses historiques conformes |

---

## Structure du Répertoire Monorepo

```text
DispatchFirebase/
├── driver_app/                      # Application Flutter chauffeurs & accompagnateurs
│   ├── lib/
│   │   ├── firebase_options.dart.example  # Modèle de configuration Firebase client
│   │   ├── features/auth/                 # Authentification & pointage de présence
│   │   └── features/dispatch/             # Tournées, liste des élèves & arrêts
│   └── web/firebase-messaging-sw.js.example # Modèle de ServiceWorker Web Push
├── parent_app/                      # Application Flutter parents (suivi en direct)
│   ├── lib/core/api_client.dart     # Client d'API backend (supporte --dart-define=API_BASE_URL)
│   ├── lib/features/tracking/       # Couches cartographiques & suivi de position en direct
│   └── lib/features/auth/           # Authentification sans mot de passe par code temporaire
├── web/                             # Console de dispatch React + Vite
│   ├── .env.example                 # Modèle de variables d'environnement web
│   └── src/                         # Tableaux de bord, vues, composants, Copilote IA & gestion d'état
├── server/                          # Microservices backend en Go
│   ├── cmd/server/main.go           # Point d'entrée de l'API Web
│   ├── cmd/mcp/main.go              # Point d'entrée du serveur MCP Anthropic
│   ├── cmd/seed/main.go             # Outil de génération des données initiales
│   └── internal/                    # Auth, couche de données, ETA, courriel/SMS, moteur IA & handlers MCP
├── deploy/                          # Scripts de déploiement Google Cloud Run
├── .env.example                     # Modèle de variables d'environnement globales
├── firestore.rules                  # Règles de sécurité Firestore
├── README.md                        # Documentation principale en anglais
├── README.fr.md                     # Documentation en français
└── README.zh-CN.md                  # Documentation en chinois simplifié
```

---

## Guide d'Installation & Configuration Locale

Tous les identifiants et clés de production ont été dissociés du code public. Suivez les étapes ci-dessous pour configurer votre environnement :

### 1. Configuration du Serveur Backend (`server`)

1. Copiez le modèle de configuration d'environnement :
   ```bash
   cp .env.example .env
   ```
2. Ouvrez le fichier `.env` et ajustez les réglages souhaités (les valeurs par défaut conviennent aux tests locaux).
3. Démarrez le serveur d'API Go :
   ```bash
   cd server
   go run ./cmd/server
   ```
   L'API backend sera accessible sur `http://localhost:8080`.
4. *(Facultatif)* Lancez le serveur MCP autonome en local :
   ```bash
   cd server
   go run ./cmd/mcp
   ```

---

### 2. Configuration de l'Application Chauffeur (`driver_app`)

1. Configurez Firebase :
   - **Méthode A (Recommandée)** : Exécutez `flutterfire configure` dans le répertoire `driver_app` pour lier votre projet Firebase.
   - **Méthode B** : Copiez les fichiers modèles et renseignez vos clés de projet :
     ```bash
     cd driver_app
     cp lib/firebase_options.dart.example lib/firebase_options.dart
     cp web/firebase-messaging-sw.js.example web/firebase-messaging-sw.js
     ```
2. Installez les dépendances et lancez l'application :
   ```bash
   flutter pub get
   flutter run -d chrome  # ou sur un émulateur Android / iOS
   ```

---

### 3. Configuration de l'Application Parent (`parent_app`)

L'application Parent se connecte directement à l'API Go sans nécessiter le SDK Firebase côté client :

```bash
cd parent_app
flutter pub get

# Lancement en mode développement local (par défaut sur http://localhost:8080)
flutter run -d chrome

# Compilation pour la production avec URL personnalisée de l'API backend
flutter build web --dart-define=API_BASE_URL=https://votre-domaine-api.com
```

---

### 4. Console Web de Régulation (`web`)

1. Configurez les variables d'environnement client :
   ```bash
   cd web
   cp .env.example .env.local
   ```
2. Installez les dépendances et démarrez le serveur Vite :
   ```bash
   npm install
   npm run dev
   ```
   Ouvrez votre navigateur à l'adresse `http://localhost:3000`.

---

## Sécurité & Bonnes Pratiques Open-Source

- **Gestion des Identifiants** : Ne committez **jamais** de fichiers contenant de vraies clés secrètes (`serviceAccountKey.json`, `firebase_options.dart`, `.env`). Ces fichiers sont strictement ignorés par le `.gitignore`.
- **Règles de Sécurité Firestore** : Avant tout déploiement en production, veillez à durcir les règles de `firestore.rules` pour verrouiller l'accès aux seules personnes autorisées.
- **Secrets d'Intégration** : Les identifiants BusPlanner, Zonar et BambooHR, ainsi que les collections staging, ne sont accessibles que par l'API backend.
- **Sécurité des Jetons MCP** : Les jetons MCP sont stockés sous forme de hachage SHA-256 dans Firestore. Le jeton brut n'est présenté qu'une seule fois à l'opérateur lors de sa génération.

---

## Licence

Ce projet est distribué sous la [Licence MIT](LICENSE).
