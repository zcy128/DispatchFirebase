# Driver App

Premier Bus Dispatch & Route Management Driver Application (Flutter).

[English](README.md) | [Français](README.fr.md) | [中文](README.zh.md)

---

## 🚀 Getting Started

1. **Install dependencies**:
   ```bash
   flutter pub get
   ```

2. **Run application**:
   ```bash
   # Demo mode (default)
   flutter run -d chrome
   
   # Or specify production mode
   flutter run --dart-define=APP_MODE=production
   ```

---

## 🧪 Unit Testing Instructions

This project provides a **lightweight, high-speed, zero-external-dependency** automated unit testing suite, covering core business computations, payroll timesheets, pre-trip compliance ratings, network auth interceptions, and offline resilience.

### 1. Run All Core Unit Tests
Execute inside the `driver_app` directory:

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

> **Execution Performance**: All 49+ core test cases finish in approximately **5~6 seconds** via pure in-memory execution, requiring zero network connection or live Firebase access.

### 2. Module-Specific Test Commands

- **Timesheet & Payroll Calculations**:
  ```bash
  flutter test test/features/timesheet/timesheet_model_test.dart
  ```
- **Charter Trips & Route Stops Estimation**:
  ```bash
  flutter test test/features/charter/charter_model_test.dart
  ```
- **Instant Chat & Channel Parsing**:
  ```bash
  flutter test test/features/chat/chat_model_test.dart
  ```
- **Route Student Attendance Rosters & Search**:
  ```bash
  flutter test test/features/route/route_model_attendance_test.dart
  ```
- **Network Layer Exception & Auth Interception**:
  ```bash
  flutter test test/core/network/api_client_error_handling_test.dart
  ```
- **Ontario Pre-trip Daily Inspection (Schedule 5 Compliance)**:
  ```bash
  flutter test test/features/pretrip/pretrip_status_rules_test.dart
  ```
- **Offline / Weak-Network Base64 Fallback**:
  ```bash
  flutter test test/core/services/storage_service_resilience_test.dart
  ```
- **Sign-out Sensitive Data Purge & Preference Isolation**:
  ```bash
  flutter test test/features/auth/session_cleanup_test.dart
  ```

For detailed architecture diagrams, mock guidelines, and testing pitfalls, see: 👉 **[TESTING.md](./TESTING.md)** (also available in [Français](./TESTING.fr.md) and [中文](./TESTING.zh.md)).
