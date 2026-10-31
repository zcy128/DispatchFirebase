class DriverSession {
  final String username;
  final String displayName;
  final String role;
  final String employeeId;
  final String token;
  final Map<String, dynamic>? overrides;

  const DriverSession({
    required this.username,
    required this.displayName,
    required this.role,
    required this.employeeId,
    required this.token,
    this.overrides,
  });
}

class LoginResolution {
  final DriverSession? session;
  final String? errorMessage;

  const LoginResolution.success(this.session) : errorMessage = null;

  const LoginResolution.failure(this.errorMessage) : session = null;

  bool get isSuccess => session != null;
}

/// Decides whether a login response may open the driver app.
///
/// The published demo account can still enter when the app is in demo mode,
/// even if the sign-in service is unreachable. Every other account needs a
/// successful response that includes an employee ID.
class LoginResolver {
  static const String demoPassword = 'Dispatch2026!';
  static const String demoEmployeeId = 'EMP-2001';
  static const Set<String> demoUsernames = {
    'driver1d',
    'driver1',
    'drv-1021',
  };

  static bool isDemoCredentials(String username, String password) {
    return demoUsernames.contains(username.trim().toLowerCase()) &&
        password == demoPassword;
  }

  static LoginResolution resolve({
    required bool allowDemoFallback,
    required String username,
    required String password,
    required String selectedRole,
    int? statusCode,
    Map<String, dynamic>? body,
    bool transportFailed = false,
  }) {
    final trimmedUser = username.trim();
    final demo = allowDemoFallback && isDemoCredentials(trimmedUser, password);

    if (!transportFailed && statusCode == 200 && body != null) {
      final user = body['user'];
      if (body['success'] != false && user is Map) {
        final userMap = Map<String, dynamic>.from(user);
        final serverEmployeeId = userMap['employeeId']?.toString().trim() ?? '';
        final serverRole = userMap['role']?.toString().trim() ?? '';
        final serverName = userMap['fullName']?.toString().trim() ?? '';
        final serverUsername = userMap['username']?.toString().trim() ?? '';
        final token = body['token']?.toString() ?? '';
        final overrides = _readOverrides(userMap['overrides']);

        if (serverEmployeeId.isEmpty && !demo) {
          return const LoginResolution.failure(
            'This account has no employee ID. Contact dispatch before signing in.',
          );
        }

        return LoginResolution.success(
          DriverSession(
            username: serverUsername.isNotEmpty ? serverUsername : trimmedUser,
            displayName: serverName.isNotEmpty
                ? serverName
                : (serverUsername.isNotEmpty ? serverUsername : trimmedUser),
            role: demo
                ? selectedRole
                : (serverRole.isNotEmpty ? serverRole : selectedRole),
            employeeId: serverEmployeeId.isNotEmpty ? serverEmployeeId : demoEmployeeId,
            token: token,
            overrides: overrides,
          ),
        );
      }
    }

    // Offline demo fallback is ONLY permitted when the sign-in service could not be reached (transportFailed == true).
    // If the server was reached and actively rejected the login (e.g. 403 Deactivated, 401 Invalid Credentials),
    // demo fallback MUST NOT bypass the server's rejection.
    if (demo && transportFailed) {
      return LoginResolution.success(
        DriverSession(
          username: trimmedUser,
          displayName: 'David Miller',
          role: selectedRole,
          employeeId: demoEmployeeId,
          token: 'mock-token-driver1d',
        ),
      );
    }

    return LoginResolution.failure(
      _failureMessage(
        statusCode: statusCode,
        body: body,
        transportFailed: transportFailed,
      ),
    );
  }

  static Map<String, dynamic>? _readOverrides(dynamic raw) {
    if (raw is! Map || raw.isEmpty) return null;
    return Map<String, dynamic>.from(raw);
  }

  static String _failureMessage({
    required int? statusCode,
    required Map<String, dynamic>? body,
    required bool transportFailed,
  }) {
    if (transportFailed) {
      return 'Cannot reach the sign-in service. Check your connection and try again.';
    }
    final raw = body?['error']?.toString().trim() ?? '';
    if (raw.isNotEmpty) {
      return _friendlyError(raw);
    }
    switch (statusCode) {
      case 401:
        return 'Invalid username or password.';
      case 403:
        return 'This account is deactivated. Contact dispatch.';
      default:
        return 'Sign-in failed. Try again.';
    }
  }

  static String _friendlyError(String raw) {
    final lower = raw.toLowerCase();
    if (lower.contains('invalid username') ||
        lower.contains('invalid login') ||
        lower.contains('not found') ||
        lower.contains('authentication failed')) {
      return 'Invalid username or password.';
    }
    if (lower.contains('deactivated')) {
      return 'This account is deactivated. Contact dispatch.';
    }
    if (lower.contains('required')) {
      return 'Enter your staff ID and password.';
    }
    return raw;
  }
}
