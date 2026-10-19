import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../models/hazard_report_model.dart';
import '../repository/hazard_report_repository.dart';
import 'hazard_report_event.dart';
import 'hazard_report_state.dart';

class HazardReportBloc extends Bloc<HazardReportEvent, HazardReportState> {
  final HazardReportRepository repository;
  StreamSubscription<List<HazardReportModel>>? _subscription;

  HazardReportBloc({required this.repository}) : super(const HazardReportInitial()) {
    on<LoadHazardReports>(_onLoadHazardReports);
    on<HazardReportsUpdated>(_onHazardReportsUpdated);
    on<SubmitHazardReport>(_onSubmitHazardReport);
  }

  Future<void> _onLoadHazardReports(
    LoadHazardReports event,
    Emitter<HazardReportState> emit,
  ) async {
    emit(const HazardReportLoading());
    await _subscription?.cancel();

    try {
      final initialReports = await repository.getHazardReports(employeeId: event.employeeId);
      emit(HazardReportLoaded(reports: initialReports));

      _subscription = repository.watchHazardReports(employeeId: event.employeeId).listen(
        (reports) {
          add(HazardReportsUpdated(reports));
        },
        onError: (e) {
          // Keep current state on stream error
        },
      );
    } catch (e) {
      emit(HazardReportFailure(e.toString()));
    }
  }

  void _onHazardReportsUpdated(
    HazardReportsUpdated event,
    Emitter<HazardReportState> emit,
  ) {
    emit(HazardReportLoaded(reports: event.reports));
  }

  Future<void> _onSubmitHazardReport(
    SubmitHazardReport event,
    Emitter<HazardReportState> emit,
  ) async {
    final currentReports = state is HazardReportLoaded
        ? (state as HazardReportLoaded).reports
        : <HazardReportModel>[];

    emit(const HazardReportSubmitting());
    try {
      final saved = await repository.submitHazardReport(event.report);
      emit(HazardReportSubmitSuccess(saved));

      final updatedList = [
        saved,
        ...currentReports.where((r) => r.id != saved.id),
      ];
      emit(HazardReportLoaded(reports: updatedList));
    } catch (e) {
      emit(HazardReportSubmitFailure(e.toString()));
      emit(HazardReportLoaded(reports: currentReports));
    }
  }

  @override
  Future<void> close() {
    _subscription?.cancel();
    return super.close();
  }
}
