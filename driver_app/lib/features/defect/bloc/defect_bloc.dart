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
    on<DefectWatchFailed>(_onWatchFailed);
    on<SubmitDefectReportEvent>(_onSubmitDefectReport);
  }

  DefectLoaded? get _loaded =>
      state is DefectLoaded ? state as DefectLoaded : null;

  String _errorText(Object error) {
    final text = error.toString();
    const prefix = 'Exception: ';
    return text.startsWith(prefix) ? text.substring(prefix.length) : text;
  }

  Future<void> _onLoadDefects(
    LoadDefects event,
    Emitter<DefectState> emit,
  ) async {
    final previous = _loaded;
    if (previous == null) emit(const DefectLoading());
    try {
      final fleetVehicles = await repository.getFleetVehicleUnits();
      final reports = await repository.getDefectReports(
        vehicleUnit: event.vehicleUnit,
        driverId: event.driverId,
      );
      emit(DefectLoaded(
        reports: newestDefectReports(reports),
        fleetVehicles: fleetVehicles,
        selectedVehicleUnit: event.vehicleUnit,
        submitting: previous?.submitting ?? false,
      ));
    } catch (e) {
      if (previous != null) {
        emit(previous.copyWith(loadError: _errorText(e)));
      } else {
        emit(DefectError(_errorText(e)));
      }
    }
  }

  Future<void> _onWatchDefectsStarted(
    WatchDefectsStarted event,
    Emitter<DefectState> emit,
  ) async {
    await _reportsSubscription?.cancel();
    final previous = _loaded;
    try {
      final fleetVehicles = await repository.getFleetVehicleUnits();
      final initialReports = await repository.getDefectReports(
        vehicleUnit: event.vehicleUnit,
        driverId: event.driverId,
      );
      emit(DefectLoaded(
        reports: newestDefectReports(initialReports),
        fleetVehicles: fleetVehicles,
        selectedVehicleUnit: event.vehicleUnit ?? previous?.selectedVehicleUnit,
        submitting: previous?.submitting ?? false,
      ));
    } catch (e) {
      if (previous != null) {
        emit(previous.copyWith(loadError: _errorText(e)));
      } else {
        emit(DefectError(_errorText(e)));
      }
    }

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
        add(DefectWatchFailed(err.toString()));
      },
    );
  }

  void _onWatchFailed(
    DefectWatchFailed event,
    Emitter<DefectState> emit,
  ) {
    final current = _loaded;
    if (current != null) {
      emit(current.copyWith(loadError: _errorText(event.message)));
      return;
    }
    emit(DefectError(_errorText(event.message)));
  }

  void _onDefectsUpdated(
    DefectsUpdated event,
    Emitter<DefectState> emit,
  ) {
    final reports = newestDefectReports(event.reports);
    if (state is DefectLoaded) {
      final current = state as DefectLoaded;
      emit(current.copyWith(reports: reports, clearLoadError: true));
    } else if (state is DefectLoading) {
      return;
    } else {
      emit(DefectLoaded(reports: reports));
    }
  }

  Future<void> _onSubmitDefectReport(
    SubmitDefectReportEvent event,
    Emitter<DefectState> emit,
  ) async {
    final previous = _loaded;
    if (previous != null) {
      if (previous.submitting) return;
      emit(previous.copyWith(submitting: true, clearSubmitError: true));
    } else {
      emit(const DefectLoaded(reports: [], submitting: true));
    }

    try {
      final created = await repository.submitDefectReport(event.report);
      final base = previous ?? const DefectLoaded(reports: []);
      final merged = newestDefectReports([
        created,
        ...base.reports.where((report) => report.id != created.id),
      ]);
      emit(base.copyWith(
        reports: merged,
        submitting: false,
        clearSubmitError: true,
        clearLoadError: true,
        submitNotice: created.id.isEmpty
            ? created.reportDate + created.reportTime
            : created.id,
      ));
    } catch (e) {
      final base = previous ?? const DefectLoaded(reports: []);
      emit(base.copyWith(
        submitting: false,
        submitError: _errorText(e),
        clearSubmitNotice: true,
      ));
    }
  }

  @override
  Future<void> close() async {
    await _reportsSubscription?.cancel();
    return super.close();
  }
}
