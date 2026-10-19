import 'package:equatable/equatable.dart';
import '../models/time_off_model.dart';

abstract class TimeOffState extends Equatable {
  const TimeOffState();

  @override
  List<Object?> get props => [];
}

class TimeOffInitial extends TimeOffState {
  const TimeOffInitial();
}

class TimeOffLoading extends TimeOffState {
  const TimeOffLoading();
}

class TimeOffLoaded extends TimeOffState {
  final List<TimeOffRequestModel> requests;
  final List<TimeOffRequestModel> allRequests;
  final TimeOffStatus? statusFilter;
  final bool isSubmitting;
  final String? errorMessage;
  final String? successMessage;

  const TimeOffLoaded({
    required this.requests,
    required this.allRequests,
    this.statusFilter,
    this.isSubmitting = false,
    this.errorMessage,
    this.successMessage,
  });

  int get totalCount => allRequests.length;
  int get pendingCount => allRequests.where((r) => r.isPending).length;
  int get approvedCount => allRequests.where((r) => r.isApproved).length;
  int get rejectedCount => allRequests.where((r) => r.isRejected).length;

  TimeOffLoaded copyWith({
    List<TimeOffRequestModel>? requests,
    List<TimeOffRequestModel>? allRequests,
    TimeOffStatus? Function()? statusFilter,
    bool? isSubmitting,
    String? Function()? errorMessage,
    String? Function()? successMessage,
  }) {
    return TimeOffLoaded(
      requests: requests ?? this.requests,
      allRequests: allRequests ?? this.allRequests,
      statusFilter: statusFilter != null ? statusFilter() : this.statusFilter,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      errorMessage: errorMessage != null ? errorMessage() : this.errorMessage,
      successMessage: successMessage != null ? successMessage() : this.successMessage,
    );
  }

  @override
  List<Object?> get props => [
        requests,
        allRequests,
        statusFilter,
        isSubmitting,
        errorMessage,
        successMessage,
      ];
}

class TimeOffError extends TimeOffState {
  final String message;

  const TimeOffError(this.message);

  @override
  List<Object?> get props => [message];
}
