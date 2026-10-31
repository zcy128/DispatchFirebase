import 'package:driver_app/features/auth/driver_session.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const serverUser = {
    'success': true,
    'token': 'token-from-server',
    'user': {
      'username': 'driver1d',
      'fullName': 'David Miller',
      'role': 'driver',
      'employeeId': 'EMP-2001',
      'overrides': {'timesheet': 'view'},
    },
  };

  test('demo credentials succeed from the server profile', () {
    final result = LoginResolver.resolve(
      allowDemoFallback: true,
      username: 'driver1d',
      password: LoginResolver.demoPassword,
      selectedRole: 'Monitor',
      statusCode: 200,
      body: serverUser,
    );

    expect(result.isSuccess, isTrue);
    expect(result.session!.employeeId, 'EMP-2001');
    expect(result.session!.displayName, 'David Miller');
    expect(result.session!.role, 'Monitor');
    expect(result.session!.token, 'token-from-server');
  });

  test('demo credentials still enter when the sign-in service is down', () {
    final result = LoginResolver.resolve(
      allowDemoFallback: true,
      username: ' driver1d ',
      password: LoginResolver.demoPassword,
      selectedRole: 'Driver',
      transportFailed: true,
    );

    expect(result.isSuccess, isTrue);
    expect(result.session!.employeeId, 'EMP-2001');
    expect(result.session!.displayName, 'David Miller');
    expect(result.session!.token, 'mock-token-driver1d');
  });

  test('demo credentials are rejected when account is deactivated on server (HTTP 403)', () {
    final result = LoginResolver.resolve(
      allowDemoFallback: true,
      username: 'driver1d',
      password: LoginResolver.demoPassword,
      selectedRole: 'Driver',
      statusCode: 403,
      body: const {'error': 'employee account is deactivated'},
    );

    expect(result.isSuccess, isFalse);
    expect(result.errorMessage, 'This account is deactivated. Contact dispatch.');
  });

  test('demo credentials are rejected when server returns HTTP 401', () {
    final result = LoginResolver.resolve(
      allowDemoFallback: true,
      username: 'driver1d',
      password: LoginResolver.demoPassword,
      selectedRole: 'Driver',
      statusCode: 401,
      body: const {'error': 'invalid login credentials'},
    );

    expect(result.isSuccess, isFalse);
    expect(result.errorMessage, 'Invalid username or password.');
  });

  test('a wrong demo password stays on the login page', () {
    final result = LoginResolver.resolve(
      allowDemoFallback: true,
      username: 'driver1d',
      password: 'wrong-password',
      selectedRole: 'Fleet',
      statusCode: 401,
      body: const {'error': 'invalid username or password'},
    );

    expect(result.isSuccess, isFalse);
    expect(result.errorMessage, 'Invalid username or password.');
  });

  test('production mode does not accept the offline demo account', () {
    final result = LoginResolver.resolve(
      allowDemoFallback: false,
      username: 'driver1d',
      password: LoginResolver.demoPassword,
      selectedRole: 'Driver',
      transportFailed: true,
    );

    expect(result.isSuccess, isFalse);
    expect(result.errorMessage, contains('Cannot reach'));
  });

  test('a real account uses the server employee id and role', () {
    final result = LoginResolver.resolve(
      allowDemoFallback: true,
      username: 'alexm',
      password: 'real-password',
      selectedRole: 'Fleet',
      statusCode: 200,
      body: const {
        'success': true,
        'token': 'real-token',
        'user': {
          'username': 'alexm',
          'fullName': 'Alex Morgan',
          'role': 'driver',
          'employeeId': 'EMP-214',
        },
      },
    );

    expect(result.session!.employeeId, 'EMP-214');
    expect(result.session!.displayName, 'Alex Morgan');
    expect(result.session!.role, 'driver');
  });

  test('a real account without an employee id is rejected', () {
    final result = LoginResolver.resolve(
      allowDemoFallback: true,
      username: 'alexm',
      password: 'real-password',
      selectedRole: 'Driver',
      statusCode: 200,
      body: const {
        'success': true,
        'user': {
          'fullName': 'Alex Morgan',
          'role': 'driver',
        },
      },
    );

    expect(result.isSuccess, isFalse);
    expect(result.errorMessage, contains('employee ID'));
  });
}
