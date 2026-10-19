import 'package:equatable/equatable.dart';
import '../models/hazard_report_model.dart';

abstract class HazardReportState extends Equatable {
  const HazardReportState();

  @override
  List<Object?> get props => [];
}

class HazardReportInitial extends HazardReportState {
  const HazardReportInitial();
}

class HazardReportLoading extends HazardReportState {
  const HazardReportLoading();
}

class HazardReportLoaded extends HazardReportState {
  final List<HazardReportModel> reports;

  const HazardReportLoaded({required this.reports});

  int get totalCount => reports.length;
  int get openCount => reports.where((r) => r.statusInt == 0).length;
  int get investigatingCount => reports.where((r) => r.statusInt == 1).length;
  int get resolvedCount => reports.where((r) => r.statusInt == 2 || r.isCompleted).length;

  HazardReportLoaded copyWith({
    List<HazardReportModel>? reports,
  }) {
    return HazardReportLoaded(
      reports: reports ?? this.reports,
    );
  }

  @override
  List<Object?> get props => [reports];
}

class HazardReportSubmitting extends HazardReportState {
  const HazardReportSubmitting();
}

class HazardReportSubmitSuccess extends HazardReportState {
  final HazardReportModel report;

  const HazardReportSubmitSuccess(this.report);

  @override
  List<Object?> get props => [report];
}

class HazardReportSubmitFailure extends HazardReportState {
  final String error;

  const HazardReportSubmitFailure(this.error);

  @override
  List<Object?> get props => [error];
}

class HazardReportFailure extends HazardReportState {
  final String error;

  const HazardReportFailure(this.error);

  @override
  List<Object?> get props => [error];
}
