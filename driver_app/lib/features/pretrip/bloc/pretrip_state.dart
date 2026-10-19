import 'package:equatable/equatable.dart';
import '../models/pretrip_model.dart';

abstract class PreTripState extends Equatable {
  const PreTripState();
  @override
  List<Object?> get props => [];
}

class PreTripInitial extends PreTripState {
  const PreTripInitial();
}

class PreTripLoading extends PreTripState {
  const PreTripLoading();
}

/// Displays the current day's inspection status card.
class PreTripStatusLoaded extends PreTripState {
  /// The vehicle unit currently selected.
  final String selectedVehicleUnit;

  /// The current date YYYY-MM-DD.
  final String currentDate;

  /// Whether the selected vehicle is already inspected today.
  final bool isInspectedToday;

  /// The completed inspection record (null if not yet done).
  final PreTripInspectionRecord? completedInspection;

  /// All available fleet vehicle units.
  final List<String> fleetVehicles;

  const PreTripStatusLoaded({
    required this.selectedVehicleUnit,
    required this.currentDate,
    required this.isInspectedToday,
    this.completedInspection,
    this.fleetVehicles = const [],
  });

  @override
  List<Object?> get props => [
        selectedVehicleUnit,
        currentDate,
        isInspectedToday,
        completedInspection,
        fleetVehicles,
      ];

  PreTripStatusLoaded copyWith({
    String? selectedVehicleUnit,
    String? currentDate,
    bool? isInspectedToday,
    PreTripInspectionRecord? completedInspection,
    bool clearCompleted = false,
    List<String>? fleetVehicles,
  }) {
    return PreTripStatusLoaded(
      selectedVehicleUnit: selectedVehicleUnit ?? this.selectedVehicleUnit,
      currentDate: currentDate ?? this.currentDate,
      isInspectedToday: isInspectedToday ?? this.isInspectedToday,
      completedInspection:
          clearCompleted ? null : (completedInspection ?? this.completedInspection),
      fleetVehicles: fleetVehicles ?? this.fleetVehicles,
    );
  }
}

/// The user is currently filling in the checklist.
class PreTripInProgress extends PreTripState {
  final String vehicleUnit;
  final int vehicleId;
  final String vehiclePlate;
  final String inspectorId;
  final String inspectorName;
  final String date;
  final Map<String, InspectionItemResult> items;
  final int currentCategoryIndex;

  const PreTripInProgress({
    required this.vehicleUnit,
    this.vehicleId = 0,
    this.vehiclePlate = '',
    required this.inspectorId,
    required this.inspectorName,
    required this.date,
    required this.items,
    this.currentCategoryIndex = 0,
  });

  @override
  List<Object?> get props => [
        vehicleUnit,
        vehicleId,
        vehiclePlate,
        inspectorId,
        inspectorName,
        date,
        items,
        currentCategoryIndex,
      ];

  PreTripInProgress copyWith({
    Map<String, InspectionItemResult>? items,
    int? currentCategoryIndex,
  }) {
    return PreTripInProgress(
      vehicleUnit: vehicleUnit,
      vehicleId: vehicleId,
      vehiclePlate: vehiclePlate,
      inspectorId: inspectorId,
      inspectorName: inspectorName,
      date: date,
      items: items ?? this.items,
      currentCategoryIndex: currentCategoryIndex ?? this.currentCategoryIndex,
    );
  }

  /// Counts items with status != pass.
  int get defectCount => items.values
      .where((i) =>
          i.status == InspectionItemStatus.majorDefect ||
          i.status == InspectionItemStatus.minorDefect)
      .length;

  bool get hasMajorDefect =>
      items.values.any((i) => i.status == InspectionItemStatus.majorDefect);
}

/// Submission is in progress.
class PreTripSubmitting extends PreTripState {
  const PreTripSubmitting();
}

/// Submission succeeded.
class PreTripSubmitSuccess extends PreTripState {
  final PreTripInspectionRecord record;

  const PreTripSubmitSuccess(this.record);

  @override
  List<Object?> get props => [record];
}

/// An error occurred.
class PreTripError extends PreTripState {
  final String message;

  const PreTripError(this.message);

  @override
  List<Object?> get props => [message];
}
