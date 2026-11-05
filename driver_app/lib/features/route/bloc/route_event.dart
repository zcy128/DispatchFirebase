import 'dart:async';

import 'package:equatable/equatable.dart';
import '../models/route_model.dart';

abstract class RouteEvent extends Equatable {
  const RouteEvent();

  @override
  List<Object?> get props => [];
}

class LoadRouteEvent extends RouteEvent {
  final String driverId;
  final Completer<void>? ready;

  const LoadRouteEvent(this.driverId, {this.ready});

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

  /// 0 means the caller did not stamp a load generation. Non-zero events are
  /// dropped when they belong to a load that has already been replaced.
  final int epoch;

  const FirestoreRouteUpdatedEvent(this.route, {this.epoch = 0});

  @override
  List<Object?> get props => [route, epoch];
}

