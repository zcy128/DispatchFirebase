import 'package:equatable/equatable.dart';
import '../models/pretrip_model.dart';

abstract class PreTripEvent extends Equatable {
  const PreTripEvent();
  @override
  List<Object?> get props => [];
}

/// Loads today's inspection status for [vehicleUnit].
class LoadPreTripStatusEvent extends PreTripEvent {
  final String vehicleUnit;
  final String date; // YYYY-MM-DD

  const LoadPreTripStatusEvent({required this.vehicleUnit, required this.date});

  @override
  List<Object?> get props => [vehicleUnit, date];
}

/// Updates a single inspection item result within the in-progress draft.
class UpdatePreTripItemEvent extends PreTripEvent {
  final String itemCode;
  final InspectionItemStatus status;
  final String notes;

  const UpdatePreTripItemEvent({
    required this.itemCode,
    required this.status,
    this.notes = '',
  });

  @override
  List<Object?> get props => [itemCode, status, notes];
}

/// Starts a new pre-trip inspection session for [vehicleUnit].
class StartPreTripInspectionEvent extends PreTripEvent {
  final String vehicleUnit;
  final int vehicleId;
  final String vehiclePlate;
  final String inspectorId;
  final String inspectorName;
  final String date;

  const StartPreTripInspectionEvent({
    required this.vehicleUnit,
    this.vehicleId = 0,
    this.vehiclePlate = '',
    required this.inspectorId,
    required this.inspectorName,
    required this.date,
  });

  @override
  List<Object?> get props =>
      [vehicleUnit, vehicleId, vehiclePlate, inspectorId, inspectorName, date];
}

/// Submits the completed pre-trip inspection.
class SubmitPreTripInspectionEvent extends PreTripEvent {
  final int odometer;
  final String defectNotes;
  final String signatureName;
  final String inspectionTime;

  const SubmitPreTripInspectionEvent({
    required this.odometer,
    this.defectNotes = '',
    this.signatureName = '',
    required this.inspectionTime,
  });

  @override
  List<Object?> get props =>
      [odometer, defectNotes, signatureName, inspectionTime];
}

/// Changes the selected vehicle (e.g., from vehicle picker).
class ChangePreTripVehicleEvent extends PreTripEvent {
  final String vehicleUnit;

  const ChangePreTripVehicleEvent(this.vehicleUnit);

  @override
  List<Object?> get props => [vehicleUnit];
}

/// Loads the list of available fleet vehicles.
class LoadFleetVehiclesEvent extends PreTripEvent {
  const LoadFleetVehiclesEvent();
}
