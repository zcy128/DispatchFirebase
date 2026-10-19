import 'package:equatable/equatable.dart';
import '../models/dispatch_model.dart';

abstract class DispatchState extends Equatable {
  const DispatchState();

  @override
  List<Object?> get props => [];
}

class DispatchInitial extends DispatchState {}

class DispatchLoading extends DispatchState {}

class DispatchLoaded extends DispatchState {
  final DateTime selectedDate;
  final bool isToday;
  final bool isReadOnly;
  final List<DispatchRecord> dispatches;
  final DispatchRecord? activeDispatch;
  final String? actionFeedback;
  final String? errorMessage;

  const DispatchLoaded({
    required this.selectedDate,
    required this.isToday,
    required this.isReadOnly,
    required this.dispatches,
    this.activeDispatch,
    this.actionFeedback,
    this.errorMessage,
  });

  DispatchLoaded copyWith({
    DateTime? selectedDate,
    bool? isToday,
    bool? isReadOnly,
    List<DispatchRecord>? dispatches,
    DispatchRecord? activeDispatch,
    String? actionFeedback,
    String? errorMessage,
    bool clearMessages = false,
  }) {
    return DispatchLoaded(
      selectedDate: selectedDate ?? this.selectedDate,
      isToday: isToday ?? this.isToday,
      isReadOnly: isReadOnly ?? this.isReadOnly,
      dispatches: dispatches ?? this.dispatches,
      activeDispatch: activeDispatch ?? this.activeDispatch,
      actionFeedback: clearMessages ? null : (actionFeedback ?? this.actionFeedback),
      errorMessage: clearMessages ? null : (errorMessage ?? this.errorMessage),
    );
  }

  @override
  List<Object?> get props => [
        selectedDate,
        isToday,
        isReadOnly,
        dispatches,
        activeDispatch,
        actionFeedback,
        errorMessage,
      ];
}

class DispatchError extends DispatchState {
  final String message;

  const DispatchError(this.message);

  @override
  List<Object?> get props => [message];
}
