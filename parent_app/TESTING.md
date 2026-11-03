# Parent App Unit & Widget Testing Guide

[English](TESTING.md) | [Français](TESTING.fr.md) | [中文](TESTING.zh.md)

This project contains a comprehensive, high-speed, and zero-external-dependency unit and widget test suite that covers the complete Parent Bus Tracker mobile & web application: road-snapping algorithms, data model serialization, authentication state machine transitions (BLoC), and full UI presentation flows across live tracking, master timetables, dispatcher messaging, notification settings, and profile management.

---

## 1. Quick Start

Ensure your working directory is `parent_app`:

```bash
cd parent_app
```

### 1.1 Run All Tests
Run all 51 unit and widget tests in seconds:

```bash
flutter test
```

### 1.2 Run Individual Modules (P0, P1, P2)

| Level | Module | Description | Command |
| :---: | :--- | :--- | :--- |
| **P0** | **Map Snapping Engine** | Polyline decoding, Web bitwise safety, Haversine road projection within 45m threshold, road bearing calculations | `flutter test test/map_snapping_engine_test.dart` |
| **P0** | **Models & Serialization** | Safe `fromJson` defaults, `num` to `double` coordinates, nested `VehicleLiveLocation`, roundtrip serialization | `flutter test test/models_test.dart` |
| **P0** | **Authentication BLoC** | `AuthInitialState`, session check, OTP flow, state transitions, account registration, error handling, logout | `flutter test test/auth_bloc_test.dart` |
| **P1** | **ETA Countdown Card** | `EN_ROUTE` countdown display, `APPROACHING` alerts, `DROPPED_OFF` safe arrival, quick action callbacks | `flutter test test/eta_card_widget_test.dart` |
| **P1** | **Login Screen** | Empty input validation, Demo Phone/Email autofill, zero-friction banner, loading button disabled states | `flutter test test/login_screen_test.dart` |
| **P1** | **Passcode / OTP Screen** | Matched student count badge, 6-digit passcode submission, length validation snackbars, devcode autofill | `flutter test test/otp_screen_test.dart` |
| **P1** | **Schedule & Timetables** | AM/PM/Friday shift filter chips, weekday matrix, multi-student switcher, absence trigger | `flutter test test/schedule_screen_test.dart` |
| **P1** | **Bus Map Polyline** | Decodes route polyline and mounts `RoadPolylineLayer` without route code clutter | `flutter test test/bus_map_test.dart` |
| **P2** | **Dispatcher Contact Hub** | Dual tabs (`Live Chat` & `Call / SMS`), hotline numbers `(613) 555-0100`, SMS hotline `(613) 555-0188` | `flutter test test/dispatcher_contact_sheet_test.dart` |
| **P2** | **Notification Alerts** | Approaching distance slider (3-15 min), push/SMS/email toggle switches, saving preferences | `flutter test test/notification_settings_sheet_test.dart` |
| **P2** | **Profile Management** | Profile pre-population, name/phone/email/address updates, form validation | `flutter test test/edit_profile_sheet_test.dart` |
| **App** | **App Shell & Entrypoint** | Root `ParentApp` mounting and initial route layout | `flutter test test/widget_test.dart` |

### 1.3 Static Analysis
Ensure zero warnings and clean code quality:

```bash
flutter analyze
```

---

## 2. Test Architecture & Structure

```text
parent_app/test/
├── auth_bloc_test.dart                 # [P0] AuthBloc state machine & MockApiClient
├── bus_map_test.dart                   # [P1] BusMapWidget polyline decoding & map layer
├── dispatcher_contact_sheet_test.dart  # [P2] DispatcherContactSheet (Live Chat & Hotline)
├── edit_profile_sheet_test.dart        # [P2] EditProfileSheet (Profile update & validation)
├── eta_card_widget_test.dart           # [P1] EtaCardWidget (Bento countdown & actions)
├── login_screen_test.dart              # [P1] LoginScreen (Form validation & Demo autofill)
├── map_snapping_engine_test.dart       # [P0] MapSnappingEngine (Snapping & bearing math)
├── models_test.dart                    # [P0] Models serialization & null tolerance
├── notification_settings_sheet_test.dart # [P2] NotificationSettingsSheet (Alerts & channels)
├── otp_screen_test.dart                # [P1] OtpScreen (Passcode verification)
├── schedule_screen_test.dart           # [P1] ScheduleScreen (Timetables & filters)
└── widget_test.dart                    # [Core] ParentApp entrypoint
```
