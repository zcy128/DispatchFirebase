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

  List<DriverRouteStop> get shiftStops {
    if (route == null) return [];
    final stops = <DriverRouteStop>[];
    for (final shift in route!.shifts) {
      if (selectedShiftType == 'ALL' || shift.shiftType == selectedShiftType) {
        stops.addAll(shift.stops);
      }
    }
    return stops;
  }

  List<DriverRouteStop> get displayedStops {
    final stops = shiftStops;
    final q = searchQuery.toLowerCase().trim();
    if (q.isEmpty) return stops;
    return stops.where((stop) => _stopMatchesQuery(stop, q)).toList();
  }

  List<DriverRouteStudent> get rosterStudents {
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
    return map.values.toList();
  }

  List<DriverRouteStudent> get allUniqueStudents {
    final list = rosterStudents;
    final q = searchQuery.toLowerCase().trim();
    if (q.isEmpty) return list;
    return list.where((student) => _studentMatchesQuery(student, q)).toList();
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

bool _studentMatchesQuery(DriverRouteStudent student, String query) {
  return student.name.toLowerCase().contains(query) ||
      student.studentNo.toLowerCase().contains(query) ||
      student.schoolName.toLowerCase().contains(query) ||
      student.address.toLowerCase().contains(query);
}

bool _stopMatchesQuery(DriverRouteStop stop, String query) {
  if (stop.location.toLowerCase().contains(query)) return true;
  if ((stop.schoolName ?? '').toLowerCase().contains(query)) return true;
  if ((stop.instruction ?? '').toLowerCase().contains(query)) return true;
  if (stop.stopType.toLowerCase().contains(query)) return true;
  return stop.students.any((student) => _studentMatchesQuery(student, query));
}

class RouteError extends RouteState {
  final String message;

  const RouteError(this.message);

  @override
  List<Object?> get props => [message];
}
