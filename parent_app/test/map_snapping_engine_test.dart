import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:parent_app/features/tracking/presentation/map_snapping_engine.dart';

void main() {
  group('MapSnappingEngine', () {
    const mockPolyline =
        'm{jtG~tdeL?@a@n@e@x@o@x@Wl@i@`AW`@_@j@W`@e@bAOj@_@v@[v@m@xAU`@e@bAOj@_@v@[v@m@xAU`@e@bAOj@_@v@[v@m@xAU`@e@bAOj@_@v@[v@m@xAU`@';

    test('decodePolyline decodes standard encoded polyline successfully', () {
      final points = MapSnappingEngine.decodePolyline(mockPolyline);
      expect(points, isNotEmpty);
      expect(points.length, greaterThan(2));
      expect(points.first.latitude, closeTo(45.38, 0.5));
      expect(points.first.longitude, closeTo(-69.17, 0.5));
    });

    test('decodePolyline handles empty string gracefully', () {
      final points = MapSnappingEngine.decodePolyline('');
      expect(points, isEmpty);
    });

    test('snapToPolyline returns raw position when polyline has less than 2 points', () {
      final rawPos = const LatLng(45.3524, -75.7558);
      final snapped = MapSnappingEngine.snapToPolyline(
        rawPos: rawPos,
        polyline: [rawPos],
        defaultHeading: 45.0,
      );

      expect(snapped.isSnapped, isFalse);
      expect(snapped.position, equals(rawPos));
      expect(snapped.bearingDegrees, equals(45.0));
      expect(snapped.distanceMeters, equals(0.0));
    });

    test('snapToPolyline snaps to nearest road segment within threshold', () {
      // Create a segment along a road going east: p1 -> p2
      final p1 = const LatLng(45.3500, -75.7600);
      final p2 = const LatLng(45.3500, -75.7500);
      final polyline = [p1, p2];

      // Vehicle is slightly north of the segment (approx 15 meters)
      final rawPos = const LatLng(45.3501, -75.7550);

      final snapped = MapSnappingEngine.snapToPolyline(
        rawPos: rawPos,
        polyline: polyline,
        defaultHeading: 0.0,
        thresholdMeters: 45.0,
      );

      expect(snapped.isSnapped, isTrue);
      // Snapped latitude should be close to 45.3500 (projected onto line)
      expect(snapped.position.latitude, closeTo(45.3500, 0.00005));
      expect(snapped.position.longitude, closeTo(-75.7550, 0.0001));
      expect(snapped.distanceMeters, lessThan(45.0));
      // Heading eastward should be ~90 degrees
      expect(snapped.bearingDegrees, closeTo(90.0, 1.0));
    });

    test('snapToPolyline does not snap when vehicle is beyond threshold distance', () {
      final p1 = const LatLng(45.3500, -75.7600);
      final p2 = const LatLng(45.3500, -75.7500);
      final polyline = [p1, p2];

      // Vehicle is 500+ meters north
      final rawPos = const LatLng(45.3600, -75.7550);

      final snapped = MapSnappingEngine.snapToPolyline(
        rawPos: rawPos,
        polyline: polyline,
        defaultHeading: 120.0,
        thresholdMeters: 45.0,
      );

      expect(snapped.isSnapped, isFalse);
      expect(snapped.position, equals(rawPos));
      expect(snapped.bearingDegrees, equals(120.0));
      expect(snapped.distanceMeters, greaterThan(45.0));
    });

    test('snapToPolyline projects correctly to segment endpoints when off segment bounds', () {
      final p1 = const LatLng(45.3500, -75.7600);
      final p2 = const LatLng(45.3500, -75.7500);
      final polyline = [p1, p2];

      // Raw position is further west than p1
      final rawPos = const LatLng(45.3500, -75.7601);

      final snapped = MapSnappingEngine.snapToPolyline(
        rawPos: rawPos,
        polyline: polyline,
        thresholdMeters: 45.0,
      );

      expect(snapped.isSnapped, isTrue);
      expect(snapped.position.latitude, closeTo(p1.latitude, 0.0001));
      expect(snapped.position.longitude, closeTo(p1.longitude, 0.0001));
    });
  });
}
