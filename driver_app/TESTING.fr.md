# Guide des tests unitaires - Application Conducteur

[English](TESTING.md) | [Français](TESTING.fr.md) | [中文](TESTING.zh.md)

Ce document présente la méthodologie et les instructions d'exécution de la suite de tests unitaires pour l'application mobile conducteur. Conçue pour être légère, ultra-rapide et totalement indépendante des services externes, elle sécurise les règles d'affaires critiques (paie, conformité routière, messagerie, connectivité hors ligne).

---

## 1. Démarrage rapide

Assurez-vous de vous situer dans le dossier `driver_app` :

```bash
cd driver_app
```

### 1.1 Exécuter la suite complète (P0 + P1 + P2)
Lancez l'ensemble des 49+ tests unitaires en quelques secondes :

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

### 1.2 Exécution par module métier

| Module | Description | Commande |
| :--- | :--- | :--- |
| **Feuille de temps (Timesheet)** | Taux horaire, protection contre division par zéro, cumul bimensuel, regroupement chronologique | `flutter test test/features/timesheet/timesheet_model_test.dart` |
| **Voyages nolisés (Charter)** | Extraction des heures, franchissement de minuit, normalisation aller-retour | `flutter test test/features/charter/charter_model_test.dart` |
| **Messagerie instantanée (Chat)** | Énumérations de canaux, désérialisation de pièces jointes, repli sur nom d'affichage | `flutter test test/features/chat/chat_model_test.dart` |
| **Itinéraires et présence** | Déduplication globale des élèves (AM/PM), recherche floue multi-critères | `flutter test test/features/route/route_model_attendance_test.dart` |
| **Réseau et authentification** | Injection/nettoyage du jeton Bearer, conversion des codes HTTP (401, 403, 500) | `flutter test test/core/network/api_client_error_handling_test.dart` |
| **Inspection pré-départ** | Règles de l'Annexe 5 (Règl. 199/07 Ont.), blocage sur défectuosité majeure, intégrité odomètre | `flutter test test/features/pretrip/pretrip_status_rules_test.dart` |
| **Stockage et résilience** | Mode hors ligne : repli automatique vers Base64 Data URI, détection de type MIME | `flutter test test/core/services/storage_service_resilience_test.dart` |
| **Sécurité de session** | Purge des jetons confidentiels lors de la déconnexion, maintien des préférences de l'appareil | `flutter test test/features/auth/session_cleanup_test.dart` |

### 1.3 Rapport de couverture de code

```bash
flutter test --coverage
# Pour générer le rendu HTML (nécessite lcov) :
# genhtml coverage/lcov.info -o coverage/html
```

---

## 2. Architecture et organisation des tests

```text
driver_app/test/
├── core/
│   ├── network/
│   │   └── api_client_error_handling_test.dart  # Interception d'authentification et codes HTTP
│   └── services/
│       └── storage_service_resilience_test.dart # Repli Base64 et détection de type MIME
├── features/
│   ├── auth/
│   │   └── session_cleanup_test.dart            # Isolation des données de session lors de la déconnexion
│   ├── charter/
│   │   └── charter_model_test.dart              # Arrêts nolisés, normalisation et calculs d'horaires
│   ├── chat/
│   │   └── chat_model_test.dart                 # Canaux, messages texte et médias
│   ├── pretrip/
│   │   └── pretrip_status_rules_test.dart       # Règlement 199/07 de l'Ontario et évaluation des anomalies
│   ├── route/
│   │   └── route_model_attendance_test.dart     # Déduplication des élèves et recherche dans la liste
│   └── timesheet/
│       ├── timesheet_model_test.dart            # Cumul de paie, division sécurisée
│       └── timesheet_period_test.dart           # Préservation des 14 jours calendrier lors de l'heure avancée
```

---

## 3. Bonnes pratiques pour l'écriture de nouveaux tests

### 3.1 Initialiser systématiquement le Binding de test
Dès lors qu'un test utilise `SharedPreferences`, des opérations d'E/S ou des canaux de plateforme, ajoutez en première ligne de `main()` :
```dart
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  // ...
}
```
*Cela empêche l'apparition de l'erreur `ServicesBinding binding mixin is only available once that binding has been initialized`.*

### 3.2 Isoler les appels réseau externes (`MockClient`)
Ne lancez jamais de requêtes HTTP réelles dans les tests unitaires. Utilisez `MockClient` de `package:http/testing.dart` :
```dart
import 'package:http/testing.dart';

final mockClient = MockClient((request) async {
  if (request.url.path.contains('/api/example')) {
    return http.Response('{"status": "ok"}', 200);
  }
  return http.Response('Non trouvé', 404);
});
```

### 3.3 Réinitialiser le stockage local entre les tests
Pour garantir l'indépendance de chaque cas de test, nettoyez le simulateur dans `setUp` :
```dart
setUp(() {
  SharedPreferences.setMockInitialValues({});
  AuthenticatedHttpClient.setToken(null);
});
```

### 3.4 Liste de contrôle des cas limites (Edge Cases)
- **Division par zéro / Nombres négatifs** : Toujours vérifier les calculs tels que le taux horaire (`payAmount / eiHours`).
- **Limites temporelles** : Tester le franchissement de minuit (`23:45 + 30 min`), la transition de fin de mois et le passage à l'heure d'été/hiver (DST).
- **Tolérance aux valeurs nulles dans le JSON** : Assurez-vous que les méthodes `fromMap` / `fromJson` ne lèvent aucune exception inattendue lorsque des champs optionnels sont absents ou `null`.
