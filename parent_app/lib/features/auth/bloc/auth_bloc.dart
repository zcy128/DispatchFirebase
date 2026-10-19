import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/api_client.dart';
import '../../../core/models.dart';

// Events
abstract class AuthEvent {}

class CheckAuthStatusEvent extends AuthEvent {}

class RequestOtpEvent extends AuthEvent {
  final String contact;
  RequestOtpEvent(this.contact);
}

class VerifyOtpEvent extends AuthEvent {
  final String contact;
  final String code;
  VerifyOtpEvent(this.contact, this.code);
}

class RegisterAccountEvent extends AuthEvent {
  final String password;
  final String name;
  RegisterAccountEvent(this.password, this.name);
}

class RefreshCommutesEvent extends AuthEvent {}

class LogoutEvent extends AuthEvent {}

// States
abstract class AuthState {}

class AuthInitialState extends AuthState {}

class AuthLoadingState extends AuthState {
  final String? message;
  AuthLoadingState({this.message});
}

class OtpSentState extends AuthState {
  final String contact;
  final String? devCode;
  final int matchedCount;
  OtpSentState({
    required this.contact,
    this.devCode,
    required this.matchedCount,
  });
}

class AuthenticatedState extends AuthState {
  final ParentUser? user;
  final List<ParentStudentCommute> students;
  final String contact;
  final bool justLoggedIn;

  AuthenticatedState({
    this.user,
    required this.students,
    required this.contact,
    this.justLoggedIn = false,
  });

  AuthenticatedState copyWith({
    ParentUser? user,
    List<ParentStudentCommute>? students,
    String? contact,
    bool? justLoggedIn,
  }) {
    return AuthenticatedState(
      user: user ?? this.user,
      students: students ?? this.students,
      contact: contact ?? this.contact,
      justLoggedIn: justLoggedIn ?? this.justLoggedIn,
    );
  }
}

class AuthErrorState extends AuthState {
  final String message;
  AuthErrorState(this.message);
}

// BLoC
class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final ApiClient apiClient;

  AuthBloc(this.apiClient) : super(AuthInitialState()) {
    on<CheckAuthStatusEvent>(_onCheckAuthStatus);
    on<RequestOtpEvent>(_onRequestOtp);
    on<VerifyOtpEvent>(_onVerifyOtp);
    on<RegisterAccountEvent>(_onRegisterAccount);
    on<RefreshCommutesEvent>(_onRefreshCommutes);
    on<LogoutEvent>(_onLogout);
  }

  Future<void> _onCheckAuthStatus(CheckAuthStatusEvent event, Emitter<AuthState> emit) async {
    await apiClient.init();
    final contact = apiClient.savedContact;
    if (apiClient.sessionToken != null && contact != null && contact.isNotEmpty) {
      try {
        emit(AuthLoadingState(message: 'Loading your students...'));
        final students = await apiClient.fetchStudents(contact);
        emit(AuthenticatedState(
          students: students,
          contact: contact,
        ));
      } catch (e) {
        // Token expired or invalid, reset to initial
        await apiClient.clearSession();
        emit(AuthInitialState());
      }
    } else {
      emit(AuthInitialState());
    }
  }

  Future<void> _onRequestOtp(RequestOtpEvent event, Emitter<AuthState> emit) async {
    emit(AuthLoadingState(message: 'Checking student directory & sending code...'));
    try {
      final res = await apiClient.requestOtp(event.contact);
      emit(OtpSentState(
        contact: event.contact,
        devCode: res['devCode'] as String?,
        matchedCount: res['matchedStudentsCount'] as int? ?? 1,
      ));
    } catch (e) {
      emit(AuthErrorState(e.toString().replaceAll('Exception: ', '')));
    }
  }

  Future<void> _onVerifyOtp(VerifyOtpEvent event, Emitter<AuthState> emit) async {
    emit(AuthLoadingState(message: 'Verifying passcode...'));
    try {
      final res = await apiClient.verifyOtp(event.contact, event.code);
      final rawStudents = (res['students'] as List<dynamic>?) ?? [];
      final students = rawStudents.map((e) => ParentStudentCommute.fromJson(e as Map<String, dynamic>)).toList();
      ParentUser? user;
      if (res['parentUser'] != null) {
        user = ParentUser.fromJson(res['parentUser'] as Map<String, dynamic>);
      }
      emit(AuthenticatedState(
        user: user,
        students: students,
        contact: event.contact,
        justLoggedIn: true,
      ));
    } catch (e) {
      emit(AuthErrorState(e.toString().replaceAll('Exception: ', '')));
    }
  }

  Future<void> _onRegisterAccount(RegisterAccountEvent event, Emitter<AuthState> emit) async {
    final currState = state;
    if (currState is! AuthenticatedState) return;

    emit(AuthLoadingState(message: 'Creating permanent account...'));
    try {
      final res = await apiClient.register(currState.contact, event.password, event.name);
      ParentUser? user;
      if (res['parentUser'] != null) {
        user = ParentUser.fromJson(res['parentUser'] as Map<String, dynamic>);
      }
      emit(currState.copyWith(user: user, justLoggedIn: false));
    } catch (e) {
      emit(AuthErrorState(e.toString().replaceAll('Exception: ', '')));
    }
  }

  Future<void> _onRefreshCommutes(RefreshCommutesEvent event, Emitter<AuthState> emit) async {
    final currState = state;
    if (currState is! AuthenticatedState) return;
    try {
      final students = await apiClient.fetchStudents(currState.contact);
      emit(currState.copyWith(students: students));
    } catch (_) {}
  }

  Future<void> _onLogout(LogoutEvent event, Emitter<AuthState> emit) async {
    await apiClient.clearSession();
    emit(AuthInitialState());
  }
}
