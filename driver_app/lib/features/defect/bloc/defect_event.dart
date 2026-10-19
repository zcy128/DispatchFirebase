import 'package:equatable/equatable.dart';
import '../models/defect_model.dart';

abstract class DefectEvent extends Equatable {
  const DefectEvent();

  @override
  List<Object?> get props => [];
}

class LoadDefects extends DefectEvent {
  final String? vehicleUnit;
  final String? driverId;

  const LoadDefects({this.vehicleUnit, this.driverId});

  @override
  List<Object?> get props => [vehicleUnit, driverId];
}

class WatchDefectsStarted extends DefectEvent {
  final String? vehicleUnit;
  final String? driverId;

  const WatchDefectsStarted({this.vehicleUnit, this.driverId});

  @override
  List<Object?> get props => [vehicleUnit, driverId];
}

class DefectsUpdated extends DefectEvent {
  final List<VehicleDefectReport> reports;

  const DefectsUpdated(this.reports);

  @override
  List<Object?> get props => [reports];
}

class SubmitDefectReportEvent extends DefectEvent {
  final VehicleDefectReport report;

  const SubmitDefectReportEvent(this.report);

  @override
  List<Object?> get props => [report];
}
