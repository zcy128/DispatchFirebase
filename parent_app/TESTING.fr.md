# Guide des tests unitaires et de composants de l'application Parent

[English](TESTING.md) | [Français](TESTING.fr.md) | [中文](TESTING.zh.md)

Ce projet comprend une suite complète de 51 tests unitaires et de composants de widgets couvrant l'ensemble des fonctionnalités de l'application mobile et web de suivi des autobus scolaires : algorithmes de projection routière, sérialisation des modèles de données, machine à états BLoC, et parcours complets de l'interface utilisateur (bento en direct, horaires, messagerie de régulation, alertes et profil).

---

## 1. Démarrage rapide

Assurez-vous d'être dans le répertoire `parent_app` :

```bash
cd parent_app
```

### 1.1 Exécuter tous les tests
Exécutez l'ensemble des 51 tests unitaires et de composants en quelques secondes :

```bash
flutter test
```

### 1.2 Exécuter les modules individuellement (P0, P1, P2)

| Niveau | Module | Description | Commande |
| :---: | :--- | :--- | :--- |
| **P0** | **Moteur de projection routière** | Décodage polyline, protection Web bit-à-bit, projection Haversine sous 45m, calcul de cap | `flutter test test/map_snapping_engine_test.dart` |
| **P0** | **Modèles et sérialisation** | Tolérance aux valeurs nulles, conversion `num` vers `double`, objets imbriqués, sérialisation bidirectionnelle | `flutter test test/models_test.dart` |
| **P0** | **BLoC d'authentification** | `AuthInitialState`, restauration de session, demande et validation OTP, gestion d'erreurs | `flutter test test/auth_bloc_test.dart` |
| **P1** | **Carte Bento ETA** | Compte à rebours `EN_ROUTE`, alertes d'approche `APPROACHING`, arrivée à l'école `DROPPED_OFF` | `flutter test test/eta_card_widget_test.dart` |
| **P1** | **Écran de connexion** | Validation des champs vides, remplissage démo téléphone/courriel, bannières | `flutter test test/login_screen_test.dart` |
| **P1** | **Écran OTP / Passcode** | Badge des élèves associés, soumission du code à 6 chiffres, avertissements | `flutter test test/otp_screen_test.dart` |
| **P1** | **Horaires de parcours** | Filtres de quarts AM/PM/Vendredi, matrice des jours de semaine, sélecteur d'élèves | `flutter test test/schedule_screen_test.dart` |
| **P1** | **Tracé de la carte** | Décodage de la polyline et montage de la couche `RoadPolylineLayer` | `flutter test test/bus_map_test.dart` |
| **P2** | **Centre de contact du régulateur** | Onglets (`Live Chat` & `Call / SMS`), numéros d'urgence `(613) 555-0100` et SMS `(613) 555-0188` | `flutter test test/dispatcher_contact_sheet_test.dart` |
| **P2** | **Alertes et notifications** | Curseur de préavis (3-15 min), bascules de notification push/SMS/courriel | `flutter test test/notification_settings_sheet_test.dart` |
| **P2** | **Gestion du profil** | Pré-remplissage des données, mise à jour nom/téléphone/courriel/adresse | `flutter test test/edit_profile_sheet_test.dart` |
| **App** | **Point d'entrée global** | Montage du widget racine `ParentApp` et rendu initial | `flutter test test/widget_test.dart` |

### 1.3 Analyse statique
Vérifiez l'absence d'erreurs et d'avertissements de linter :

```bash
flutter analyze
```
