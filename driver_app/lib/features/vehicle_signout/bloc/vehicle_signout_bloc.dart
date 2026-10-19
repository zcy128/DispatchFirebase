import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../models/vehicle_signout_model.dart';
import '../repository/vehicle_signout_repository.dart';
import 'vehicle_signout_event.dart';
import 'vehicle_signout_state.dart';

class VehicleSignoutBloc extends Bloc<VehicleSignoutEvent, VehicleSignoutState> {
  final VehicleSignoutRepository repository;

  VehicleSignoutBloc({required this.repository}) : super(VehicleSignoutInitial()) {
    on<LoadVehicleSignouts>(_onLoadVehicleSignouts);
    on<CreateVehicleSignoutEvent>(_onCreateVehicleSignout);
  }

  Future<void> _onLoadVehicleSignouts(
    LoadVehicleSignouts event,
    Emitter<VehicleSignoutState> emit,
  ) async {
    emit(VehicleSignoutLoading());
    await emit.forEach<List<VehicleSignoutModel>>(
      repository.watchVehicleSignouts(
        unitNumber: event.unitNumber,
        employeeId: event.employeeId,
        isSignIn: event.isSignIn,
      ),
      onData: (records) => VehicleSignoutLoaded(records),
      onError: (err, stackTrace) => VehicleSignoutFailure(err.toString()),
    );
  }

  Future<void> _onCreateVehicleSignout(
    CreateVehicleSignoutEvent event,
    Emitter<VehicleSignoutState> emit,
  ) async {
    emit(VehicleSignoutSubmitting());
    try {
      final saved = await repository.submitVehicleSignout(event.signout);
      emit(VehicleSignoutSuccess(saved));
    } catch (e) {
      emit(VehicleSignoutFailure(e.toString()));
    }
  }
}
