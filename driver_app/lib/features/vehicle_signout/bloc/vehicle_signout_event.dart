import 'package:equatable/equatable.dart';
import '../models/vehicle_signout_model.dart';

abstract class VehicleSignoutEvent extends Equatable {
  const VehicleSignoutEvent();

  @override
  List<Object?> get props => [];
}

class LoadVehicleSignouts extends VehicleSignoutEvent {
  final String? unitNumber;
  final String? employeeId;
  final bool? isSignIn;

  const LoadVehicleSignouts({
    this.unitNumber,
    this.employeeId,
    this.isSignIn,
  });

  @override
  List<Object?> get props => [unitNumber, employeeId, isSignIn];
}

class CreateVehicleSignoutEvent extends VehicleSignoutEvent {
  final VehicleSignoutModel signout;

  const CreateVehicleSignoutEvent(this.signout);

  @override
  List<Object?> get props => [signout];
}
