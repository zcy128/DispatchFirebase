import 'package:equatable/equatable.dart';
import '../models/route_model.dart';

abstract class RouteState extends Equatable {
  const RouteState();

  @override
  List<Object?> get props => [];
}

class RouteInitial extends RouteState {}

class RouteLoading extends RouteState {}

class RouteLoaded extends RouteState {
  final DriverRouteInfo? route;
  final bool isAssigned;
  final String selectedShiftType; // 'AM' | 'PM' | 'ALL'
  final String searchQuery;

  const RouteLoaded({
    required this.route,
    required this.isAssigned,
    this.selectedShiftType = 'AM',
    this.searchQuery = '',
  });

  List<DriverRouteStop> get displayedStops {
    if (route == null) return [];
    final stops = <DriverRouteStop>[];
    for (final shift in route!.shifts) {
      if (selectedShiftType == 'ALL' || shift.shiftType == selectedShiftType) {
        stops.addAll(shift.stops);
      }
    }
    return stops;
  }

  List<DriverRouteStudent> get allUniqueStudents {
    if (route == null) return [];
    final map = <int, DriverRouteStudent>{};
    for (final shift in route!.shifts) {
      if (selectedShiftType == 'ALL' || shift.shiftType == selectedShiftType) {
        for (final stop in shift.stops) {
          for (final st in stop.students) {
            map[st.studentId] = st;
          }
        }
      }
    }

    final list = map.values.toList();
    if (searchQuery.trim().isEmpty) {
      return list;
    }

    final q = searchQuery.toLowerCase().trim();
    return list.where((s) {
      return s.name.toLowerCase().contains(q) ||
          s.studentNo.toLowerCase().contains(q) ||
          s.schoolName.toLowerCase().contains(q) ||
          s.address.toLowerCase().contains(q);
    }).toList();
  }

  List<DriverRouteStudent> get filteredStudents => allUniqueStudents;

  RouteLoaded copyWith({
    DriverRouteInfo? route,
    bool? isAssigned,
    String? selectedShiftType,
    String? searchQuery,
    bool clearRoute = false,
  }) {
    return RouteLoaded(
      route: clearRoute ? null : (route ?? this.route),
      isAssigned: isAssigned ?? this.isAssigned,
      selectedShiftType: selectedShiftType ?? this.selectedShiftType,
      searchQuery: searchQuery ?? this.searchQuery,
    );
  }

  @override
  List<Object?> get props => [
        route,
        isAssigned,
        selectedShiftType,
        searchQuery,
      ];
}

class RouteError extends RouteState {
  final String message;

  const RouteError(this.message);

  @override
  List<Object?> get props => [message];
}
