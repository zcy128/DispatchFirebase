import 'package:equatable/equatable.dart';
import '../models/route_model.dart';

abstract class RouteEvent extends Equatable {
  const RouteEvent();

  @override
  List<Object?> get props => [];
}

class LoadRouteEvent extends RouteEvent {
  final String driverId;

  const LoadRouteEvent(this.driverId);

  @override
  List<Object?> get props => [driverId];
}

class FilterRouteShiftEvent extends RouteEvent {
  final String shiftType; // 'AM' | 'PM' | 'ALL'

  const FilterRouteShiftEvent(this.shiftType);

  @override
  List<Object?> get props => [shiftType];
}

class SearchRouteStudentsEvent extends RouteEvent {
  final String query;

  const SearchRouteStudentsEvent(this.query);

  @override
  List<Object?> get props => [query];
}

class ToggleRouteAssignmentEvent extends RouteEvent {
  final String driverId;
  final bool shouldAssign;

  const ToggleRouteAssignmentEvent({
    required this.driverId,
    required this.shouldAssign,
  });

  @override
  List<Object?> get props => [driverId, shouldAssign];
}

class FirestoreRouteUpdatedEvent extends RouteEvent {
  final DriverRouteInfo? route;

  const FirestoreRouteUpdatedEvent(this.route);

  @override
  List<Object?> get props => [route];
}

