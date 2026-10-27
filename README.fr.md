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
| **Application Chauffeur & Accompagnateur (`driver_app`)** | [schoolbus.pcytech.ca/driver](https://schoolbus.pcytech.ca/driver)<br>*(Miroir : [schoolbusdispatchapp.web.app/driver](https://schoolbusdispatchapp.web.app/driver))* | Cliquez sur **« Quick Demo Credentials »** en bas du formulaire pour remplir les identifiants de test (`driver1d` / `Dispatch2026!`), sélectionnez le rôle **Driver** ou **Attendant**, puis appuyez sur **Sign In** pour tester les tournées, l'inspection Pre-trip et le pointage des élèves. |
| **Application Parent de Suivi en Direct (`parent_app`)** | [schoolbus.pcytech.ca/parent](https://schoolbus.pcytech.ca/parent)<br>*(Miroir : [schoolbusdispatchapp.web.app/parent](https://schoolbusdispatchapp.web.app/parent))* | Fonctionne par code d'accès temporaire sans mot de passe. Cliquez sur **« Demo Phone »** ou **« Demo Email »** pour renseigner le contact de test, appuyez sur **Continue**, puis touchez le bandeau ambré **« Dev Passcode (Tap to autofill) »** pour vous connecter instantanément et suivre la position GPS du bus sur la carte avec l'estimation d'arrivée (ETA). |
| **Point de terminaison MCP (Model Context Protocol)** | `https://dispatch-api-kv7qum3dca-nn.a.run.app/api/mcp` | Point de terminaison standard du protocole Anthropic MCP, permettant aux agents IA externes (Claude Desktop, Cursor, Gemini CLI) de se connecter en toute sécurité avec un jeton MCP. |

---

## 📱 Suite d'Applications & Liste des Fonctionnalités Principales

La plateforme est structurée autour d'un écosystème d'applications dédiées, répondant aux besoins spécifiques des régulateurs, des chauffeurs sur le terrain, des parents d'élèves et des services administratifs :

### 1. Console de Régulation & Gestion d'Exploitation (`web`)
*Console d'exploitation sur ordinateur et tablette conçue avec React, TypeScript et Tailwind CSS pour les répartiteurs, chefs de dépôt, responsables sécurité et comptables.*

- **Tableau de Répartition Interactif des Services** : Visualisation en colonnes des services du matin (AM), du midi (MD) et du soir (PM) avec indicateurs en direct (Non assigné, Planifié, Pointé, En cours, Terminé).
- **Planification Dynamique des Remplacements (Cover Drivers)** : Assignation en un clic de chauffeurs ou d'accompagnateurs remplaçants en cas de congés validés ou d'absences imprévues, éliminant les pénuries de dernière minute.
- **Gestion Complète du Parc de Véhicules** : Fiches d'inventaire détaillées (marque, modèle, capacité en passagers, accès fauteuil roulant, numéro de châssis VIN, odomètre, type de carburant).
- **Contrôle Réglementaire Semestriel (6 mois) & Conformité SAAQ / CVOR** : Compte à rebours automatique avant l'échéance des inspections gouvernementales obligatoires. Les véhicules dont le contrôle est dépassé ou signalant une défectuosité critique sont automatiquement bloqués et retirés des listes d'assignation.
- **Registre de Conformité des Chauffeurs & Accompagnateurs** : Suivi des classes de permis de conduire professionnel (CDL), des dates de renouvellement médical et des antécédents, avec alertes visuelles automatiques d'expiration.
- **Gestion des Lignes, Circuits & Fiches Élèves** : Définition des itinéraires avec séquencement des points d'arrêt, géolocalisation, horaires théoriques et liste nominative des élèves avec besoins d'assistance particuliers.
- **Gestion Complète des Transports Nolisés & Voyages Scolaires (Charters)** :
  - **Coordination Multi-Véhicules en Flotte** : Prise en charge des grands voyages scolaires nécessitant plusieurs véhicules (ex. convoi de 10 autobus) découpés en sous-services indépendants (chauffeur + véhicule + accompagnateur). Chaque équipage pointe ses arrivées de manière isolée tandis que chaque chauffeur ne visualise que sa propre mission.
  - **Recherche & Assignation Rapide des Équipages** : Recherche instantanée dans les fiches chauffeurs et accompagnateurs avec filtrage selon la classe de permis et les disponibilités.
  - **Publication en 1 Clic des Postes Vacants (Charter Openings)** : Publication des vacations nolisées non pourvues dans l'espace des postes vacants sous une catégorie dédiée, permettant la candidature directe depuis l'application mobile.
  - **Planificateur d'Itinéraire Type à 4 Étapes** : Planification standardisée aller-retour (#1 Prise en charge à l'école 08:00 → #2 Dépose à destination 08:30 → #3 Prise en charge retour l'après-midi 15:00 → #4 Dépose finale à l'école 15:30), avec personnalisation interactive des arrêts et synchronisation en temps réel.
  - **Transparence Tarifaire & Synchronisation Paie (Payroll)** : Configuration de forfaits distincts pour chauffeurs et accompagnateurs avec heures assurables (AE). Le taux validé est révélé au chauffeur dès son pointage mobile et transmis directement au registre de paie.
- **Atelier de Rémunération & Approbation de la Paie (Payroll)** : Configuration flexible des taux horaires et des forfaits par tournée pour chauffeurs et accompagnateurs. Calcul automatisé des gains quotidiens à la clôture des services. Processus dédié de revue et validation des heures de voyages nolisés avec traçabilité dans le journal d'audit `payroll_logs`.
- **Publication des Lignes Vacantes & Candidatures Chauffeurs (Bidding)** : Diffusion des tournées ouvertes ou renforts temporaires auprès des chauffeurs. Analyse des candidatures et attribution transparente des circuits.
- **Traitement des Défectuosités, Dangers & Incidents** : Déclaration, catégorisation, photos justificatives et suivi de la résolution pour les anomalies mécaniques (Defects), dangers routiers (Hazards) et rapports de discipline élèves (Student Incidents).
- **Importation & Synchronisation BusPlanner Staging** : Importation et prévisualisation des lignes, arrêts et élèves depuis BusPlanner, comparaison des modifications et promotion automatisée ou en un clic vers les lignes actives.
- **Télémétrie & Synchronisation Externe** : Panneau de synchronisation centralisé avec BambooHR (données collaborateurs), Zonar (tracé GPS, arrêts au ralenti) et BusPlanner.
- **Matrice de Permissions Granulaire (RBAC)** : Contrôle d'accès strict par rôle protégeant les circuits, données RH, grilles salariales et paramètres système.
- **Gestion Sécurisée des Jetons MCP** : Génération et révocation de jetons Model Context Protocol sécurisés (hachage SHA-256) pour la connexion d'agents IA externes.

---

### 2. Application Mobile Chauffeur & Accompagnateur (`driver_app`)
*Application mobile multiplateforme et PWA conçue avec Flutter pour les chauffeurs d'autobus et les accompagnateurs scolaires.*

- **Planning Quotidien des Services** : Synthèse chronologique des tournées du matin, du midi et du soir avec numéros de circuit, bus attribué et heure de prise de service.
- **Pointage Rapide Prise & Fin de Service (Check-In / Check-Out)** : Enregistrement instantané synchronisant le statut en temps réel avec le tableau de régulation central.
- **Module des Transports Nolisés Assignés (Assigned Charters)** : Fiches dédiées pour les voyages scolaires et nolisés affichant les détails de course, rôle à bord (chauffeur/accompagnateur), consignes particulières et aperçu compact de l'itinéraire en 4 étapes (#1 Prise, #2 Dépose, #3 Retour prise, #4 Retour dépose) avec horaires prévus. Comprend le pointage de prise/fin de mission, l'affichage immédiat du tarif validé (ex. `150,00 $ • 5,0h AE`), l'horodatage d'arrivée et de départ à chaque étape et la transmission directe en paie.
- **Feuille de Route & Navigation Arrêt par Arrêt** : Ordre séquentiel des arrêts, horaires prévus, nombre d'élèves à embarquer et assistance cartographique.
- **Pointage des Élèves à la Montée & Descente** : Validation rapide du statut de chaque élève par sélection tactile ou lecture de code-barres / QR code via la caméra, avec mise en évidence des absences signalées et des alertes médicales.
- **Ronde de Sécurité Réglementaire Schedule 5 (Pre-Trip Inspection)** : Liste de contrôle numérique obligatoire avant le départ conforme aux exigences réglementaires (MTO / SAAQ / CVOR). Enregistrement de l'odomètre, vérification des freins, issues de secours, feux et signalement des défectuosités bloquant le départ en cas de danger majeur.
- **Déclaration Immédiate de Défectuosités & Dangers** : Signalement sur le terrain des problèmes mécaniques ou imprévus de circulation avec prise de photos et notification instantanée du dispatch.
- **Candidature aux Lignes Vacantes (Route Bidding)** : Consultation des circuits vacants et des vacations supplémentaires proposées par la régulation avec soumission directe de candidature depuis le mobile.
- **Messagerie Instantanée d'Équipe en Direct** : Canal de communication bidirectionnel direct avec le centre de régulation en cas de ralentissement ou d'urgence.
- **Notifications Push Automatisées (FCM)** : Rappels programmés avant la prise de poste, relances d'inspection pré-départ et notifications de modification de tournée.

---

### 3. Application Parent de Suivi en Direct (`parent_app`)
*Application mobile et web claire et intuitive conçue avec Flutter pour les parents et tuteurs légaux.*

- **Connexion Sécurisée Sans Mot de Passe (OTP)** : Authentification simple par numéro de téléphone SMS ou adresse courriel avec code d'accès temporaire à 6 chiffres.
- **Télémétrie GPS en Direct & Tracé Cartographique** : Visualisation en temps réel de la position de l'autobus scolaire se déplaçant le long de l'itinéraire vers l'arrêt de l'élève.
- **Estimation d'Arrivée (ETA) & Distance en Temps Réel** : Calcul dynamique du délai d'attente estimé en minutes et de la distance restante avant l'arrêt de l'enfant.
- **Prise en Charge Multi-Enfants** : Basculement fluide entre les profils de plusieurs enfants pour suivre leurs circuits respectifs du matin et de l'après-midi.
- **Indicateurs d'État du Trajet en Direct** : Suivi des étapes clés du trajet (`SCHEDULED` Prévu, `EN_ROUTE` En route, `APPROACHING` Approche imminente, `BOARDED` À bord, `DROPPED_OFF` Déposé en toute sécurité, `ABSENT` Absent).
- **Déclaration d'Absence Directe par le Parent** : Signalement en 1 clic de l'absence de l'enfant pour le matin ou le soir, alertant directement la régulation et retirant l'arrêt de la tournée du chauffeur.
- **Messagerie Dédiée avec la Régulation** : Canal de contact direct pour prévenir d'un imprévu, signaler un objet oublié ou poser une question au régulateur.
- **Alertes Personnalisables** : Notifications configurables à l'approche du bus (ex. 5 minutes avant), confirmation de montée à bord et confirmation de descente (par push, SMS ou courriel).

---

### 4. Copilote IA Opérationnel & Serveur Standard MCP
*Assistant vocal intelligent d'exploitation et interface standard pour agents d'intelligence artificielle.*

- **Interface Vocale Talkie-Walkie Mains Libres** : Dictée vocale continue (STT) et synthèse vocale haute définition (TTS) pour piloter les opérations sans clavier.
- **Architecture à Double Moteur** :
  - *Moteur Sémantique Intégré à Coût Zéro* : Zéro consommation de jetons API ; requêtes instantanées sur les circuits vacants, fiches véhicules et synthèses de paie.
  - *Moteur Génératif Gemini* : Prise en charge automatique pour les requêtes complexes, analyses d'impact et raisonnements opérationnels.
- **Cartes d'Actions Interactives (ActionCards)** : Affichage direct dans le fil de discussion de fiches interactives pour réassigner un chauffeur en un clic ou vérifier les signalements de sécurité.
- **Protocole Standard Anthropic MCP (`/api/mcp`)** : Point d'accès normalisé permettant aux outils IA (Claude Desktop, Cursor, Gemini CLI, agents autonomes) d'interroger les tournées et d'exécuter des actions avec des jetons sécurisés.

---

### 5. Microservice Backend Go Haute Performance (`server`)
*Microservice d'entreprise en langage Go déployé sur Google Cloud Run offrant une haute disponibilité et une montée en charge sans serveur.*

- **Architecture Propre & Modèle CQRS** : API REST ultra-rapide sous Go 1.24+ avec routeur Chi, optimisée pour le streaming temps réel et la télémétrie mobile.
- **Flux d'Absence par Courriel Sans Connexion** : Passerelle webhooks Twilio SendGrid / Amazon SES permettant aux chauffeurs de demander un congé par simple courriel et aux responsables de valider en 1 clic depuis leur boîte professionnelle via un lien signé sécurisé.
- **Passerelle SMS Twilio** : Expédition automatisée des codes de vérification OTP et des alertes critiques aux parents.
- **Moteur d'Intégration Externe** : Synchronisation continue avec BambooHR (fiches collaborateurs), Zonar Systems (points GPS et détection d'arrêts prolongés) et BusPlanner (horaires et circuits).
- **Archivage Réglementaire BigQuery** : Pipeline automatisé transférant les historiques de services, feuilles de présence et données de paie vers Google BigQuery pour un stockage pérenne, conforme et économique.

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

### 11. Architecture RBAC Épurée & Sécurité Granulaire par Ligne (Row-Level Security)
- **Architecture de Déclarations Ultra-Légères (`Role + Overrides`)** : Gère 34 modules opérationnels à travers 12 rôles. Pour respecter strictement la limite de 1 000 octets des Custom Claims de Firebase Auth, les jetons ne stockent que le rôle de base et les deltas de substitution (`ovr`), conservant une taille ultra-compacte (< 50 octets) sans requêtes de base de données redondantes.
- **Règles de Sécurité en Production (`firestore.rules`)** : Vérifications de propriété des documents exécutées en mémoire sans coût de lecture additionnel :
  - **Isolation des Formulaires Opérationnels** : Les chauffeurs et accompagnateurs ne peuvent interroger et soumettre que leurs propres demandes de congé, signalements d'anomalies, incidents élèves, signalements de dangers routiers, remises de clés et demandes de remboursement.
  - **Visibilité Limitée aux Affectations** : Le personnel de terrain n'a accès qu'aux tournées, manifestes d'élèves et services qui lui sont formellement attribués (`myEmployeeId in assignedEmployeeIds`).
  - **Protection des Données Financières et Secrets d'Intégration** : L'approbation des heures est réservée aux régulateurs et consultable par la comptabilité ; les identifiants et collections de transition bloquent tout accès direct côté navigateur.

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
- **Règles de Sécurité Firestore en Production** : Le fichier `firestore.rules` applique l'héritage de rôles, les surcharges de modules et l'isolation au niveau de la ligne sans surcoût de facturation ; les clients mobiles et Web ciblent strictement leurs données avec des filtres précis (ex. `where('employeeId', '==', id)`).
- **Secrets d'Intégration** : Les identifiants BusPlanner, Zonar et BambooHR, ainsi que les collections staging, ne sont accessibles que par l'API backend.
- **Sécurité des Jetons MCP** : Les jetons MCP sont stockés sous forme de hachage SHA-256 dans Firestore. Le jeton brut n'est présenté qu'une seule fois à l'opérateur lors de sa génération.

---

## Licence

Ce projet est distribué sous la [Licence MIT](LICENSE).
