import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../models/route_model.dart';
import '../repository/route_repository.dart';
import 'route_event.dart';
import 'route_state.dart';

class RouteBloc extends Bloc<RouteEvent, RouteState> {
  final RouteRepository repository;
  StreamSubscription<DriverRouteInfo?>? _routeStreamSubscription;

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
    if (state is! RouteLoaded) {
      emit(RouteLoading());
    }
    try {
      // 1. Read cached route from Hive for instant responsive display
      var route = await repository.getAssignedRoute(event.driverId);
      final activeShift = state is RouteLoaded ? (state as RouteLoaded).selectedShiftType : 'AM';
      final activeSearch = state is RouteLoaded ? (state as RouteLoaded).searchQuery : '';

      if (route != null) {
        emit(RouteLoaded(
          route: route,
          isAssigned: true,
          selectedShiftType: activeShift,
          searchQuery: activeSearch,
        ));
      }

      // 2. Attach native Firestore realtime stream for live updates
      await _routeStreamSubscription?.cancel();
      _routeStreamSubscription = repository.watchRouteForDriver(event.driverId).listen(
        (updatedRoute) {
          add(FirestoreRouteUpdatedEvent(updatedRoute));
        },
        onError: (_) {},
      );

      // 3. Fetch data from backend as fallback sync
      final liveRoute = await repository.syncRouteFromBackend(event.driverId);
      if (liveRoute != null) {
        route = liveRoute;
        emit(RouteLoaded(
          route: route,
          isAssigned: true,
          selectedShiftType: state is RouteLoaded ? (state as RouteLoaded).selectedShiftType : 'AM',
          searchQuery: state is RouteLoaded ? (state as RouteLoaded).searchQuery : '',
        ));
      } else if (route == null && state is! RouteLoaded) {
        emit(const RouteLoaded(
          route: null,
          isAssigned: false,
          selectedShiftType: 'AM',
        ));
      }
    } catch (e) {
      if (state is! RouteLoaded) {
        final cached = await repository.getAssignedRoute(event.driverId);
        if (cached != null) {
          emit(RouteLoaded(
            route: cached,
            isAssigned: true,
            selectedShiftType: 'AM',
          ));
        } else {
          emit(RouteError(e.toString()));
        }
      }
    }
  }

  void _onFirestoreRouteUpdated(
    FirestoreRouteUpdatedEvent event,
    Emitter<RouteState> emit,
  ) {
    final activeShift = state is RouteLoaded ? (state as RouteLoaded).selectedShiftType : 'AM';
    final activeSearch = state is RouteLoaded ? (state as RouteLoaded).searchQuery : '';
    final route = event.route;

    emit(RouteLoaded(
      route: route,
      isAssigned: route != null,
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

