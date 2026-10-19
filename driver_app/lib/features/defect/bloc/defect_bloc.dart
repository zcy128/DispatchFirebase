import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../models/defect_model.dart';
import '../repository/defect_repository.dart';
import 'defect_event.dart';
import 'defect_state.dart';

class DefectBloc extends Bloc<DefectEvent, DefectState> {
  final DefectRepository repository;
  StreamSubscription<List<VehicleDefectReport>>? _reportsSubscription;

  DefectBloc({required this.repository}) : super(const DefectInitial()) {
    on<LoadDefects>(_onLoadDefects);
    on<WatchDefectsStarted>(_onWatchDefectsStarted);
    on<DefectsUpdated>(_onDefectsUpdated);
    on<SubmitDefectReportEvent>(_onSubmitDefectReport);
  }

  Future<void> _onLoadDefects(
    LoadDefects event,
    Emitter<DefectState> emit,
  ) async {
    emit(const DefectLoading());
    try {
      final fleetVehicles = await repository.getFleetVehicleUnits();
      final reports = await repository.getDefectReports(
        vehicleUnit: event.vehicleUnit,
        driverId: event.driverId,
      );
      emit(DefectLoaded(
        reports: reports,
        fleetVehicles: fleetVehicles,
        selectedVehicleUnit: event.vehicleUnit,
      ));
    } catch (e) {
      emit(DefectError(e.toString()));
    }
  }

  Future<void> _onWatchDefectsStarted(
    WatchDefectsStarted event,
    Emitter<DefectState> emit,
  ) async {
    await _reportsSubscription?.cancel();
    final fleetVehicles = await repository.getFleetVehicleUnits();

    _reportsSubscription = repository
        .watchDefectReports(
          driverId: event.driverId,
          vehicleUnit: event.vehicleUnit,
        )
        .listen(
      (reports) {
        add(DefectsUpdated(reports));
      },
      onError: (err) {
        // Suppress unhandled stream error in web/browser when Firestore security rules restrict direct access
      },
    );

    final initialReports = await repository.getDefectReports(
      vehicleUnit: event.vehicleUnit,
      driverId: event.driverId,
    );
    emit(DefectLoaded(
      reports: initialReports,
      fleetVehicles: fleetVehicles,
      selectedVehicleUnit: event.vehicleUnit,
    ));
  }

  void _onDefectsUpdated(
    DefectsUpdated event,
    Emitter<DefectState> emit,
  ) {
    if (state is DefectLoaded) {
      final current = state as DefectLoaded;
      emit(current.copyWith(reports: event.reports));
    } else {
      emit(DefectLoaded(reports: event.reports));
    }
  }

  Future<void> _onSubmitDefectReport(
    SubmitDefectReportEvent event,
    Emitter<DefectState> emit,
  ) async {
    emit(const DefectSubmitting());
    try {
      final created = await repository.submitDefectReport(event.report);
      emit(DefectSubmitSuccess(created));
    } catch (e) {
      emit(DefectError('Failed to submit defect report: $e'));
    }
  }

  @override
  Future<void> close() async {
    await _reportsSubscription?.cancel();
    return super.close();
  }
}
