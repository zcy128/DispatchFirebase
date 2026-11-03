# Driver App Unit Testing Guide

[English](TESTING.md) | [Français](TESTING.fr.md) | [中文](TESTING.zh.md)

This project contains a lightweight, high-speed, and zero-external-dependency unit test suite that comprehensively covers core driver mobile application business logic: payroll calculations, safety inspection compliance, network error handling, and offline resilience.

---

## 1. Quick Start

Ensure your working directory is `driver_app`:

```bash
cd driver_app
```

### 1.1 Run All Core Tests (P0 + P1 + P2)
Run all 49+ unit tests in seconds:

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

### 1.2 Run Individual Modules

| Module | Description | Command |
| :--- | :--- | :--- |
| **Timesheet & Payroll** | Hourly rate calculation, divide-by-zero protection, biweekly summary, date grouping | `flutter test test/features/timesheet/timesheet_model_test.dart` |
| **Charter Trips** | Stop time extrapolation, midnight rollovers, round-trip stop normalization | `flutter test test/features/charter/charter_model_test.dart` |
| **Instant Chat** | Channel enums, media message deserialization, contact display name fallbacks | `flutter test test/features/chat/chat_model_test.dart` |
| **Route & Attendance** | Student roster cross-shift deduplication, multi-field fuzzy search | `flutter test test/features/route/route_model_attendance_test.dart` |
| **Network & Auth** | Bearer token injection/clearing, 401/403/500 error mapping | `flutter test test/core/network/api_client_error_handling_test.dart` |
| **Pre-Trip Inspection** | Ontario Reg 199/07 Schedule 5 rating rules (major defects block trip), odometer integrity | `flutter test test/features/pretrip/pretrip_status_rules_test.dart` |
| **Storage & Fallback** | Weak network / offline Base64 fallback, extension-to-MIME deduction | `flutter test test/core/services/storage_service_resilience_test.dart` |
| **Session Security** | Purging sensitive auth tokens on logout while preserving device preferences | `flutter test test/features/auth/session_cleanup_test.dart` |

### 1.3 Code Coverage Report

```bash
flutter test --coverage
# Generate HTML view (requires lcov installed):
# genhtml coverage/lcov.info -o coverage/html
```

---

## 2. Test Architecture & Structure

```text
driver_app/test/
├── core/
│   ├── network/
│   │   └── api_client_error_handling_test.dart  # Auth header interception & HTTP status code mapping
│   └── services/
│       └── storage_service_resilience_test.dart # Offline Base64 fallback & MIME inference
├── features/
│   ├── auth/
│   │   └── session_cleanup_test.dart            # Session storage & sign-out isolation
│   ├── charter/
│   │   └── charter_model_test.dart              # Charter stops, round-trip normalization & time math
│   ├── chat/
│   │   └── chat_model_test.dart                 # Chat channels, messages, and contacts
│   ├── pretrip/
│   │   └── pretrip_status_rules_test.dart       # Ontario Reg 199/07 compliance & defect evaluation
│   ├── route/
│   │   └── route_model_attendance_test.dart     # Student deduplication & roster search
│   └── timesheet/
│       ├── timesheet_model_test.dart            # Biweekly payroll aggregation & division guard
│       └── timesheet_period_test.dart           # Daylight saving time 14-day calendar preservation
```

---

## 3. Best Practices & Guidelines for Writing New Tests

### 3.1 Always Initialize the Flutter Test Binding
If your test touches `SharedPreferences`, file I/O, or platform plugins, start `main()` with:
```dart
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  // ...
}
```
*This prevents `ServicesBinding binding mixin is only available once that binding has been initialized` runtime errors.*

### 3.2 Isolate Network Calls Using `MockClient`
Never make live HTTP calls in unit tests. Use `MockClient` from `package:http/testing.dart`:
```dart
import 'package:http/testing.dart';

final mockClient = MockClient((request) async {
  if (request.url.path.contains('/api/example')) {
    return http.Response('{"status": "ok"}', 200);
  }
  return http.Response('Not Found', 404);
});
```

### 3.3 Reset Local Storage Between Tests
Clear `SharedPreferences` mocks in `setUp` to ensure test independence:
```dart
setUp(() {
  SharedPreferences.setMockInitialValues({});
  AuthenticatedHttpClient.setToken(null);
});
```

### 3.4 Defensive Edge-Case Checklist
- **Division by Zero / Negative Values**: Guard calculations like hourly rates (`payAmount / eiHours`).
- **Time Boundaries**: Test midnight rollovers (`23:45 + 30m`), month-end rollovers, and Daylight Saving Time (DST).
- **Null Safety & Missing JSON Keys**: Ensure `fromMap` / `fromJson` methods safely fall back to reasonable defaults when the backend omits optional fields.
