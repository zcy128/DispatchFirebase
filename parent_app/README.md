# Parent Bus Tracker App (`parent_app`)

<p align="center">
  <strong>Family-Centric Real-Time School Bus Tracking & Dispatch Communication Suite</strong>
</p>

---

## 📖 Overview

The **Parent Bus Tracker App** is a cross-platform mobile and web application built with Flutter, tailored for parents and legal guardians. It provides real-time GPS telemetry of school buses, accurate arrival countdowns (ETA), multi-student commute monitoring, master route timetable comparison (such as early dismissal days), direct student absence reporting, and an integrated Dispatch Operations Desk.

Designed according to **Direction C (Gentler Streak Family Bento)** design principles, the user interface uses a reassuring dark palette with high-contrast amber, emerald, and lavender accents. Internal operational codes (such as dispatch route IDs) are intentionally removed from the parent experience, prioritizing clear bus unit numbers, driver details, and stop schedules.

---

## 🌟 Core Features

### 1. 🏠 Bento Live Tracking
- **Interactive Full-Screen Live Map**: Real-time GPS bus location plotted on OpenStreetMap with decoded road polylines, geofences, and animated markers.
- **Micro-Stepper Progress Bar**: Visual commute stages indicating progression from depot to designated pickup stop and destination school.
- **Calming ETA Countdown Slot**: Real-time arrival estimation (e.g. `< 2 MINS AWAY` or `7 MINS AWAY`) with scheduled time comparison.
- **Ultra-Compact Bento Card**: Reassurance header with child commute state (`Bus Arriving Shortly`, `On Board`, `Safe Arrival`), bus unit number, and distance countdown. Takes up only ~26% of screen height, leaving 74%+ for the map view.
- **One-Tap Quick Actions**: Instant phone dialer for the assigned driver and immediate student absence submission shortcut.

### 2. 📅 Schedule & Master Timetable
- **Master Plan vs. Live Dispatch**: Clear distinction between the school board's master planned timetable and the live daily dispatch shifts (e.g., Monday–Thursday standard 3:00 PM dismissal vs. Friday 1:00 PM early dismissal).
- **Stop-by-Stop Itinerary**: Chronological list of stops, scheduled arrival times, and stop locations for AM pickup and PM drop-off shifts.
- **Real-Time Operational Callouts**: Clear status indicators showing whether today's service follows the master plan or has active adjustments.

### 3. 📞 Support & Dispatch Operations Desk
- **Live Bidirectional Chat**: Direct WebSocket-based messaging with school bus dispatchers and operations desk.
- **24/7 SMS Hotline Directory**: Dedicated guide modal providing automated SMS commands (`ABSENT`, `STATUS`, `HELP`, `STOP`) with one-tap dialing and messaging.
- **Multi-Child Commute Switcher**: Easily switch between enrolled children in multi-student households.
- **Structured Absence Reporting**: Advance leave reporting for morning, afternoon, or full-day shifts, instantly updating dispatch rosters and notifying drivers.

### 4. 🔐 Frictionless Authentication
- **Passwordless Sign-In**: Authentication via phone number (SMS OTP) or email address with a 6-digit verification code.
- **Demo Autofill**: Built-in 1-tap demo credentials for immediate testing and evaluation.

---

## 🎨 Design System: Direction C (Family Bento)

| Token | Hex Value | Role |
| :--- | :--- | :--- |
| `background` | `#0B101D` | Calming Obsidian Base |
| `surface` | `#141C2E` | Deep Navy Bento Card Surface |
| `surfaceMuted` | `#19233A` | Recessed Info Container |
| `surfaceHighlight` | `#1E293B` | Interactive Button / Chip Highlight |
| `primary` | `#FACC15` | Warm School Bus Amber |
| `secondary` | `#34D399` | Reassuring Emerald (On Time / Safe Arrival) |
| `coral` | `#F87171` | Gentle Alert / Absence Action |
| `lavender` | `#A78BFA` | Driver / Operations Accent |
| `border` | `#25324B` | Subtle High-Contrast Border |

---

## 🛠️ Tech Stack & Architecture

- **Framework**: Flutter 3.x / Dart 3.x
- **State Management**: `flutter_bloc`
- **Mapping & Geodata**: `flutter_map` (OpenStreetMap), `latlong2`, custom road-snapping polyline engine
- **Networking**: REST API + WebSockets (`http`, `web_socket_channel`)
- **Responsive Shell**: `PhoneFrameWrapper` for desktop previewing in a sleek mobile device frame
- **Local Storage**: `shared_preferences`

---

## 🚀 Getting Started

### Prerequisites
- Flutter SDK `^3.5.0`
- Go backend running on `http://localhost:8080` (or configured remote API)

### Run in Development
```bash
# Navigate to parent_app directory
cd parent_app

# Fetch dependencies
flutter pub get

# Run on Chrome with web port 8086
flutter run -d chrome --web-port 8086
```

### Run Tests & Linter
```bash
# Run unit & widget tests
flutter test

# Run Dart analyzer
flutter analyze
```

### Build for Production
```bash
# Compile optimized release Web bundle
flutter build web --base-href /parent/ --release
```
The compiled output in `build/web/` can be served directly or hosted at the `/parent` endpoint of the dispatch server.
