import 'package:equatable/equatable.dart';
import '../models/hazard_report_model.dart';

abstract class HazardReportEvent extends Equatable {
  const HazardReportEvent();

  @override
  List<Object?> get props => [];
}

class LoadHazardReports extends HazardReportEvent {
  final String? employeeId;

  const LoadHazardReports({this.employeeId});

  @override
  List<Object?> get props => [employeeId];
}

class HazardReportsUpdated extends HazardReportEvent {
  final List<HazardReportModel> reports;

  const HazardReportsUpdated(this.reports);

  @override
  List<Object?> get props => [reports];
}

class SubmitHazardReport extends HazardReportEvent {
  final HazardReportModel report;

  const SubmitHazardReport(this.report);

  @override
  List<Object?> get props => [report];
}
