import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart' hide Path;
import '../../../core/models.dart';
import '../../../core/theme.dart';
import 'map_snapping_engine.dart';

class BusMapWidget extends StatefulWidget {
  final ParentStudentCommute commute;

  const BusMapWidget({super.key, required this.commute});

  @override
  State<BusMapWidget> createState() => _BusMapWidgetState();
}

class _BusMapWidgetState extends State<BusMapWidget> {
  final MapController _mapController = MapController();

  // Default stop coordinate in Ottawa if not explicitly provided
  static const LatLng _defaultStopCoord = LatLng(45.3524, -75.7558);


  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // First frame ensure map has non-zero size, then transition to full route framing
      Future.delayed(const Duration(milliseconds: 300), () {
        if (mounted) _fitRouteBounds();
      });
    });
  }

  @override
  void didUpdateWidget(covariant BusMapWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.commute.studentId != widget.commute.studentId ||
        oldWidget.commute.routePolyline != widget.commute.routePolyline) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _fitRouteBounds();
      });
    }
  }

  void _fitRouteBounds() {
    if (!mounted) return;
    try {
      final points = _routePolylinePoints;
      final allPoints = <LatLng>[
        ...points,
        _busRawPosition,
        _stopPosition,
        _schoolPosition,
      ];

      double minLat = allPoints.first.latitude;
      double maxLat = allPoints.first.latitude;
      double minLng = allPoints.first.longitude;
      double maxLng = allPoints.first.longitude;

      for (final p in allPoints) {
        if (p.latitude < minLat) minLat = p.latitude;
        if (p.latitude > maxLat) maxLat = p.latitude;
        if (p.longitude < minLng) minLng = p.longitude;
        if (p.longitude > maxLng) maxLng = p.longitude;
      }

      // Safe Ottawa corridor boundary check
      if (minLat < 45.2 || maxLat > 45.45 || minLng < -76.0 || maxLng > -75.5) {
        minLat = 45.3512;
        maxLat = 45.3855;
        minLng = -75.7670;
        maxLng = -75.7500;
      }

      final centerLat = (minLat + maxLat) / 2.0;
      final centerLng = (minLng + maxLng) / 2.0;

      // Shifting center latitude southward places the Ottawa corridor dead-center
      // in the visible area above the bottom commute sheet
      final adjustedCenter = LatLng(centerLat - 0.0055, centerLng);

      // Optimal framing zoom
      double targetZoom = 12.6;
      final dLat = (maxLat - minLat).abs();
      if (dLat > 0.06) {
        targetZoom = 12.0;
      } else if (dLat > 0.035) {
        targetZoom = 12.4;
      } else {
        targetZoom = 12.8;
      }

      // Force a camera movement event even if already near route center
      final currCenter = _mapController.camera.center;
      final currZoom = _mapController.camera.zoom;
      if ((currCenter.latitude - adjustedCenter.latitude).abs() < 0.0002 &&
          (currZoom - targetZoom).abs() < 0.02) {
        _mapController.move(adjustedCenter, targetZoom + 0.01);
      } else {
        _mapController.move(adjustedCenter, targetZoom);
      }
    } catch (_) {
      _mapController.move(const LatLng(45.362, -75.758), 12.6);
    }
  }

  LatLng get _busRawPosition {
    final loc = widget.commute.vehicleLocation;
    if (loc != null && loc.latitude != 0 && loc.longitude != 0) {
      return LatLng(loc.latitude, loc.longitude);
    }
    // Fallback slightly west of stop
    return const LatLng(45.3512, -75.7601);
  }

  LatLng get _stopPosition {
    if (widget.commute.stopLatitude != null &&
        widget.commute.stopLongitude != null &&
        widget.commute.stopLatitude != 0) {
      return LatLng(widget.commute.stopLatitude!, widget.commute.stopLongitude!);
    }
    return _defaultStopCoord;
  }

  LatLng get _schoolPosition {
    if (widget.commute.schoolLatitude != null &&
        widget.commute.schoolLongitude != null &&
        widget.commute.schoolLatitude != 0) {
      return LatLng(widget.commute.schoolLatitude!, widget.commute.schoolLongitude!);
    }
    final name = widget.commute.schoolName.toLowerCase();
    if (name.contains('broadview')) {
      return const LatLng(45.37896, -75.76102);
    } else if (name.contains('nepean')) {
      return const LatLng(45.38552, -75.75485);
    } else if (name.contains('patrick')) {
      return const LatLng(45.4120, -75.6890);
    } else if (name.contains('westbrook')) {
      return const LatLng(45.3620, -75.7480);
    }
    // Default school coordinate (Ottawa region)
    return const LatLng(45.37896, -75.76102);
  }

  List<LatLng> get _routePolylinePoints {
    final polyString = widget.commute.routePolyline;
    List<LatLng> rawPoints = [];
    if (polyString != null && polyString.isNotEmpty) {
      rawPoints = MapSnappingEngine.decodePolyline(polyString);
    }
    if (rawPoints.length < 2) {
      rawPoints = [_busRawPosition, _stopPosition, _schoolPosition];
    }

    final filtered = <LatLng>[];
    for (final p in rawPoints) {
      if (p.latitude.isNaN || p.longitude.isNaN || p.latitude == 0 || p.longitude == 0) continue;
      // Filter out duplicate consecutive points
      if (filtered.isEmpty ||
          (filtered.last.latitude - p.latitude).abs() > 0.00002 ||
          (filtered.last.longitude - p.longitude).abs() > 0.00002) {
        filtered.add(p);
      }
    }
    return filtered.length >= 2 ? filtered : [_busRawPosition, _schoolPosition];
  }

  SnappedPosition get _snappedBus {
    final raw = _busRawPosition;
    final heading = widget.commute.vehicleLocation?.heading ?? 90.0;
    return MapSnappingEngine.snapToPolyline(
      rawPos: raw,
      polyline: _routePolylinePoints,
      defaultHeading: heading,
      thresholdMeters: 45.0,
    );
  }

  @override
  Widget build(BuildContext context) {
    final snapped = _snappedBus;
    final busPos = snapped.position;
    final stopPos = _stopPosition;
    final schoolPos = _schoolPosition;
    final routePoints = _routePolylinePoints;

    return Stack(
      children: [
        FlutterMap(
          mapController: _mapController,
          options: MapOptions(
            initialCenter: _busRawPosition,
            initialZoom: 14.2,
            minZoom: 10.0,
            maxZoom: 18.0,
            cameraConstraint: const CameraConstraint.unconstrained(),
            interactionOptions: const InteractionOptions(
              flags: InteractiveFlag.all,
            ),
          ),
          children: [
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'ca.pcytech.parentapp',
              maxZoom: 19,
            ),
            MarkerLayer(
              markers: [
                // 1. Student Stop Pin Marker (Drawn first so active Bus Marker is on top when overlapping)
                Marker(
                  point: stopPos,
                  width: 100,
                  height: 68,
                  alignment: Alignment.center,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.success,
                          borderRadius: BorderRadius.circular(6),
                          boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 4)],
                        ),
                        child: const Text(
                          'Pickup Stop',
                          style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Container(
                        width: 30,
                        height: 30,
                        decoration: BoxDecoration(
                          color: AppColors.success,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2),
                          boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 6)],
                        ),
                        child: const Icon(Icons.person_pin_circle_rounded, size: 18, color: Colors.white),
                      ),
                    ],
                  ),
                ),

                // 2. Bus Marker (Road-snapped coordinate and tangent orientation, on top)
                Marker(
                  point: busPos,
                  width: 86,
                  height: 70,
                  alignment: Alignment.center,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.secondary,
                          borderRadius: BorderRadius.circular(6),
                          boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 4)],
                        ),
                        child: Text(
                          'Bus #${widget.commute.busUnitNumber.isNotEmpty ? widget.commute.busUnitNumber : '42'}',
                          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2),
                          boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 6)],
                        ),
                        child: Transform.rotate(
                          angle: (snapped.bearingDegrees * (math.pi / 180)),
                          child: const Icon(Icons.navigation_rounded, size: 18, color: Colors.white),
                        ),
                      ),
                    ],
                  ),
                ),

                // 3. School Destination Marker
                Marker(
                  point: schoolPos,
                  width: 120,
                  height: 72,
                  alignment: Alignment.center,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1E293B),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: const Color(0xFFFBBF24), width: 1.2),
                          boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 4)],
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Text('🏫', style: TextStyle(fontSize: 10)),
                            const SizedBox(width: 3),
                            Flexible(
                              child: Text(
                                widget.commute.schoolName.isNotEmpty ? widget.commute.schoolName : 'School',
                                style: const TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 2),
                      Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: const Color(0xFFD97706),
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2),
                          boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 6)],
                        ),
                        child: const Icon(Icons.school_rounded, size: 18, color: Colors.white),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),

        // Road polyline overlay (outside FlutterMap layers so it can never be culled/clipped by them)
        Positioned.fill(
          child: RoadPolylineLayer(
            points: routePoints,
            mapController: _mapController,
            borderColor: const Color(0xFF0F172A),
            borderStrokeWidth: 9.0,
            casingColor: Colors.white,
            casingStrokeWidth: 7.0,
            color: const Color(0xFF2563EB),
            strokeWidth: 4.5,
          ),
        ),

        // Map Control Floating Buttons (Recenter / Focus)
        Positioned(
          right: 14,
          top: 110,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              FloatingActionButton.small(
                heroTag: 'recenter_route',
                backgroundColor: Colors.white,
                foregroundColor: AppColors.primary,
                tooltip: 'Focus Full Route',
                onPressed: _fitRouteBounds,
                child: const Icon(Icons.alt_route_rounded, size: 18),
              ),
              const SizedBox(height: 6),
              FloatingActionButton.small(
                heroTag: 'recenter_bus',
                backgroundColor: Colors.white,
                foregroundColor: AppColors.primary,
                tooltip: 'Focus Bus',
                onPressed: () {
                  _mapController.move(LatLng(busPos.latitude - 0.0035, busPos.longitude), 14.2);
                },
                child: const Icon(Icons.directions_bus_rounded, size: 18),
              ),
              const SizedBox(height: 6),
              FloatingActionButton.small(
                heroTag: 'recenter_stop',
                backgroundColor: Colors.white,
                foregroundColor: AppColors.success,
                tooltip: 'Focus Stop',
                onPressed: () {
                  _mapController.move(LatLng(stopPos.latitude - 0.0035, stopPos.longitude), 14.2);
                },
                child: const Icon(Icons.pin_drop_rounded, size: 18),
              ),
              const SizedBox(height: 6),
              FloatingActionButton.small(
                heroTag: 'recenter_school',
                backgroundColor: Colors.white,
                foregroundColor: const Color(0xFFD97706),
                tooltip: 'Focus School',
                onPressed: () {
                  _mapController.move(LatLng(schoolPos.latitude - 0.0035, schoolPos.longitude), 14.2);
                },
                child: const Icon(Icons.school_rounded, size: 18),
              ),
            ],
          ),
        ),
        // Active Route Status Chip on top
        Positioned(
          top: 150,
          left: 14,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFF0F172A).withValues(alpha: 0.88),
              borderRadius: BorderRadius.circular(20),
              boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 6, offset: Offset(0, 2))],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: Color(0xFF2563EB),
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  'Route: ${widget.commute.routeNo.isNotEmpty ? widget.commute.routeNo : 'Active Corridor'}',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// Robust Direct Road Polyline Layer that converts coordinates directly via [MapCamera.latLngToScreenOffset]
/// Completely avoids Web multi-world wrapping, infinite loop assertion bugs, and layer culling drops.
class RoadPolylineLayer extends StatefulWidget {
  final List<LatLng> points;
  final MapController mapController;
  final Color borderColor;
  final double borderStrokeWidth;
  final Color casingColor;
  final double casingStrokeWidth;
  final Color color;
  final double strokeWidth;

  const RoadPolylineLayer({
    super.key,
    required this.points,
    required this.mapController,
    this.borderColor = const Color(0xFF0F172A),
    this.borderStrokeWidth = 9.0,
    this.casingColor = Colors.white,
    this.casingStrokeWidth = 7.0,
    this.color = const Color(0xFF2563EB),
    this.strokeWidth = 4.5,
  });

  @override
  State<RoadPolylineLayer> createState() => _RoadPolylineLayerState();
}

class _RoadPolylineLayerState extends State<RoadPolylineLayer> {
  StreamSubscription? _sub;

  @override
  void initState() {
    super.initState();
    _sub = widget.mapController.mapEventStream.listen((_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void didUpdateWidget(covariant RoadPolylineLayer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.mapController != widget.mapController) {
      _sub?.cancel();
      _sub = widget.mapController.mapEventStream.listen((_) {
        if (mounted) setState(() {});
      });
    }
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.points.length < 2) return const SizedBox.shrink();
    // Overlay drawn OUTSIDE FlutterMap's layer stack (no OverflowBox / layer transformer),
    // projecting through the controller's live camera.
    final camera = widget.mapController.camera;
    // Positioned.fill is applied by the caller (never return Positioned from a widget on Web release).
    return IgnorePointer(
      child: CustomPaint(
        painter: _DirectRoadPolylinePainter(
          camera: camera,
          points: widget.points,
          borderColor: widget.borderColor,
          borderStrokeWidth: widget.borderStrokeWidth,
          casingColor: widget.casingColor,
          casingStrokeWidth: widget.casingStrokeWidth,
          color: widget.color,
          strokeWidth: widget.strokeWidth,
        ),
        child: const SizedBox.expand(),
      ),
    );
  }
}

class _DirectRoadPolylinePainter extends CustomPainter {
  final MapCamera camera;
  final List<LatLng> points;
  final Color borderColor;
  final double borderStrokeWidth;
  final Color casingColor;
  final double casingStrokeWidth;
  final Color color;
  final double strokeWidth;

  _DirectRoadPolylinePainter({
    required this.camera,
    required this.points,
    required this.borderColor,
    required this.borderStrokeWidth,
    required this.casingColor,
    required this.casingStrokeWidth,
    required this.color,
    required this.strokeWidth,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (points.length < 2) return;

    final path = ui.Path();
    bool started = false;
    for (int i = 0; i < points.length; i++) {
      final offset = camera.latLngToScreenOffset(points[i]);
      if (!offset.dx.isFinite || !offset.dy.isFinite) continue;
      if (!started) {
        path.moveTo(offset.dx, offset.dy);
        started = true;
      } else {
        path.lineTo(offset.dx, offset.dy);
      }
    }
    if (!started) return;

    // Layer 1: Dark Navy outer shadow/border (9.0px) - stark contrast against light OSM roads
    final borderPaint = Paint()
      ..color = borderColor
      ..strokeWidth = borderStrokeWidth
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(path, borderPaint);

    // Layer 2: Clean white inner casing (7.0px) - separates navy from blue
    final casingPaint = Paint()
      ..color = casingColor
      ..strokeWidth = casingStrokeWidth
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(path, casingPaint);

    // Layer 3: Vibrant Royal Blue navigation corridor (4.5px)
    final corePaint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(path, corePaint);
  }

  @override
  bool shouldRepaint(_DirectRoadPolylinePainter oldDelegate) => true;
}

