import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'core/theme.dart';
import 'features/auth/login_page.dart';
import 'features/dispatch/repository/dispatch_repository.dart';
import 'features/forms/repository/time_off_repository.dart';
import 'features/pretrip/repository/pretrip_repository.dart';
import 'features/defect/repository/defect_repository.dart';
import 'features/student_incident/repository/student_incident_repository.dart';
import 'features/expense_reimbursement/repository/expense_reimbursement_repository.dart';
import 'features/hazard_report/repository/hazard_report_repository.dart';
import 'features/route_assessment/repository/route_assessment_repository.dart';
import 'features/vehicle_signout/repository/vehicle_signout_repository.dart';
import 'features/route/repository/route_repository.dart';
import 'features/chat/repository/chat_repository.dart';
import 'features/charter/repository/charter_repository.dart';
import 'firebase_options.dart';

final GlobalKey<ScaffoldMessengerState> rootScaffoldMessengerKey = GlobalKey<ScaffoldMessengerState>();
final GlobalKey<NavigatorState> rootNavigatorKey = GlobalKey<NavigatorState>();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Hive.initFlutter();

  try {
    if (Firebase.apps.isEmpty) {
      await Firebase.initializeApp(
        options: DefaultFirebaseOptions.currentPlatform,
      );
    }
  } catch (e) {
    debugPrint('Firebase initialization notice: $e');
  }
  
  final dispatchRepository = DispatchRepository();
  await dispatchRepository.init();

  final routeRepository = RouteRepository();
  await routeRepository.init();

  final timeOffRepository = TimeOffRepository();
  await timeOffRepository.init();

  final preTripRepository = PreTripRepository();
  await preTripRepository.init();

  final defectRepository = DefectRepository();
  await defectRepository.init();

  final studentIncidentRepository = StudentIncidentRepository();
  await studentIncidentRepository.init();

  final expenseReimbursementRepository = ExpenseReimbursementRepository();
  await expenseReimbursementRepository.init();

  final hazardReportRepository = HazardReportRepository();
  await hazardReportRepository.init();

  final routeAssessmentRepository = RouteAssessmentRepository();
  await routeAssessmentRepository.init();

  final vehicleSignoutRepository = VehicleSignoutRepository();
  await vehicleSignoutRepository.init();

  final chatRepository = ChatRepository();
  final charterRepository = CharterRepository();

  runApp(DriverApp(
    dispatchRepository: dispatchRepository,
    routeRepository: routeRepository,
    timeOffRepository: timeOffRepository,
    preTripRepository: preTripRepository,
    defectRepository: defectRepository,
    studentIncidentRepository: studentIncidentRepository,
    expenseReimbursementRepository: expenseReimbursementRepository,
    hazardReportRepository: hazardReportRepository,
    routeAssessmentRepository: routeAssessmentRepository,
    vehicleSignoutRepository: vehicleSignoutRepository,
    chatRepository: chatRepository,
    charterRepository: charterRepository,
  ));
}

class DriverApp extends StatelessWidget {
  final DispatchRepository? dispatchRepository;
  final RouteRepository? routeRepository;
  final TimeOffRepository? timeOffRepository;
  final PreTripRepository? preTripRepository;
  final DefectRepository? defectRepository;
  final StudentIncidentRepository? studentIncidentRepository;
  final ExpenseReimbursementRepository? expenseReimbursementRepository;
  final HazardReportRepository? hazardReportRepository;
  final RouteAssessmentRepository? routeAssessmentRepository;
  final VehicleSignoutRepository? vehicleSignoutRepository;
  final ChatRepository? chatRepository;
  final CharterRepository? charterRepository;

  const DriverApp({
    super.key,
    this.dispatchRepository,
    this.routeRepository,
    this.timeOffRepository,
    this.preTripRepository,
    this.defectRepository,
    this.studentIncidentRepository,
    this.expenseReimbursementRepository,
    this.hazardReportRepository,
    this.routeAssessmentRepository,
    this.vehicleSignoutRepository,
    this.chatRepository,
    this.charterRepository,
  });

  @override
  Widget build(BuildContext context) {
    final app = MaterialApp(
      navigatorKey: rootNavigatorKey,
      scaffoldMessengerKey: rootScaffoldMessengerKey,
      title: 'PCY Tech • Driver Hub',
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.dark,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      builder: (context, child) {
        // Mobile phone viewport wrapper for desktop web preview
        return LayoutBuilder(
          builder: (context, constraints) {
            if (kIsWeb && constraints.maxWidth > 520) {
              return Scaffold(
                backgroundColor: const Color(0xFF090D16),
                body: Center(
                  child: Container(
                    width: 420,
                    height: 860,
                    margin: const EdgeInsets.symmetric(vertical: 24),
                    decoration: BoxDecoration(
                      color: AppColors.darkBg,
                      borderRadius: BorderRadius.circular(36),
                      border: Border.all(
                        color: const Color(0xFF334155),
                        width: 6,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.6),
                          blurRadius: 40,
                          offset: const Offset(0, 16),
                        ),
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.15),
                          blurRadius: 30,
                          offset: const Offset(0, 0),
                        ),
                      ],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(30),
                      child: child ?? const SizedBox.shrink(),
                    ),
                  ),
                ),
              );
            }
            return child ?? const SizedBox.shrink();
          },
        );
      },
      home: const LoginPage(),
    );

    if (dispatchRepository != null || routeRepository != null ||
        timeOffRepository != null || preTripRepository != null ||
        defectRepository != null || studentIncidentRepository != null ||
        expenseReimbursementRepository != null || hazardReportRepository != null ||
        routeAssessmentRepository != null || vehicleSignoutRepository != null) {
      return MultiRepositoryProvider(
        providers: [
          if (dispatchRepository != null)
            RepositoryProvider<DispatchRepository>.value(value: dispatchRepository!),
          if (routeRepository != null)
            RepositoryProvider<RouteRepository>.value(value: routeRepository!),
          if (timeOffRepository != null)
            RepositoryProvider<TimeOffRepository>.value(value: timeOffRepository!),
          if (preTripRepository != null)
            RepositoryProvider<PreTripRepository>.value(value: preTripRepository!),
          if (defectRepository != null)
            RepositoryProvider<DefectRepository>.value(value: defectRepository!),
          if (studentIncidentRepository != null)
            RepositoryProvider<StudentIncidentRepository>.value(value: studentIncidentRepository!),
          if (expenseReimbursementRepository != null)
            RepositoryProvider<ExpenseReimbursementRepository>.value(value: expenseReimbursementRepository!),
          if (hazardReportRepository != null)
            RepositoryProvider<HazardReportRepository>.value(value: hazardReportRepository!),
          if (routeAssessmentRepository != null)
            RepositoryProvider<RouteAssessmentRepository>.value(value: routeAssessmentRepository!),
          if (vehicleSignoutRepository != null)
            RepositoryProvider<VehicleSignoutRepository>.value(value: vehicleSignoutRepository!),
          if (chatRepository != null)
            RepositoryProvider<ChatRepository>.value(value: chatRepository!),
          if (charterRepository != null)
            RepositoryProvider<CharterRepository>.value(value: charterRepository!),
        ],
        child: app,
      );
    }

    return app;
  }
}

