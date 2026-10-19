# Plateforme de Dispatch pour Autobus Scolaires & Suite Mobile pour Flotte

<p align="center">
  <strong><a href="README.md">English</a></strong> |
  <strong>Français</strong> |
  <strong><a href="README.zh-CN.md">简体中文</a></strong>
</p>

---

Une solution complète, moderne et open-source de régulation de flotte, de planification et de suivi en direct des autobus scolaires, spécialement dimensionnée pour les **petites et moyennes entreprises de transport scolaire**.

### 🎯 Échelle d'Exploitation & Capacité
- **Tournées de dispatch quotidiennes** : $< 2\,000$ tournées / jour
- **Effectifs chauffeurs & collaborateurs** : $< 1\,000$ membres
- **Proposition de valeur** : Numérisation clé en main des opérations avec un coût d'infrastructure quasi nul en période creuse, déploiement rapide et mise à l'échelle sans serveur.

---

## 🌐 Démonstration en Ligne (Live Demo)

Un environnement de démonstration public complet est directement accessible sans installation locale :

| Module Applicatif | URL Publique | Modalités d'Accès & Instructions de Connexion |
| :--- | :--- | :--- |
| **Console de Régulation Web (`web`)** | [schoolbus.pcytech.ca](https://schoolbus.pcytech.ca/)<br>*(Miroir : [schoolbusdispatchapp.web.app](https://schoolbusdispatchapp.web.app/))* | Cliquez sur le bouton **« 1-Click Launch as Operations Admin »** sur l'écran d'accueil pour accéder instantanément à la console avec tous les privilèges d'administration, de régulation et de conformité. |
| **Application Chauffeur & Accompagnateur (`driver_app`)** | [schoolbus.pcytech.ca/driver](https://schoolbus.pcytech.ca/driver)<br>*(Miroir : [schoolbusdispatchapp.web.app/driver](https://schoolbusdispatchapp.web.app/driver))* | Cliquez sur **« Quick Demo Credentials »** en bas du formulaire pour remplir les identifiants de test (`driver@example.com` / `password123`), sélectionnez le rôle **Driver** ou **Attendant**, puis appuyez sur **Sign In** pour tester les tournées, l'inspection Pre-trip et le pointage des élèves. |
| **Application Parent de Suivi en Direct (`parent_app`)** | [schoolbus.pcytech.ca/parent](https://schoolbus.pcytech.ca/parent)<br>*(Miroir : [schoolbusdispatchapp.web.app/parent](https://schoolbusdispatchapp.web.app/parent))* | Fonctionne par code d'accès temporaire sans mot de passe. Cliquez sur **« Demo Phone »** ou **« Demo Email »** pour renseigner le contact de test, appuyez sur **Continue**, puis touchez le bandeau ambré **« Dev Passcode (Tap to autofill) »** pour vous connecter instantanément et suivre la position GPS du bus sur la carte avec l'estimation d'arrivée (ETA). |

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

### 9. Assistant IA Opérationnel en Langage Naturel
- Assistant IA intégré (LLM avec appels de fonctions / Tool Calling) spécialement configuré pour le transport scolaire :
  - **Requêtes en langage naturel** : *« Combien de tournées restent-elles à effectuer aujourd'hui ? »*, *« Quels chauffeurs ont leur permis CDL arrivant à expiration ce mois-ci ? »*.
  - **Actions de dispatch assistées** : *« Affecte le chauffeur Jean au service de l'après-midi sur la Route 12 »*.

### 10. Contrôle d'Accès Granulaire par Rôle (RBAC)
- Matrice détaillée de permissions basée sur les rôles, régissant précisément les droits de lecture et d'écriture pour chaque page et fonctionnalité (Administrateurs, Dispatchers, Superviseurs de dépôt, Responsables de sécurité, Comptabilité, Chauffeurs et Parents).

### 11. Archivage Sécurisé & Sauvegarde BigQuery
- Les données opérationnelles courantes restent dans Firestore pour une latence minimale et une synchronisation en direct.
- Les tournées terminées, journaux d'audit et relevés de présence sont archivés dans Google BigQuery, alliant conformité légale à long terme et sécurité des données sans surcharger les coûts de base de données.

---

## Architecture & Technologies

| Module | Technologies | Description |
| :--- | :--- | :--- |
| **Application Chauffeur (`driver_app`)** | **Flutter (Android / iOS / Web)** | Consultation des plannings de tournée, pointage, inspection Pre-trip, embarquement/débarquement des élèves avec scan, alertes de dispatch en temps réel |
| **Application Parent (`parent_app`)** | **Flutter (Android / iOS / Web)** | Connexion rapide sans mot de passe (code temporaire), suivi en direct de l'autobus sur carte OpenStreetMap, estimation d'arrivée (ETA), signalement d'absences |
| **Console Web de Dispatch (`web`)** | **React + TypeScript + Vite + Tailwind CSS** | Tableau de bord haute densité, planification des tournées, affectations temporaires, conformité des véhicules et du personnel (PWA supporté) |
| **Serveur d'API Backend (`server`)** | **Go (Golang 1.24+) + Chi Router** | Microservices haute performance (architecture CQRS, passerelle SMS Twilio, calcul d'itinéraires et ETA, audit et sécurité) |
| **Données & Événements Cloud** | **Firebase / Firestore / Cloud Storage / Cloud Run** | Notifications push en temps réel, synchronisation d'événements distribués |
| **Entrepôt de Données & Archivage** | **Google BigQuery** | Sauvegarde à long terme et analyses historiques conformes |

---

## Structure du Monorepo

```text
DispatchFirebase/
├── driver_app/                      # Application mobile & Web pour les chauffeurs (Flutter)
│   ├── lib/
│   │   ├── firebase_options.dart.example  # Modèle de configuration Firebase client
│   │   ├── features/auth/                 # Authentification et pointage
│   │   └── features/dispatch/             # Tournées de bus et présence élèves
│   └── web/firebase-messaging-sw.js.example # Modèle de Service Worker pour push Web
├── parent_app/                      # Application mobile & Web pour les parents (Flutter)
│   ├── lib/core/api_client.dart     # Client d'API backend (supporte --dart-define=API_BASE_URL)
│   ├── lib/features/tracking/       # Couche cartographique et géolocalisation en direct
│   └── lib/features/auth/           # Authentification parents par code sécurisé
├── web/                             # Console de dispatch Web (React + Vite)
│   ├── .env.example                 # Modèle de variables d'environnement frontend
│   └── src/                         # Vues, composants et gestion d'état
├── server/                          # Serveur API backend en Go
│   ├── cmd/server/main.go           # Point d'entrée de l'API Web
│   ├── cmd/seed/main.go             # Outil d'initialisation des données de test
│   └── internal/                    # Authentification, référentiels, services ETA/SMS/Email
├── deploy/                          # Scripts de déploiement Google Cloud Run
├── .env.example                     # Modèle de variables d'environnement global
├── firestore.rules                  # Règles de sécurité Firestore
├── README.md                        # Documentation principale en anglais
├── README.fr.md                     # Documentation en français
└── README.zh-CN.md                  # Documentation en chinois
```

---

## Guide de Démarrage Rapide & Configuration Locale

Tous les identifiants de production ont été dissociés de la base de code publique. Suivez les étapes ci-dessous pour lancer le projet localement.

### 1. Configuration du Serveur Backend (`server`)

1. Copiez le fichier modèle des variables d'environnement à la racine :
   ```bash
   cp .env.example .env
   ```
2. Renseignez vos paramètres dans `.env` (les valeurs par défaut conviennent pour le développement local).
3. Démarrez le serveur Go :
   ```bash
   cd server
   go run ./cmd/server
   ```
   L'API sera disponible sur `http://localhost:8080`.

---

### 2. Configuration & Exécution de l'Application Chauffeur (`driver_app`)

1. Configurez Firebase :
   - **Méthode A (recommandée)** : Exécutez `flutterfire configure` à la racine de `driver_app` pour associer automatiquement votre propre projet Firebase.
   - **Méthode B** : Copiez les fichiers modèles et renseignez vos clés :
     ```bash
     cd driver_app
     cp lib/firebase_options.dart.example lib/firebase_options.dart
     cp web/firebase-messaging-sw.js.example web/firebase-messaging-sw.js
     ```
2. Installez les dépendances et lancez l'application :
   ```bash
   flutter pub get
   flutter run -d chrome  # ou sur un émulateur Android / simulateur iOS
   ```

---

### 3. Configuration & Exécution de l'Application Parent (`parent_app`)

L'application parent n'utilise pas directement le SDK Firebase ; elle communique avec l'API backend en Go :

```bash
cd parent_app
flutter pub get

# Lancement en développement local (cible http://localhost:8080 par défaut)
flutter run -d chrome

# Compilation pour la production avec URL personnalisée
flutter build web --dart-define=API_BASE_URL=https://votre-domaine-api.com
```

---

### 4. Console Web de Dispatch (`web`)

1. Configurez les variables d'environnement :
   ```bash
   cd web
   cp .env.example .env.local
   ```
2. Installez les paquets et lancez le serveur de développement Vite :
   ```bash
   npm install
   npm run dev
   ```
   Accédez à l'application dans votre navigateur sur `http://localhost:3000`.

---

## Bonnes Pratiques de Sécurité & Open Source

- **Protection des clés privées** : Ne validez **jamais** de fichiers contenant des clés privées réelles (`serviceAccountKey.json`, `firebase_options.dart`, `.env`). Ces fichiers sont strictement ignorés par `.gitignore`.
- **Règles Firestore** : Avant tout déploiement en production ou connexion à une base de données active, veillez à restreindre les permissions dans `firestore.rules` selon vos exigences de contrôle d'accès.

---

## Licence

Ce projet est distribué sous la [Licence MIT](LICENSE).
