# School Bus Dispatch Platform & Mobile Fleet Suite

<p align="center">
  <strong>English</strong> |
  <strong><a href="README.fr.md">Français</a></strong> |
  <strong><a href="README.zh-CN.md">简体中文</a></strong>
</p>

---

A modern, full-stack open-source fleet dispatch, scheduling, and live tracking platform specifically tailored for **small-to-medium school bus fleet operators**.

### 🎯 Target Scale & Capacity
- **Daily Dispatch Shifts**: $< 2,000$ shifts / day
- **Fleet & Driver Roster**: $< 1,000$ staff members
- **Value Proposition**: Turnkey digital operations with near-zero idle infrastructure cost, automated serverless scaling, and rapid deployment.

---

## 🌐 Live Interactive Demo

A fully interactive public demo environment is available online with zero setup required:

| Application Module | Public Live URL | Access & Login Instructions |
| :--- | :--- | :--- |
| **Dispatch Office Console (`web`)** | [schoolbus.pcytech.ca](https://schoolbus.pcytech.ca/)<br>*(Mirror: [schoolbusdispatchapp.web.app](https://schoolbusdispatchapp.web.app/))* | Click the **"1-Click Launch as Operations Admin"** button on the sign-in screen to instantly enter the desktop console with full administrative, dispatch, and compliance privileges. |
| **Driver & Monitor App (`driver_app`)** | [schoolbus.pcytech.ca/driver](https://schoolbus.pcytech.ca/driver)<br>*(Mirror: [schoolbusdispatchapp.web.app/driver](https://schoolbusdispatchapp.web.app/driver))* | Click **"Quick Demo Credentials"** at the bottom of the login form to autofill demo credentials (`driver@example.com` / `password123`), choose your role as **Driver** or **Attendant**, and tap **Sign In** to experience the shift schedule, pre-trip inspections, and student boarding check-in. |
| **Parent Bus Tracker App (`parent_app`)** | [schoolbus.pcytech.ca/parent](https://schoolbus.pcytech.ca/parent)<br>*(Mirror: [schoolbusdispatchapp.web.app/parent](https://schoolbusdispatchapp.web.app/parent))* | Features passwordless passcode verification. Click **"Demo Phone"** or **"Demo Email"** to fill in demo credentials, tap **Continue**, then on the verification screen tap the amber **"Dev Passcode (Tap to autofill)"** banner to log in immediately and track the live school bus GPS route and arrival ETA. |

---

## 🌟 Key Advantages & Feature Highlights

### 1. Ultra-Low Operating Cost (Serverless Cloud Architecture)
- Built entirely on **Firebase + Google Cloud Run** with true pay-as-you-go economics.
- Services scale to zero automatically during non-peak operating windows, keeping monthly cloud overhead extraordinarily low for independent and regional bus contractors.

### 2. Comprehensive End-to-End Fleet Suite
- **Daily Dispatch Console**: Morning, midday, and afternoon shift management with real-time driver attendance and route assignment tracking.
- **Route & Student Records**: Integrated bus stop geofencing, student manifests, home-to-school address mappings.
- **Driver & Vehicle Compliance**: Commercial Driver License (CDL) expiration warnings, vehicle technical specifications, and active status.
- **Pay Rates & Daily Payroll**: Custom hourly and flat per-trip wage rates, instant calculation of verified payroll hours upon shift completion.
- **Incident & Safety Intake**: Immediate intake and audit lifecycle for vehicle defects, roadside hazards, and student misconduct reports.

### 3. Full Real-Time Synchronization Across All Views
- Deeply reactive architecture powered by Firebase Firestore listeners and WebSockets.
- From bus stop arrivals to leave requests, student incidents, and the dispatch shift board: **all pages update in real-time with zero manual page refreshes**.

### 4. Zero-Login Multi-Channel Email Workflows
- **Frictionless Employee Leave Requests**: Drivers and monitors can request time off by simply sending an email from their verified email address without logging into the app.
- **1-Click HR Email Approvals**: HR managers and dispatch supervisors can approve or reject leave requests directly from notification emails in their corporate inbox with a single click—no portal login required.

### 5. Automated Mobile Push Reminders (Firebase Cloud Messaging)
- Automated push notifications to drivers' mobile devices: clock-in reminders before shift start, mandatory pre-trip vehicle inspection alerts, and real-time dispatch schedule changes.

### 6. Advance Substitute & Cover Driver Scheduling
- When an employee's time-off request is approved in advance, dispatchers can immediately assign substitute/cover drivers on the workbench calendar, eliminating morning-of staffing crises.

### 7. Fleet Maintenance & Statutory Inspection Tracking
- **Government-Mandated 6-Month Safety Inspections**: Automated countdown and alerts for regulatory biannual and annual safety inspections.
- **Routine Maintenance Cycles**: Tracks oil changes, brake wear, and mechanical repairs, automatically taking buses out of the active dispatch pool when undergoing service.

### 8. Built-in Real-Time Team Chat
- Secure operational instant messaging between dispatchers, yard supervisors, and fleet personnel for instant traffic and emergency communications.

### 9. AI-Powered Natural Language Ops Assistant
- Embedded LLM assistant with function calling tailored for school bus dispatch:
  - **Natural Language Queries**: *"How many shifts are remaining today?"*, *"Which drivers have CDL licenses expiring this month?"*
  - **Natural Language Dispatch Actions**: *"Assign Driver John to the afternoon run on Route 12."*

### 10. Granular Page-Level Access Control (RBAC)
- Fine-grained role-based permission matrix governing exact read/write access for Administrators, Dispatchers, Yard Supervisors, Safety Officers, Payroll Accountants, Drivers, and Parents.

### 11. BigQuery Cold Archiving & Disaster Recovery
- Active operational records reside in Firestore for sub-second latency and real-time streaming.
- Completed shifts, audit trails, and attendance logs are archived to Google BigQuery, ensuring long-term audit compliance, data security, and analytics without bloating database costs.

### 12. BusPlanner Staging Routes
- **Staging Routes** lists shifts, stops, and students pulled from BusPlanner. The page does not assign drivers, vehicles, or attendants.
- A dispatcher with write access can copy one staging route into the live route. Existing crew assignments stay as they are.
- Automatic copy runs only after BusPlanner sync is turned on. Each shift is applied at 9:00 AM America/Toronto on the weekday before its effective date. If that day is a weekend, the copy moves to Friday at 9:00 AM. The previous shift keeps running through the weekend and retires on the calendar day before the effective date.
- While sync is off, demo mode recreates five sample staging routes every Monday at 9:00 AM. Those samples are not copied into live routes automatically. The default BusPlanner address is `https://school.mybusplanner.ca`.

### 13. External Sync and Zonar Vehicle Trace
- **External Data Sync** holds BambooHR, Zonar, and BusPlanner settings. Passwords and API keys stay on the server and are never returned to the browser.
- BambooHR sync reads employees only. Zonar GPS polling and Zonar route write-back are separate switches. Route data is prepared locally and is not posted to Zonar until route sync is turned on.
- On a dispatch stop, the map can draw that vehicle's Zonar path and idle stops for the shift day when Zonar sync is enabled.

---

## Core Architecture & Tech Stack

| Module | Technologies | Description |
| :--- | :--- | :--- |
| **Driver Mobile & Web App (`driver_app`)** | **Flutter (Android / iOS / Web)** | Shift scheduling, clock-in/out, Pre-trip inspections, student boarding & drop-off check-in via barcode/camera scan, real-time dispatch alerts |
| **Parent Mobile & Web App (`parent_app`)** | **Flutter (Android / iOS / Web)** | Passwordless one-time passcode login, live school bus GPS tracking on OpenStreetMap, accurate arrival ETA, student absence reporting |
| **Dispatch Office Web Console (`web`)** | **React + TypeScript + Vite + Tailwind CSS** | High-density operations dashboard, route scheduling, BusPlanner staging, temporary driver/bus substitution, vehicle and driver compliance roster (PWA ready) |
| **Backend API Service (`server`)** | **Go (Golang 1.24+) + Chi Router** | High-performance microservices (CQRS architecture, Twilio SMS gateway, BusPlanner staging, Zonar GPS, ETA route calculation, real-time audit logging and authentication) |
| **Cloud Data & Event Streaming** | **Firebase / Firestore / Cloud Storage / Cloud Run** | Real-time push notifications, distributed event-driven state synchronization |
| **Analytics & Cold Storage** | **Google BigQuery** | Long-term compliant shift archiving and historical reporting |

---

## Monorepo Directory Structure

```text
DispatchFirebase/
├── driver_app/                      # Flutter app for bus drivers & monitors
│   ├── lib/
│   │   ├── firebase_options.dart.example  # Firebase client configuration template
│   │   ├── features/auth/                 # Authentication & attendance clock-in
│   │   └── features/dispatch/             # Run shifts, student roster & stop check-in
│   └── web/firebase-messaging-sw.js.example # Web Push notification ServiceWorker template
├── parent_app/                      # Flutter app for parents (live bus tracker)
│   ├── lib/core/api_client.dart     # Backend API client (supports --dart-define=API_BASE_URL)
│   ├── lib/features/tracking/       # Map layers & real-time bus location tracking
│   └── lib/features/auth/           # Passwordless parent phone/email passcode auth
├── web/                             # React + Vite fleet operations desktop console
│   ├── .env.example                 # Web console environment variables template
│   └── src/                         # Fleet dashboard, views, components & store
├── server/                          # Go backend microservice
│   ├── cmd/server/main.go           # Web API server entrypoint
│   ├── cmd/seed/main.go             # Initial master data and mock seeding CLI
│   └── internal/                    # Auth, repository layer, ETA, email/SMS services
├── deploy/                          # Google Cloud Run deployment scripts
├── .env.example                     # Root environment variables template
├── firestore.rules                  # Firestore database security rules
├── README.md                        # English documentation (Primary)
├── README.fr.md                     # Documentation en français
└── README.zh-CN.md                  # 中文使用说明
```

---

## Getting Started & Local Setup Guide

All production credentials and sensitive keys have been decoupled from the public codebase. Follow the steps below to configure your development environment.

### 1. Backend Server Setup (`server`)

1. Copy the environment configuration template:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in your desired settings (default values work out-of-the-box for local testing).
3. Start the Go API server:
   ```bash
   cd server
   go run ./cmd/server
   ```
   The backend API will be available on `http://localhost:8080`.

---

### 2. Driver App Setup (`driver_app`)

1. Configure Firebase:
   - **Method A (Recommended)**: Run `flutterfire configure` in the `driver_app` root directory to link your own Firebase project.
   - **Method B**: Copy template files and populate your project keys:
     ```bash
     cd driver_app
     cp lib/firebase_options.dart.example lib/firebase_options.dart
     cp web/firebase-messaging-sw.js.example web/firebase-messaging-sw.js
     ```
2. Install dependencies and run the application:
   ```bash
   flutter pub get
   flutter run -d chrome  # or target an Android / iOS device/emulator
   ```

---

### 3. Parent App Setup (`parent_app`)

The Parent App connects directly to the Go Backend API without requiring direct Firebase SDK configuration:

```bash
cd parent_app
flutter pub get

# Run in local development mode (defaults to http://localhost:8080)
flutter run -d chrome

# Build for production with custom backend URL
flutter build web --dart-define=API_BASE_URL=https://your-api-domain.com
```

---

### 4. Dispatch Office Web Console (`web`)

1. Configure client environment:
   ```bash
   cd web
   cp .env.example .env.local
   ```
2. Install dependencies and launch the Vite dev server:
   ```bash
   npm install
   npm run dev
   ```
   Open your browser at `http://localhost:3000`.

---

## Security & Open Source Guidelines

- **Credential Hygiene**: **Never** commit files containing actual private keys or secrets (`serviceAccountKey.json`, `firebase_options.dart`, `.env`). All such files are strictly excluded via `.gitignore`.
- **Firestore Security Rules**: Before deploying to production or connecting to a live cloud database, ensure you tighten `firestore.rules` to enforce strict authorization controls.
- **Integration secrets**: BusPlanner, Zonar, and BambooHR credentials, and the BusPlanner staging collections, are readable only by the API. Firestore rules deny browser access.

---

## License

This project is licensed under the [MIT License](LICENSE).
