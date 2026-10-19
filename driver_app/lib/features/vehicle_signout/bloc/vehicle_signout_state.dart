import 'package:equatable/equatable.dart';
import '../models/vehicle_signout_model.dart';

abstract class VehicleSignoutState extends Equatable {
  const VehicleSignoutState();

  @override
  List<Object?> get props => [];
}

class VehicleSignoutInitial extends VehicleSignoutState {}

class VehicleSignoutLoading extends VehicleSignoutState {}

class VehicleSignoutLoaded extends VehicleSignoutState {
  final List<VehicleSignoutModel> records;

  const VehicleSignoutLoaded(this.records);

  @override
  List<Object?> get props => [records];
}

class VehicleSignoutSubmitting extends VehicleSignoutState {}

class VehicleSignoutSuccess extends VehicleSignoutState {
  final VehicleSignoutModel created;

  const VehicleSignoutSuccess(this.created);

  @override
  List<Object?> get props => [created];
}

class VehicleSignoutFailure extends VehicleSignoutState {
  final String error;

  const VehicleSignoutFailure(this.error);

  @override
  List<Object?> get props => [error];
}
