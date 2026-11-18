import 'package:flutter/foundation.dart';

/// Shared map layer options across Driver and Parent fleet map views.
enum FleetMapLayerType {
  road,
  traffic,
  satellite,
}

/// Immutable stop marker model shared across fleet route map widgets.
@immutable
class MapStopPin {
  final int sequence;
  final String title;
  final String subtitle;
  final String scheduledTime;
  final String? arrivedTime;
  final bool isSchoolStop;
  final bool isCompleted;
  final double? latitude;
  final double? longitude;
  final String? schoolNameHint;

  const MapStopPin({
    required this.sequence,
    required this.title,
    this.subtitle = '',
    required this.scheduledTime,
    this.arrivedTime,
    this.isSchoolStop = false,
    this.isCompleted = false,
    this.latitude,
    this.longitude,
    this.schoolNameHint,
  });

  bool get hasValidCoordinates {
    return latitude != null &&
        longitude != null &&
        latitude != 0 &&
        longitude != 0 &&
        !latitude!.isNaN &&
        !longitude!.isNaN;
  }
}
