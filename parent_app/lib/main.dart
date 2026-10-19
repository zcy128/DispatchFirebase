import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'core/api_client.dart';
import 'core/theme.dart';
import 'core/widgets/phone_frame_wrapper.dart';
import 'features/auth/bloc/auth_bloc.dart';
import 'features/auth/presentation/login_screen.dart';
import 'features/auth/presentation/otp_screen.dart';
import 'features/tracking/presentation/tracking_home_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final apiClient = ApiClient();
  await apiClient.init();

  runApp(ParentApp(apiClient: apiClient));
}

class AppScrollBehavior extends MaterialScrollBehavior {
  @override
  Set<PointerDeviceKind> get dragDevices => {
        PointerDeviceKind.touch,
        PointerDeviceKind.mouse,
        PointerDeviceKind.stylus,
        PointerDeviceKind.trackpad,
      };
}

class ParentApp extends StatelessWidget {
  final ApiClient apiClient;

  const ParentApp({super.key, required this.apiClient});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<AuthBloc>(
      create: (context) => AuthBloc(apiClient)..add(CheckAuthStatusEvent()),
      child: MaterialApp(
        title: 'PCY Bus Tracker',
        theme: AppTheme.lightTheme,
        scrollBehavior: AppScrollBehavior(),
        debugShowCheckedModeBanner: false,
        builder: (context, child) {
          return PhoneFrameWrapper(child: child ?? const SizedBox.shrink());
        },
        home: BlocConsumer<AuthBloc, AuthState>(
          listener: (context, state) {
            if (state is AuthErrorState) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(state.message),
                  backgroundColor: AppColors.error,
                  behavior: SnackBarBehavior.floating,
                ),
              );
            }
          },
          builder: (context, state) {
            if (state is AuthLoadingState && state.message != null) {
              return Scaffold(
                body: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const CircularProgressIndicator(color: AppColors.primary),
                      const SizedBox(height: 16),
                      Text(
                        state.message!,
                        style: const TextStyle(fontSize: 14, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
              );
            }

            if (state is OtpSentState) {
              return OtpScreen(
                contact: state.contact,
                devCode: state.devCode,
                matchedCount: state.matchedCount,
              );
            }

            if (state is AuthenticatedState) {
              return TrackingHomeScreen(
                apiClient: apiClient,
                students: state.students,
                contact: state.contact,
                user: state.user,
              );
            }

            return const LoginScreen();
          },
        ),
      ),
    );
  }
}
