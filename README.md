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
| **Dispatch Office Console (`web`)** | [schoolbus.pcytech.ca](https://schoolbus.pcytech.ca/)<br>*(Mirror: [schoolbusdispatchapp.web.app](https://schoolbusdispatchapp.web.app/))* | Click the **"1-Click Launch as Operations Admin"** button on the sign-in screen to instantly enter the desktop console with full administrative, dispatch, and compliance privileges.<br>*(Note: Navigate to `/?mode=ai` to directly open the full-screen standalone AI Copilot PWA)* |
| **Driver & Monitor App (`driver_app`)** | [schoolbus.pcytech.ca/driver](https://schoolbus.pcytech.ca/driver)<br>*(Mirror: [schoolbusdispatchapp.web.app/driver](https://schoolbusdispatchapp.web.app/driver))* | Click **"Quick Demo Credentials"** at the bottom of the login form to autofill demo credentials (`driver@example.com` / `password123`), choose your role as **Driver** or **Attendant**, and tap **Sign In** to experience the shift schedule, pre-trip inspections, and student boarding check-in. |
| **Parent Bus Tracker App (`parent_app`)** | [schoolbus.pcytech.ca/parent](https://schoolbus.pcytech.ca/parent)<br>*(Mirror: [schoolbusdispatchapp.web.app/parent](https://schoolbusdispatchapp.web.app/parent))* | Features passwordless passcode verification. Click **"Demo Phone"** or **"Demo Email"** to fill in demo credentials, tap **Continue**, then on the verification screen tap the amber **"Dev Passcode (Tap to autofill)"** banner to log in immediately and track the live school bus GPS route and arrival ETA. |
| **Model Context Protocol (MCP) Endpoint** | `https://dispatch-api-kv7qum3dca-nn.a.run.app/api/mcp` | Standard Anthropic MCP protocol server endpoint, allowing external AI clients (Claude Desktop, Cursor, Gemini CLI) to connect via MCP Token and inspect or run dispatch operations. |

---

## 📱 Application Suite & Core Feature Breakdown

The platform consists of a deeply integrated ecosystem of specialized applications serving fleet operators, field drivers, parents, and administrative staff:

### 1. Dispatch Office Management Console (`web`)
*Desktop & tablet operations console built with React, TypeScript, and Tailwind CSS for fleet dispatchers, supervisors, safety managers, and payroll accountants.*

- **Interactive Shift Dispatch Board**: Visual Kanban-style morning (AM), midday (MD), and afternoon (PM) shift boards with real-time status indicators (Unassigned, Scheduled, Checked-In, In-Progress, Completed).
- **Dynamic Crew & Substitute Driver Planning**: One-click driver and attendant substitution; pre-assign replacement drivers for approved time-off or emergency absences with zero schedule disruption.
- **Fleet & Vehicle Maintenance Center**: Full vehicle master registry (make, model, passenger capacity, wheelchair accessibility, VIN, odometer, fuel type). Tracks active status, maintenance history, and preventative service cycles.
- **Statutory 6-Month Inspection & SAAQ / CVOR Compliance**: Automated countdown for regulatory government safety inspections. Vehicles due or overdue for inspection or with critical defects are automatically blocked and excluded from the active dispatch assignment pool.
- **Driver & Attendant Compliance Roster**: Commercial Driver License (CDL class A/B/C/E/F), medical fitness renewal dates, and background checks with automated color-coded expiry warnings.
- **Routes, Runs & Student Manifests**: Visual route builder with ordered stop sequences, stop geofences, designated run times, student passenger rosters with photo IDs, and special medical/mobility requirements.
- **Charter Operations Management**: Dedicated charter run booking and management module. Configure departure/destination stops, client details, vehicle and crew assignments. Real-time check-in sync with the Driver App and automatic payroll line generation.
- **Payroll & Compensation Workbench**: Flexible wage configuration (custom hourly pay rates and flat per-trip rates for drivers and attendants). Auto-calculates daily shift earnings upon run completion. Dedicated charter payroll review and approval workflow with an immutable historical audit trail in `payroll_logs`.
- **Route Openings & Shift Bidding Workflow**: Dispatchers can publish open routes or temporary shifts to the driver pool. Review incoming driver bids, compare seniority or availability, and award shifts directly.
- **Safety, Defect & Incident Intake**: Immediate triage workflow for vehicle mechanical defects, roadside hazards, and student behavior incidents with photo evidence and resolution tracking.
- **BusPlanner Staging Route Sync**: Ingest, preview, and diff route data directly from BusPlanner staging collections, with automated scheduled activation or manual 1-click promotion to active live routes.
- **External Telemetry & System Sync**: Unified settings management for BambooHR staff synchronization, Zonar GPS vehicle breadcrumb mapping, and BusPlanner integration.
- **Granular RBAC Security Matrix**: Fine-grained role-based access control protecting routes, HR records, wage information, and administrative settings across multiple operational roles.
- **Model Context Protocol (MCP) Token Management**: Generate, review, and revoke secure SHA-256 hashed API tokens for external AI agents connecting via the `/api/mcp` endpoint.

---

### 2. Driver & Monitor Mobile Hub (`driver_app`)
*Cross-platform mobile and Progressive Web App built with Flutter for school bus drivers and on-board attendants.*

- **Daily Shift Overview**: Real-time morning, midday, and afternoon shift timeline showing assigned run numbers, bus number, route description, and scheduled start times.
- **One-Tap Shift Check-In / Check-Out**: Direct punch-in/punch-out syncs live arrival and departure status directly with the central dispatch shift board.
- **Assigned Charter Trips Module**: Dedicated charter cards showing assigned charter runs, client notes, crew roles (driver vs. attendant), and route stops. Includes one-tap Charter Check-In / Check-Out, real-time stop arrival/departure timestamp logging, and automatic payroll linkage.
- **Turn-by-Turn Route Itinerary & Navigation**: Chronological list of bus stops with scheduled arrival times, student counts, and integrated interactive map navigation.
- **Student Boarding & Drop-Off Attendance**: Digital check-in for every student at their designated stop using quick-tap or camera/barcode scanning. Displays student alert tags (medical notices, authorized pickup persons).
- **Schedule 5 Pre-Trip Inspection Checklist**: Mandatory digital walk-around inspection complying with regulatory safety standards (MTO / SAAQ / CVOR). Requires odometer entry, fluid checks, emergency door tests, lighting checks, and mandatory defect sign-off prior to departure.
- **Defect & Hazard Reporting**: Immediate field reporting of mechanical defects (brakes, lights, tires, engine) or roadside hazards with descriptions and photo attachments, alerting dispatch in real-time.
- **Open Route Bidding**: In-app marketplace where drivers can browse posted route openings, view compensation rates, and submit shift bids directly from their mobile phone.
- **Real-Time Dispatch Team Chat**: Secure two-way messaging channel with dispatchers and yard staff for route delays, road closures, or operational questions.
- **Push Notification Shift Reminders (FCM)**: Timely push notifications reminding drivers of upcoming shift departure times, pending pre-trip inspections, and dispatch updates.

---

### 3. Parent Bus Tracker App (`parent_app`)
*Clean, parent-friendly mobile and web app built with Flutter for parents and legal guardians.*

- **Passwordless One-Time Passcode (OTP) Login**: Secure, frictionless sign-in using SMS mobile phone number or email address—no passwords to create or reset.
- **Real-Time GPS Bus Telemetry & Map**: Interactive map tracking the school bus in real-time as it travels along the designated route polyline toward the student's stop.
- **Live Arrival ETA & Distance Countdown**: Dynamic, real-time estimated time of arrival calculation displaying exact remaining minutes and distance to the student's pickup or drop-off point.
- **Multi-Student Family Support**: Parents with multiple enrolled children can seamlessly toggle between student profiles to track independent morning and afternoon bus runs.
- **Commute Lifecycle Status Badges**: Real-time visual status updates for student commute stages (`SCHEDULED`, `EN_ROUTE`, `APPROACHING`, `BOARDED`, `DROPPED_OFF`, `ABSENT`).
- **Direct Student Absence Reporting**: Parents can report student absences in advance directly through the app, instantly notifying dispatch and removing the stop from the driver's active morning or afternoon pickup queue.
- **Two-Way Dispatch Messaging**: Dedicated communication channel allowing parents to message dispatch regarding unexpected delays, lost items, or special arrangements.
- **Customizable Commute Alerts**: Configurable push, SMS, and email alerts for when the bus is approaching the stop (e.g. 5 minutes away), safe boarding confirmation, and safe drop-off delivery.

---

### 4. AI Fleet Copilot & MCP Standard Server
*Voice-enabled intelligent operations assistant and standard agent connectivity layer.*

- **Hands-Free Walkie-Talkie Voice Interface**: Native speech-to-text dictation and high-fidelity text-to-speech audio readout for effortless voice operations.
- **Dual-Engine Architecture**:
  - *Zero-Cost Built-in Semantic Engine*: $0 token cost; instant regex and Firestore query execution for shift coverage lookups, vacant route queries, vehicle status checks, and payroll summaries.
  - *Generative Gemini LLM Engine*: Seamless escalation for complex reasoning, schedule optimization queries, and cross-domain operational questions.
- **Interactive ActionCards**: Chat interface dynamically generates clickable cards for instant driver reassignment, route status summaries, vehicle inspection details, and incident intake.
- **Standard Anthropic Model Context Protocol (MCP)**: Native `/api/mcp` endpoint and local stdio server enabling external AI tools (Claude Desktop, Cursor, Gemini CLI, custom agents) to securely inspect schedules, query driver compliance, and trigger dispatch assignments.

---

### 5. High-Performance Go Backend Microservice (`server`)
*Enterprise-grade Go microservice deployed on Google Cloud Run with sub-second response times and serverless scaling.*

- **Clean & CQRS Architecture**: High-concurrency REST API using Go 1.24+ and the Chi router, optimized for high-throughput mobile telemetry and web socket streaming.
- **Zero-Login Frictionless Email Workflows**: Twilio SendGrid / Amazon SES webhook integration allowing drivers to request time off via email and managers to approve directly from their corporate email inbox with 1-click signed URLs.
- **Twilio SMS Gateway**: Automated SMS dispatch for parent passwordless authentication codes and critical route alerts.
- **External Integration Pipeline**: Robust background sync engine interfacing with BambooHR (HR directory), Zonar Systems (GPS vehicle breadcrumbs and idle detection), and BusPlanner (staging route schedules).
- **Google BigQuery Cold Archiving**: Automated scheduled data pipeline that archives completed dispatch records, driver logs, and student attendance to BigQuery for regulatory compliance, long-term auditing, and analytics.

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

### 9. Dual-Engine AI Copilot & Full Voice I/O
- **Dual-Engine Architecture**:
  - **Zero-Cost Built-in Semantic Engine**: Free, instantaneous regex/pattern execution against Firestore for high-frequency queries (shift coverage overview, vacant routes, vehicle fleet status, student safety incidents, HR directory, time off requests, payroll, expense claims) with 0 token consumption.
  - **Generative Gemini Fallback**: Seamless escalation to Gemini API for complex inquiries, long-tail operations, and cross-domain reasoning, complete with per-user token quotas and rate limiting.
- **Interactive ActionCards**: UI dynamically renders structured, clickable action cards directly in chat (shift assignment overview, assign driver confirmation, vehicle details, student incident reports, payroll tiers, expense claims).
- **Multi-Language Voice I/O**:
  - Real-time speech-to-text dictation input via Web Speech API (English, Chinese, French).
  - High-quality text-to-speech (TTS) auto-readout for hands-free voice operations on the go.
- **Mobile PWA Standalone Mode**:
  - Installable directly as a standalone desktop/mobile Progressive Web App.
  - Access `/?mode=ai` for a clean, full-screen walkie-talkie style voice dispatch assistant.

### 10. Anthropic Model Context Protocol (MCP) Standard Integration
- **Native MCP Standard Support**: Built-in standardized MCP Server supporting both local Stdio transport (`server/cmd/mcp`) and remote HTTP MCP endpoint (`/api/mcp`).
- **External AI Agent Connectivity**: External AI tools (such as Claude Desktop, Cursor, Gemini CLI, or custom autonomous agents) can securely inspect live dispatch shifts, check vacant routes, verify driver/vehicle compliance, and trigger driver assignments.
- **Secure Token Management**: Operators can generate dedicated MCP Tokens with custom expirations in the **Settings** view, protected by SHA-256 hash storage and scoped to the user's RBAC role.

### 11. Granular Page-Level Access Control (RBAC)
- Fine-grained role-based permission matrix governing exact read/write access for Administrators, Dispatchers, Yard Supervisors, Safety Officers, Payroll Accountants, Drivers, and Parents.

### 12. BigQuery Cold Archiving & Disaster Recovery
- Active operational records reside in Firestore for sub-second latency and real-time streaming.
- Completed shifts, audit trails, and attendance logs are archived to Google BigQuery, ensuring long-term audit compliance, data security, and analytics without bloating database costs.

### 13. BusPlanner Staging Routes
- **Staging Routes** lists shifts, stops, and students pulled from BusPlanner. The page does not assign drivers, vehicles, or attendants.
- A dispatcher with write access can copy one staging route into the live route. Existing crew assignments stay as they are.
- Automatic copy runs only after BusPlanner sync is turned on. Each shift is applied at 9:00 AM America/Toronto on the weekday before its effective date. If that day is a weekend, the copy moves to Friday at 9:00 AM. The previous shift keeps running through the weekend and retires on the calendar day before the effective date.
- While sync is off, demo mode recreates five sample staging routes every Monday at 9:00 AM. Those samples are not copied into live routes automatically. The default BusPlanner address is `https://school.mybusplanner.ca`.

### 14. External Sync and Zonar Vehicle Trace
- **External Data Sync** holds BambooHR, Zonar, and BusPlanner settings. Passwords and API keys stay on the server and are never returned to the browser.
- BambooHR sync reads employees only. Zonar GPS polling and Zonar route write-back are separate switches. Route data is prepared locally and is not posted to Zonar until route sync is turned on.
- On a dispatch stop, the map can draw that vehicle's Zonar path and idle stops for the shift day when Zonar sync is enabled.

---

## Core Architecture & Tech Stack

| Module | Technologies | Description |
| :--- | :--- | :--- |
| **Driver Mobile & Web App (`driver_app`)** | **Flutter (Android / iOS / Web)** | Shift scheduling, clock-in/out, Pre-trip inspections, student boarding & drop-off check-in via barcode/camera scan, real-time dispatch alerts |
| **Parent Mobile & Web App (`parent_app`)** | **Flutter (Android / iOS / Web)** | Passwordless one-time passcode login, live school bus GPS tracking on OpenStreetMap, accurate arrival ETA, student absence reporting |
| **Dispatch Office Web Console (`web`)** | **React + TypeScript + Vite + Tailwind CSS** | High-density operations dashboard, route scheduling, BusPlanner staging, temporary driver/bus substitution, vehicle and driver compliance roster, voice AI Copilot (PWA ready) |
| **Backend API Service (`server`)** | **Go (Golang 1.24+) + Chi Router** | High-performance microservices (CQRS architecture, Twilio SMS gateway, BusPlanner staging, Zonar GPS, ETA route calculation, dual-engine AI Copilot) |
| **MCP Standard Server (`server/cmd/mcp`)** | **Go + Anthropic MCP SDK** | Standard Model Context Protocol server enabling external Claude Desktop / Cursor / custom AI agents to safely execute dispatch queries and operations |
| **Cloud Data & Event Streaming** | **Firebase / Firestore / Cloud Storage / Cloud Run** | Real-time push notifications, distributed event-driven state synchronization, scale-to-zero serverless hosting |
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
│   └── src/                         # Fleet dashboard, views, components, AI Copilot & store
├── server/                          # Go backend microservice
│   ├── cmd/server/main.go           # Web API server entrypoint
│   ├── cmd/mcp/main.go              # Anthropic MCP Server entrypoint
│   ├── cmd/seed/main.go             # Initial master data and mock seeding CLI
│   └── internal/                    # Auth, repository layer, ETA, email/SMS services, AI engine & MCP handler
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
4. *(Optional)* Run the local standalone MCP server:
   ```bash
   cd server
   go run ./cmd/mcp
   ```

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
- **MCP Token Security**: MCP Tokens are hashed with SHA-256 before storing in Firestore. The raw token is only returned to the administrator once upon creation.

---

## License

This project is licensed under the [MIT License](LICENSE).
