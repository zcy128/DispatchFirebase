import 'package:equatable/equatable.dart';
import '../models/defect_model.dart';

abstract class DefectState extends Equatable {
  const DefectState();

  @override
  List<Object?> get props => [];
}

class DefectInitial extends DefectState {
  const DefectInitial();
}

class DefectLoading extends DefectState {
  const DefectLoading();
}

class DefectLoaded extends DefectState {
  final List<VehicleDefectReport> reports;
  final List<String> fleetVehicles;
  final String? selectedVehicleUnit;
  final bool submitting;
  final String? submitError;
  final String? loadError;
  final String? submitNotice;

  const DefectLoaded({
    required this.reports,
    this.fleetVehicles = const [],
    this.selectedVehicleUnit,
    this.submitting = false,
    this.submitError,
    this.loadError,
    this.submitNotice,
  });

  /// Count of open defects (submitted, under_assessment, under_repair)
  int get openDefectsCount => reports
      .where((r) => r.status != DefectReportStatus.resolved)
      .length;

  DefectLoaded copyWith({
    List<VehicleDefectReport>? reports,
    List<String>? fleetVehicles,
    String? selectedVehicleUnit,
    bool? submitting,
    String? submitError,
    bool clearSubmitError = false,
    String? loadError,
    bool clearLoadError = false,
    String? submitNotice,
    bool clearSubmitNotice = false,
  }) {
    return DefectLoaded(
      reports: reports ?? this.reports,
      fleetVehicles: fleetVehicles ?? this.fleetVehicles,
      selectedVehicleUnit: selectedVehicleUnit ?? this.selectedVehicleUnit,
      submitting: submitting ?? this.submitting,
      submitError:
          clearSubmitError ? null : (submitError ?? this.submitError),
      loadError: clearLoadError ? null : (loadError ?? this.loadError),
      submitNotice:
          clearSubmitNotice ? null : (submitNotice ?? this.submitNotice),
    );
  }

  @override
  List<Object?> get props => [
        reports,
        fleetVehicles,
        selectedVehicleUnit,
        submitting,
        submitError,
        loadError,
        submitNotice,
      ];
}

class DefectSubmitting extends DefectState {
  const DefectSubmitting();
}

class DefectSubmitSuccess extends DefectState {
  final VehicleDefectReport report;

  const DefectSubmitSuccess(this.report);

  @override
  List<Object?> get props => [report];
}

class DefectError extends DefectState {
  final String message;

  const DefectError(this.message);

  @override
  List<Object?> get props => [message];
}
