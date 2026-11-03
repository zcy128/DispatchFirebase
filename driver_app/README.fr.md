# Application Conducteur (Driver App)

Application mobile Flutter pour conducteurs d'autobus scolaires et nolisés (Dispatch & Route Management).

[English](README.md) | [Français](README.fr.md) | [中文](README.zh.md)

---

## 🚀 Démarrage rapide

1. **Installer les dépendances** :
   ```bash
   flutter pub get
   ```

2. **Lancer l'application** :
   ```bash
   # Mode démonstration (par défaut)
   flutter run -d chrome
   
   # Ou en mode production
   flutter run --dart-define=APP_MODE=production
   ```

---

## 📁 Structure du Répertoire

```text
driver_app/
├── lib/
│   ├── core/                        # Réseau, intercepteurs, thèmes & stockage hors ligne
│   ├── features/                    # Modules fonctionnels métier
│   │   ├── auth/                    # Authentification, session & mode démo
│   │   ├── charter/                 # Voyages nolisés, séquences d'arrêts & calculs d'horaires
│   │   ├── chat/                    # Canaux de discussion, pièces jointes & messagerie directe
│   │   ├── defect/                  # Signalement des défectuosités du véhicule & historique
│   │   ├── dispatch/                # Tournées journalières, pointage départ/retour
│   │   ├── expense_reimbursement/   # Réclamations de dépenses & reçus justificatifs
│   │   ├── forms/                   # Demandes de congés & formulaires
│   │   ├── hazard_report/           # Signalement des dangers routiers et de sécurité
│   │   ├── pretrip/                 # Inspection pré-départ (Règlement 199/07 de l'Ontario)
│   │   ├── route/                   # Listes de route, horaires d'arrêts & présence des élèves
│   │   ├── timesheet/               # Feuilles de temps bimensuelles & crédits fériés
│   │   └── vehicle_signout/         # Sortie et retour de véhicule
│   └── firebase_options.dart.example# Modèle de configuration Firebase client
├── test/                            # Suites de tests unitaires automatisées P0-P2 (49+ tests)
├── TESTING.md                       # Guide détaillé des tests unitaires (EN / FR / ZH)
└── web/                             # Ressources Web & modèle de ServiceWorker
```

---

## 🧪 Guide des tests unitaires (Unit Testing)

Ce projet dispose d'une suite de tests unitaires automatisée **légère, rapide et sans dépendance réseau externe**, couvrant les calculs métier fondamentaux, les feuilles de temps et la paie, l'inspection pré-départ réglementaire, l'interception de sécurité réseau et la résilience hors ligne.

### 1. Exécuter l'ensemble des tests fondamentaux
Dans le répertoire `driver_app`, exécutez la commande suivante :

```bash
flutter test \
  test/features/timesheet/timesheet_model_test.dart \
  test/features/charter/charter_model_test.dart \
  test/features/chat/chat_model_test.dart \
  test/features/route/route_model_attendance_test.dart \
  test/core/network/api_client_error_handling_test.dart \
  test/features/pretrip/pretrip_status_rules_test.dart \
  test/core/services/storage_service_resilience_test.dart \
  test/features/auth/session_cleanup_test.dart
```

> **Performance d'exécution** : Les plus de 49 cas de test s'exécutent en environ **5 à 6 secondes** en mémoire vive pure, sans requérir de connexion réseau ni d'accès à Firebase.

### 2. Commandes de test par module

- **Feuille de temps et paie des conducteurs** :
  ```bash
  flutter test test/features/timesheet/timesheet_model_test.dart
  ```
- **Voyages nolisés (Charter) et calculs d'arrêts** :
  ```bash
  flutter test test/features/charter/charter_model_test.dart
  ```
- **Messagerie instantanée (Chat)** :
  ```bash
  flutter test test/features/chat/chat_model_test.dart
  ```
- **Itinéraires et listes de présence des élèves** :
  ```bash
  flutter test test/features/route/route_model_attendance_test.dart
  ```
- **Gestion des erreurs réseau et authentification** :
  ```bash
  flutter test test/core/network/api_client_error_handling_test.dart
  ```
- **Inspection pré-départ (Règlement 199/07 de l'Ontario - Annexe 5)** :
  ```bash
  flutter test test/features/pretrip/pretrip_status_rules_test.dart
  ```
- **Résilience hors ligne et repli Base64** :
  ```bash
  flutter test test/core/services/storage_service_resilience_test.dart
  ```
- **Nettoyage sécurisé des données lors de la déconnexion** :
  ```bash
  flutter test test/features/auth/session_cleanup_test.dart
  ```

Pour consulter l'architecture détaillée des tests, les directives de simulation (Mock) et les bonnes pratiques, veuillez consulter : 👉 **[TESTING.fr.md](./TESTING.fr.md)** (également disponible en [English](./TESTING.md) et [中文](./TESTING.zh.md)).
