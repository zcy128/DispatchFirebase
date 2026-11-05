import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../models/route_model.dart';
import '../repository/route_repository.dart';
import 'route_event.dart';
import 'route_state.dart';

class RouteBloc extends Bloc<RouteEvent, RouteState> {
  final RouteRepository repository;
  StreamSubscription<DriverRouteInfo?>? _routeStreamSubscription;
  int _epoch = 0;

  /// True after Firestore has delivered this driver's route during the current
  /// load. An empty snapshot is applied only after that, so a query that has
  /// not seen the route yet cannot wipe it.
  bool _sawLiveRoute = false;

  RouteBloc({required this.repository}) : super(RouteInitial()) {
    on<LoadRouteEvent>(_onLoadRoute);
    on<FilterRouteShiftEvent>(_onFilterRouteShift);
    on<SearchRouteStudentsEvent>(_onSearchRouteStudents);
    on<ToggleRouteAssignmentEvent>(_onToggleRouteAssignment);
    on<FirestoreRouteUpdatedEvent>(_onFirestoreRouteUpdated);
  }

  Future<void> _onLoadRoute(
    LoadRouteEvent event,
    Emitter<RouteState> emit,
  ) async {
    final epoch = ++_epoch;
    _sawLiveRoute = false;
    if (state is! RouteLoaded) {
      emit(RouteLoading());
    }
    try {
      final activeShift = state is RouteLoaded ? (state as RouteLoaded).selectedShiftType : 'AM';
      final activeSearch = state is RouteLoaded ? (state as RouteLoaded).searchQuery : '';
      final route = await repository.getAssignedRoute(event.driverId);
      if (epoch != _epoch) return;

      if (route != null) {
        emit(RouteLoaded(
          route: route,
          isAssigned: true,
          selectedShiftType: activeShift,
          searchQuery: activeSearch,
        ));
      }

      await _routeStreamSubscription?.cancel();
      if (epoch != _epoch) return;
      _routeStreamSubscription = repository.watchRouteForDriver(event.driverId).listen(
        (updatedRoute) {
          add(FirestoreRouteUpdatedEvent(updatedRoute, epoch: epoch));
        },
        onError: (_) {},
      );

      final liveRoute = await repository.syncRouteFromBackend(event.driverId);
      if (epoch != _epoch) return;
      final shift = state is RouteLoaded ? (state as RouteLoaded).selectedShiftType : activeShift;
      final search = state is RouteLoaded ? (state as RouteLoaded).searchQuery : activeSearch;
      if (liveRoute != null) {
        emit(RouteLoaded(
          route: liveRoute,
          isAssigned: true,
          selectedShiftType: shift,
          searchQuery: search,
        ));
      } else {
        emit(RouteLoaded(
          route: null,
          isAssigned: false,
          selectedShiftType: shift,
          searchQuery: search,
        ));
      }
    } catch (e) {
      if (epoch != _epoch) return;
      await _keepCacheOrSurfaceError(event.driverId, emit, e.toString());
    } finally {
      final ready = event.ready;
      if (ready != null && !ready.isCompleted) {
        ready.complete();
      }
    }
  }

  Future<void> _keepCacheOrSurfaceError(
    String driverId,
    Emitter<RouteState> emit,
    String message,
  ) async {
    if (state is RouteLoaded && (state as RouteLoaded).route != null) return;
    final cached = await repository.getAssignedRoute(driverId);
    final shift = state is RouteLoaded ? (state as RouteLoaded).selectedShiftType : 'AM';
    final search = state is RouteLoaded ? (state as RouteLoaded).searchQuery : '';
    if (cached != null) {
      emit(RouteLoaded(
        route: cached,
        isAssigned: true,
        selectedShiftType: shift,
        searchQuery: search,
      ));
      return;
    }
    if (state is! RouteLoaded) {
      emit(RouteError(message));
    }
  }

  void _onFirestoreRouteUpdated(
    FirestoreRouteUpdatedEvent event,
    Emitter<RouteState> emit,
  ) {
    if (event.epoch != 0 && event.epoch != _epoch) return;
    final activeShift = state is RouteLoaded ? (state as RouteLoaded).selectedShiftType : 'AM';
    final activeSearch = state is RouteLoaded ? (state as RouteLoaded).searchQuery : '';
    final route = event.route;
    if (route == null) {
      if (!_sawLiveRoute) return;
      emit(RouteLoaded(
        route: null,
        isAssigned: false,
        selectedShiftType: activeShift,
        searchQuery: activeSearch,
      ));
      return;
    }

    _sawLiveRoute = true;
    emit(RouteLoaded(
      route: route,
      isAssigned: true,
      selectedShiftType: activeShift,
      searchQuery: activeSearch,
    ));
  }

  void _onFilterRouteShift(
    FilterRouteShiftEvent event,
    Emitter<RouteState> emit,
  ) {
    if (state is! RouteLoaded) return;
    final current = state as RouteLoaded;
    emit(current.copyWith(selectedShiftType: event.shiftType));
  }

  void _onSearchRouteStudents(
    SearchRouteStudentsEvent event,
    Emitter<RouteState> emit,
  ) {
    if (state is! RouteLoaded) return;
    final current = state as RouteLoaded;
    emit(current.copyWith(searchQuery: event.query));
  }

  Future<void> _onToggleRouteAssignment(
    ToggleRouteAssignmentEvent event,
    Emitter<RouteState> emit,
  ) async {
    emit(RouteLoading());
    try {
      await repository.toggleAssignment(event.driverId, event.shouldAssign);
      final route = await repository.getAssignedRoute(event.driverId);
      emit(RouteLoaded(
        route: route,
        isAssigned: route != null,
        selectedShiftType: 'AM',
      ));
    } catch (e) {
      emit(RouteError(e.toString()));
    }
  }

  @override
  Future<void> close() {
    _routeStreamSubscription?.cancel();
    return super.close();
  }
}

