# Project Rules & Guidelines

## 1. Language & Coding Standards (No Chinese in Code)
- **Identifiers & File Names**: All variable names, function names, class names, types, interfaces, constants, file names, and directories MUST be in English only.
- **Code Comments & Documentation**: All inline comments, function docstrings, JSDoc/DartDoc/GoDoc, and TODO notes MUST be written in English.
- **Error Messages & Logging**: All exception messages, error codes, and console logging statements MUST be in English.
- **User-Facing Strings & i18n**: Never hardcode Chinese strings directly in business logic or presentation components. User-facing text must either use English by default or be managed through the project's dedicated localization/i18n translation system.
- **Chat Communication vs. Code**: You may communicate with the user in Chinese (or their preferred language) during chat, but all generated/modified code, diffs, and comments MUST strictly remain 100% English.

## 2. Core Quality & Operational Safety
- **Financial & Wage Precision**: Always round monetary totals, rates, and wage sums to 2 decimal places using half-up rounding to prevent floating-point accumulation drift.
- **Commercial Vehicle Compliance**: Never bypass safety inspection gates or out-of-service quarantine locks for fleet vehicles or drivers.
- **Security & Secrets**: Never write or commit real private keys, `serviceAccountKey.json`, `firebase_options.dart`, or `.env` secrets into the codebase.
- **Testing Discipline**: Run relevant unit tests (`npm test` in `web`, `flutter test` in `driver_app` and `parent_app`) after modifying core logic. Refer to `docs/testing-guide.md` for test suite instructions.
