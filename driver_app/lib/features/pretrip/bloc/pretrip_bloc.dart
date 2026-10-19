import 'package:flutter_bloc/flutter_bloc.dart';
import '../models/pretrip_model.dart';
import '../repository/pretrip_repository.dart';
import 'pretrip_event.dart';
import 'pretrip_state.dart';

class PreTripBloc extends Bloc<PreTripEvent, PreTripState> {
  final PreTripRepository repository;

  PreTripBloc({required this.repository}) : super(const PreTripInitial()) {
    on<LoadFleetVehiclesEvent>(_onLoadFleetVehicles);
    on<LoadPreTripStatusEvent>(_onLoadPreTripStatus);
    on<ChangePreTripVehicleEvent>(_onChangeVehicle);
    on<StartPreTripInspectionEvent>(_onStartInspection);
    on<UpdatePreTripItemEvent>(_onUpdateItem);
    on<SubmitPreTripInspectionEvent>(_onSubmitInspection);
  }

  Future<void> _onLoadFleetVehicles(
      LoadFleetVehiclesEvent event, Emitter<PreTripState> emit) async {
    final vehicles = await repository.getFleetVehicleUnits();
    if (state is PreTripStatusLoaded) {
      final current = state as PreTripStatusLoaded;
      emit(current.copyWith(fleetVehicles: vehicles));
    }
  }

  Future<void> _onLoadPreTripStatus(
      LoadPreTripStatusEvent event, Emitter<PreTripState> emit) async {
    emit(const PreTripLoading());
    try {
      final vehicles = await repository.getFleetVehicleUnits();
      final inspection = await repository.getTodayInspection(
          event.vehicleUnit, event.date);
      emit(PreTripStatusLoaded(
        selectedVehicleUnit: event.vehicleUnit,
        currentDate: event.date,
        isInspectedToday: inspection != null,
        completedInspection: inspection,
        fleetVehicles: vehicles,
      ));
    } catch (e) {
      emit(PreTripError('Failed to load inspection status: $e'));
    }
  }

  Future<void> _onChangeVehicle(
      ChangePreTripVehicleEvent event, Emitter<PreTripState> emit) async {
    if (state is! PreTripStatusLoaded) return;
    final current = state as PreTripStatusLoaded;
    emit(const PreTripLoading());
    try {
      final inspection = await repository.getTodayInspection(
          event.vehicleUnit, current.currentDate);
      emit(current.copyWith(
        selectedVehicleUnit: event.vehicleUnit,
        isInspectedToday: inspection != null,
        completedInspection: inspection,
        clearCompleted: inspection == null,
      ));
    } catch (e) {
      emit(PreTripError('Failed to load vehicle status: $e'));
    }
  }

  Future<void> _onStartInspection(
      StartPreTripInspectionEvent event, Emitter<PreTripState> emit) async {
    emit(PreTripInProgress(
      vehicleUnit: event.vehicleUnit,
      vehicleId: event.vehicleId,
      vehiclePlate: event.vehiclePlate,
      inspectorId: event.inspectorId,
      inspectorName: event.inspectorName,
      date: event.date,
      items: buildInitialItems(),
      currentCategoryIndex: 0,
    ));
  }

  void _onUpdateItem(
      UpdatePreTripItemEvent event, Emitter<PreTripState> emit) {
    if (state is! PreTripInProgress) return;
    final current = state as PreTripInProgress;
    final updated = Map<String, InspectionItemResult>.from(current.items);
    final existing = updated[event.itemCode];
    if (existing != null) {
      updated[event.itemCode] =
          existing.copyWith(status: event.status, notes: event.notes);
    }
    emit(current.copyWith(items: updated));
  }

  Future<void> _onSubmitInspection(
      SubmitPreTripInspectionEvent event, Emitter<PreTripState> emit) async {
    if (state is! PreTripInProgress) return;
    final current = state as PreTripInProgress;
    emit(const PreTripSubmitting());

    try {
      final now = DateTime.now();
      final record = PreTripInspectionRecord(
        vehicleUnit: current.vehicleUnit,
        vehicleId: current.vehicleId,
        vehiclePlate: current.vehiclePlate,
        inspectionDate: current.date,
        inspectionTime: event.inspectionTime,
        inspectorId: current.inspectorId,
        inspectorName: current.inspectorName,
        odometer: event.odometer,
        items: current.items,
        defectNotes: event.defectNotes,
        signatureName: event.signatureName.isNotEmpty
            ? event.signatureName
            : (current.inspectorName.isNotEmpty
                ? current.inspectorName
                : current.inspectorId),
        createdAt: now,
        updatedAt: now,
      );

      final created = await repository.submitInspection(record);
      emit(PreTripSubmitSuccess(created));
    } catch (e) {
      emit(PreTripError('Failed to submit inspection: $e'));
    }
  }
}
