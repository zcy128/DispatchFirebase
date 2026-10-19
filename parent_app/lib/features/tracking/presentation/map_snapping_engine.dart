import 'dart:math' as math;
import 'package:latlong2/latlong.dart';

class SnappedPosition {
  final LatLng position;
  final double bearingDegrees;
  final double distanceMeters;
  final bool isSnapped;

  const SnappedPosition({
    required this.position,
    required this.bearingDegrees,
    required this.distanceMeters,
    required this.isSnapped,
  });
}

class MapSnappingEngine {
  /// Decodes a Google Encoded Polyline string into a list of LatLng coordinates.
  static List<LatLng> decodePolyline(String encoded) {
    List<LatLng> points = [];
    int index = 0, len = encoded.length;
    int lat = 0, lng = 0;

    while (index < len) {
      int b, shift = 0, result = 0;
      do {
        if (index >= len) break;
        b = encoded.codeUnitAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      // Avoid `~` : dart2js compiles it to an UNSIGNED 32-bit result, corrupting negative deltas on Web.
      int dlat = ((result & 1) != 0 ? -(result >> 1) - 1 : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        if (index >= len) break;
        b = encoded.codeUnitAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      int dlng = ((result & 1) != 0 ? -(result >> 1) - 1 : (result >> 1));
      lng += dlng;

      points.add(LatLng(lat / 1e5, lng / 1e5));
    }
    return points;
  }

  /// Projects raw GPS [rawPos] onto the nearest polyline segment if within [thresholdMeters].
  /// Returns the snapped LatLng and the bearing (heading) of that road segment.
  static SnappedPosition snapToPolyline({
    required LatLng rawPos,
    required List<LatLng> polyline,
    double defaultHeading = 0.0,
    double thresholdMeters = 45.0,
  }) {
    if (polyline.length < 2) {
      return SnappedPosition(
        position: rawPos,
        bearingDegrees: defaultHeading,
        distanceMeters: 0.0,
        isSnapped: false,
      );
    }

    double minDistance = double.infinity;
    LatLng bestSnapped = rawPos;
    double bestBearing = defaultHeading;

    for (int i = 0; i < polyline.length - 1; i++) {
      final p1 = polyline[i];
      final p2 = polyline[i + 1];

      final proj = _projectOntoSegment(rawPos, p1, p2);
      final dist = _haversineMeters(rawPos, proj);

      if (dist < minDistance) {
        minDistance = dist;
        bestSnapped = proj;
        bestBearing = _calculateBearing(p1, p2);
      }
    }

    if (minDistance <= thresholdMeters) {
      return SnappedPosition(
        position: bestSnapped,
        bearingDegrees: bestBearing,
        distanceMeters: minDistance,
        isSnapped: true,
      );
    }

    return SnappedPosition(
      position: rawPos,
      bearingDegrees: defaultHeading,
      distanceMeters: minDistance,
      isSnapped: false,
    );
  }

  /// Orthogonal projection of P onto segment AB
  static LatLng _projectOntoSegment(LatLng p, LatLng a, LatLng b) {
    final dx = b.longitude - a.longitude;
    final dy = b.latitude - a.latitude;

    if (dx == 0 && dy == 0) {
      return a;
    }

    // Convert degrees to approximate planar meters at local latitude
    final latRad = (a.latitude + b.latitude) / 2.0 * (math.pi / 180.0);
    final cosLat = math.cos(latRad);

    final px = (p.longitude - a.longitude) * cosLat;
    final py = p.latitude - a.latitude;
    final vx = dx * cosLat;
    final vy = dy;

    final dot = px * vx + py * vy;
    final lenSq = vx * vx + vy * vy;
    double t = dot / lenSq;

    if (t < 0.0) t = 0.0;
    if (t > 1.0) t = 1.0;

    return LatLng(
      a.latitude + t * dy,
      a.longitude + t * dx,
    );
  }

  /// Haversine distance in meters
  static double _haversineMeters(LatLng p1, LatLng p2) {
    const double earthRadius = 6371000.0;
    final dLat = (p2.latitude - p1.latitude) * (math.pi / 180.0);
    final dLon = (p2.longitude - p1.longitude) * (math.pi / 180.0);
    final lat1 = p1.latitude * (math.pi / 180.0);
    final lat2 = p2.latitude * (math.pi / 180.0);

    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.sin(dLon / 2) * math.sin(dLon / 2) * math.cos(lat1) * math.cos(lat2);
    final c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
    return earthRadius * c;
  }

  /// Bearing between two points in degrees (0 - 360)
  static double _calculateBearing(LatLng from, LatLng to) {
    final lat1 = from.latitude * (math.pi / 180.0);
    final lat2 = to.latitude * (math.pi / 180.0);
    final dLon = (to.longitude - from.longitude) * (math.pi / 180.0);

    final y = math.sin(dLon) * math.cos(lat2);
    final x = math.cos(lat1) * math.sin(lat2) -
        math.sin(lat1) * math.cos(lat2) * math.cos(dLon);
    final brng = math.atan2(y, x) * (180.0 / math.pi);
    return (brng + 360.0) % 360.0;
  }
}
