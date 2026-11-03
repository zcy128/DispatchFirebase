import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/core/api_client.dart';
import 'package:parent_app/core/models.dart';
import 'package:parent_app/features/auth/bloc/auth_bloc.dart';

class MockApiClient extends ApiClient {
  String? mockToken;
  String? mockContact;
  bool shouldFailRequestOtp = false;
  bool shouldFailVerifyOtp = false;
  bool shouldFailFetchStudents = false;
  bool shouldFailRegister = false;
  List<ParentStudentCommute> mockStudents = [];
  Map<String, dynamic>? mockOtpResponse;
  Map<String, dynamic>? mockVerifyResponse;
  Map<String, dynamic>? mockRegisterResponse;
  bool clearSessionCalled = false;

  @override
  String? get sessionToken => mockToken;

  @override
  String? get savedContact => mockContact;

  @override
  Future<void> init() async {}

  @override
  Future<void> saveSession(String token, String contact) async {
    mockToken = token;
    mockContact = contact;
  }

  @override
  Future<void> clearSession() async {
    clearSessionCalled = true;
    mockToken = null;
    mockContact = null;
  }

  @override
  Future<Map<String, dynamic>> requestOtp(String contact) async {
    if (shouldFailRequestOtp) {
      throw Exception('Network timeout requesting passcode');
    }
    return mockOtpResponse ?? {
      'success': true,
      'devCode': '123456',
      'matchedStudentsCount': 2,
    };
  }

  @override
  Future<Map<String, dynamic>> verifyOtp(String contact, String code) async {
    if (shouldFailVerifyOtp) {
      throw Exception('Invalid verification passcode');
    }
    return mockVerifyResponse ?? {
      'success': true,
      'token': 'tok_xyz123',
      'students': [
        {
          'studentId': 101,
          'studentName': 'Emma Watson',
          'grade': 'Grade 2',
          'schoolName': 'Broadview Public School',
          'status': 'EN_ROUTE',
        }
      ],
      'parentUser': {
        'id': 'p_101',
        'displayName': 'David Watson',
        'contactValue': contact,
        'isRegistered': false,
      }
    };
  }

  @override
  Future<List<ParentStudentCommute>> fetchStudents(String contact) async {
    if (shouldFailFetchStudents) {
      throw Exception('Session token expired');
    }
    return mockStudents;
  }

  @override
  Future<Map<String, dynamic>> register(String contact, String password, String name) async {
    if (shouldFailRegister) {
      throw Exception('Registration failed');
    }
    return mockRegisterResponse ?? {
      'success': true,
      'token': 'tok_reg123',
      'parentUser': {
        'id': 'p_101',
        'displayName': name,
        'contactValue': contact,
        'isRegistered': true,
      }
    };
  }

  ParentNotificationConfig mockPreferences = ParentNotificationConfig();
  bool savePreferencesCalled = false;

  @override
  Future<ParentNotificationConfig> fetchPreferences() async {
    return mockPreferences;
  }

  @override
  Future<void> savePreferences(ParentNotificationConfig config) async {
    savePreferencesCalled = true;
    mockPreferences = config;
  }

  ParentUser? mockProfileUser;
  bool updateProfileCalled = false;

  @override
  Future<ParentUser> fetchProfile(String contact) async {
    return mockProfileUser ??
        ParentUser(
          id: 'p_101',
          contactType: 'phone',
          contactValue: contact,
          displayName: 'David Watson',
          phone: '613-555-0100',
          email: 'david@example.com',
          homeAddress: '123 Richmond Rd, Ottawa',
          isRegistered: true,
          linkedStudentIds: ['101'],
        );
  }

  @override
  Future<ParentUser> updateProfile({
    required String contact,
    required String displayName,
    required String phone,
    required String email,
    required String homeAddress,
  }) async {
    updateProfileCalled = true;
    return ParentUser(
      id: 'p_101',
      contactType: 'phone',
      contactValue: contact,
      displayName: displayName,
      phone: phone,
      email: email,
      homeAddress: homeAddress,
      isRegistered: true,
      linkedStudentIds: ['101'],
    );
  }
}

void main() {
  group('AuthBloc', () {
    late MockApiClient mockApiClient;
    late AuthBloc authBloc;

    setUp(() {
      mockApiClient = MockApiClient();
      authBloc = AuthBloc(mockApiClient);
    });

    tearDown(() {
      authBloc.close();
    });

    test('initial state is AuthInitialState', () {
      expect(authBloc.state, isA<AuthInitialState>());
    });

    group('CheckAuthStatusEvent', () {
      test('emits [AuthInitialState] when no saved session exists', () async {
        mockApiClient.mockToken = null;
        mockApiClient.mockContact = null;

        final expectedStates = [
          isA<AuthInitialState>(),
        ];

        expectLater(authBloc.stream, emitsInOrder(expectedStates));
        authBloc.add(CheckAuthStatusEvent());
      });

      test('emits [AuthLoadingState, AuthenticatedState] when valid session exists', () async {
        mockApiClient.mockToken = 'valid_token';
        mockApiClient.mockContact = '613-555-0100';
        mockApiClient.mockStudents = [
          ParentStudentCommute.fromJson({'studentId': 101, 'studentName': 'Emma Watson'}),
        ];

        final expectedStates = [
          predicate<AuthState>((s) => s is AuthLoadingState && s.message == 'Loading your students...'),
          predicate<AuthState>((s) => s is AuthenticatedState && s.contact == '613-555-0100' && s.students.length == 1),
        ];

        expectLater(authBloc.stream, emitsInOrder(expectedStates));
        authBloc.add(CheckAuthStatusEvent());
      });

      test('clears session and emits [AuthLoadingState, AuthInitialState] on fetch failure', () async {
        mockApiClient.mockToken = 'expired_token';
        mockApiClient.mockContact = '613-555-0100';
        mockApiClient.shouldFailFetchStudents = true;

        final expectedStates = [
          isA<AuthLoadingState>(),
          isA<AuthInitialState>(),
        ];

        expectLater(authBloc.stream, emitsInOrder(expectedStates));
        authBloc.add(CheckAuthStatusEvent());

        await untilCalled(() => mockApiClient.clearSessionCalled);
        expect(mockApiClient.clearSessionCalled, isTrue);
      });
    });

    group('RequestOtpEvent', () {
      test('emits [AuthLoadingState, OtpSentState] on success', () async {
        final expectedStates = [
          predicate<AuthState>((s) => s is AuthLoadingState),
          predicate<AuthState>((s) => s is OtpSentState && s.contact == '613-555-0100' && s.devCode == '123456' && s.matchedCount == 2),
        ];

        expectLater(authBloc.stream, emitsInOrder(expectedStates));
        authBloc.add(RequestOtpEvent('613-555-0100'));
      });

      test('emits [AuthLoadingState, AuthErrorState] on failure', () async {
        mockApiClient.shouldFailRequestOtp = true;

        final expectedStates = [
          isA<AuthLoadingState>(),
          predicate<AuthState>((s) => s is AuthErrorState && s.message.contains('Network timeout requesting passcode')),
        ];

        expectLater(authBloc.stream, emitsInOrder(expectedStates));
        authBloc.add(RequestOtpEvent('613-555-0100'));
      });
    });

    group('VerifyOtpEvent', () {
      test('emits [AuthLoadingState, AuthenticatedState] on valid passcode', () async {
        final expectedStates = [
          predicate<AuthState>((s) => s is AuthLoadingState),
          predicate<AuthState>((s) =>
              s is AuthenticatedState &&
              s.contact == '613-555-0100' &&
              s.justLoggedIn == true &&
              s.students.length == 1 &&
              s.user?.displayName == 'David Watson'),
        ];

        expectLater(authBloc.stream, emitsInOrder(expectedStates));
        authBloc.add(VerifyOtpEvent('613-555-0100', '123456'));
      });

      test('emits [AuthLoadingState, AuthErrorState] on invalid passcode', () async {
        mockApiClient.shouldFailVerifyOtp = true;

        final expectedStates = [
          isA<AuthLoadingState>(),
          predicate<AuthState>((s) => s is AuthErrorState && s.message.contains('Invalid verification passcode')),
        ];

        expectLater(authBloc.stream, emitsInOrder(expectedStates));
        authBloc.add(VerifyOtpEvent('613-555-0100', '000000'));
      });
    });

    group('RegisterAccountEvent', () {
      test('does nothing if current state is not AuthenticatedState', () async {
        // Current state is AuthInitialState
        authBloc.add(RegisterAccountEvent('pass123', 'David'));
        await Future.delayed(const Duration(milliseconds: 50));
        expect(authBloc.state, isA<AuthInitialState>());
      });

      test('emits [AuthLoadingState, AuthenticatedState] with updated registered user', () async {
        // First get into AuthenticatedState
        authBloc.add(VerifyOtpEvent('613-555-0100', '123456'));
        await expectLater(
          authBloc.stream,
          emitsThrough(predicate<AuthState>((s) => s is AuthenticatedState)),
        );

        // Now register
        final expectedRegisterStates = [
          isA<AuthLoadingState>(),
          predicate<AuthState>((s) =>
              s is AuthenticatedState &&
              s.user?.displayName == 'David Watson' &&
              s.user?.isRegistered == true &&
              s.justLoggedIn == false),
        ];

        expectLater(authBloc.stream, emitsInOrder(expectedRegisterStates));
        authBloc.add(RegisterAccountEvent('Secr3t!P@ss', 'David Watson'));
      });
    });

    group('RefreshCommutesEvent', () {
      test('refreshes student commutes when authenticated', () async {
        // Authenticate first
        authBloc.add(VerifyOtpEvent('613-555-0100', '123456'));
        await expectLater(
          authBloc.stream,
          emitsThrough(predicate<AuthState>((s) => s is AuthenticatedState)),
        );

        // Update mock data for refresh
        mockApiClient.mockStudents = [
          ParentStudentCommute.fromJson({'studentId': 101, 'studentName': 'Emma Watson Updated'}),
          ParentStudentCommute.fromJson({'studentId': 102, 'studentName': 'Lucas Watson'}),
        ];

        final expectedRefreshState = predicate<AuthState>((s) =>
            s is AuthenticatedState && s.students.length == 2 && s.students[0].studentName == 'Emma Watson Updated');

        expectLater(authBloc.stream, emits(expectedRefreshState));
        authBloc.add(RefreshCommutesEvent());
      });
    });

    group('LogoutEvent', () {
      test('clears session and emits [AuthInitialState]', () async {
        // Authenticate first
        authBloc.add(VerifyOtpEvent('613-555-0100', '123456'));
        await expectLater(
          authBloc.stream,
          emitsThrough(predicate<AuthState>((s) => s is AuthenticatedState)),
        );

        expectLater(authBloc.stream, emits(isA<AuthInitialState>()));
        authBloc.add(LogoutEvent());

        await Future.delayed(const Duration(milliseconds: 50));
        expect(mockApiClient.clearSessionCalled, isTrue);
      });
    });
  });
}

// Helper to wait until a condition is met
Future<void> untilCalled(bool Function() condition, {Duration timeout = const Duration(seconds: 2)}) async {
  final start = DateTime.now();
  while (!condition()) {
    if (DateTime.now().difference(start) > timeout) {
      throw Exception('Condition not met within $timeout');
    }
    await Future.delayed(const Duration(milliseconds: 20));
  }
}
