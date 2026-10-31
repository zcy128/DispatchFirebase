import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';
import '../theme.dart';

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
}

enum GoogleMapLayerType {
  road,
  traffic,
  satellite,
}

class GoogleRouteMapCard extends StatefulWidget {
  final String routeTitle;
  final String shiftLabel;
  final List<MapStopPin> stops;
  final int? focusedStopSequence;
  final ValueChanged<MapStopPin>? onStopSelected;
  final bool initiallyExpanded;
  final double mapHeight;

  const GoogleRouteMapCard({
    super.key,
    required this.routeTitle,
    required this.shiftLabel,
    required this.stops,
    this.focusedStopSequence,
    this.onStopSelected,
    this.initiallyExpanded = true,
    this.mapHeight = 280,
  });

  /// Resolves stop coordinates using explicit lat/lng or Ottawa landmark & corridor interpolation.
  static LatLng resolveStopCoordinate(MapStopPin stop, int totalStops) {
    if (stop.latitude != null &&
        stop.longitude != null &&
        stop.latitude != 0 &&
        stop.longitude != 0 &&
        !stop.latitude!.isNaN &&
        !stop.longitude!.isNaN) {
      return LatLng(stop.latitude!, stop.longitude!);
    }

    final loc = '${stop.title} ${stop.subtitle}'.toLowerCase();
    final sch = (stop.schoolNameHint ?? (stop.isSchoolStop ? stop.title : '')).toLowerCase();

    // 1. Direct Ottawa landmarks & known street intersections
    if (loc.contains('baseline') && loc.contains('woodroffe')) {
      return const LatLng(45.35125, -75.76015);
    }
    if (loc.contains('woodroffe') && loc.contains('richmond')) {
      return const LatLng(45.3685, -75.7572);
    }
    if (loc.contains('carling') && (loc.contains('broadview') || loc.contains('woodroffe'))) {
      return const LatLng(45.3724, -75.7589);
    }
    if (loc.contains('fraser') || loc.contains('450 fraser')) {
      return const LatLng(45.3881, -75.7482);
    }
    if (loc.contains('merivale')) {
      return const LatLng(45.3512, -75.7601);
    }
    if (loc.contains('oak st')) {
      return const LatLng(45.3750, -75.7450);
    }
    if (loc.contains('pine rd')) {
      return const LatLng(45.3690, -75.7520);
    }
    if (loc.contains('dauphin') || loc.contains('hillcrest')) {
      return const LatLng(45.4050, -75.6420);
    }
    if (loc.contains('cedar blvd') || loc.contains('gloucester')) {
      return const LatLng(45.3850, -75.7150);
    }
    if (loc.contains('orleans')) {
      return const LatLng(45.4350, -75.6850);
    }
    if (loc.contains('kanata')) {
      return const LatLng(45.3350, -75.7850);
    }
    if (loc.contains('nepean') && loc.contains('maple')) {
      return const LatLng(45.3650, -75.7350);
    }

    // 2. School destinations
    if (loc.contains('broadview') || sch.contains('broadview')) {
      return const LatLng(45.37896, -75.76102);
    }
    if (loc.contains('nepean') || sch.contains('nepean')) {
      return const LatLng(45.38552, -75.75485);
    }
    if (loc.contains('patrick') || sch.contains('patrick')) {
      return const LatLng(45.4120, -75.6890);
    }
    if (loc.contains('westbrook') || sch.contains('westbrook')) {
      return const LatLng(45.3620, -75.7480);
    }

    // 3. Transit corridor interpolation between depot and destination school
    double destLat = 45.37896;
    double destLng = -75.76102;
    if (sch.contains('nepean')) {
      destLat = 45.38552;
      destLng = -75.75485;
    } else if (sch.contains('hillcrest') || loc.contains('hillcrest')) {
      destLat = 45.4050;
      destLng = -75.6420;
    }

    const startLat = 45.3485;
    const startLng = -75.7680;

    final seq = stop.sequence < 1 ? 1 : stop.sequence;
    final maxSeq = totalStops < 2 ? 7 : totalStops;
    final rawFraction = (seq - 1) / (maxSeq - 1);
    final fraction = rawFraction.clamp(0.1, 0.9);

    final scatterLat = (((seq * 13) % 7) - 3) * 0.0022;
    final scatterLng = (((seq * 17) % 7) - 3) * 0.0028;

    final lat = ((startLat + fraction * (destLat - startLat) + scatterLat) * 1e5).roundToDouble() / 1e5;
    final lng = ((startLng + fraction * (destLng - startLng) + scatterLng) * 1e5).roundToDouble() / 1e5;

    return LatLng(lat, lng);
  }

  @override
  State<GoogleRouteMapCard> createState() => _GoogleRouteMapCardState();
}

class _GoogleRouteMapCardState extends State<GoogleRouteMapCard> {
  final MapController _mapController = MapController();
  late bool _isExpanded;
  GoogleMapLayerType _layerType = GoogleMapLayerType.road;
  int? _selectedSequence;
  List<LatLng> _roadPath = const [];
  String _lastCoordsSignature = '';

  // Simulated GPS Vehicle Telematics
  Timer? _telematicsTimer;
  LatLng? _vehicleLocation;
  double _vehicleHeading = 0.0;
  int _vehicleSpeedKmH = 40;
  String _vehicleStatus = 'en_route';
  int _vehiclePathIndex = 0;
  int _boardingPauseTicks = 0;

  @override
  void initState() {
    super.initState();
    _isExpanded = widget.initiallyExpanded;
    _selectedSequence = widget.focusedStopSequence;
    _refreshRoadGeometry();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Future.delayed(const Duration(milliseconds: 250), () {
        if (mounted && _isExpanded) {
          _fitAllStops();
        }
      });
    });
  }

  @override
  void dispose() {
    _telematicsTimer?.cancel();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant GoogleRouteMapCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    _refreshRoadGeometry();
    if (widget.focusedStopSequence != null &&
        widget.focusedStopSequence != oldWidget.focusedStopSequence) {
      _selectedSequence = widget.focusedStopSequence;
      _focusStopBySequence(widget.focusedStopSequence!);
    }
  }

  List<MapEntry<MapStopPin, LatLng>> get _resolvedStops {
    final total = widget.stops.length;
    return widget.stops
        .map((s) => MapEntry(s, GoogleRouteMapCard.resolveStopCoordinate(s, total)))
        .toList();
  }

  void _refreshRoadGeometry() {
    final resolved = _resolvedStops;
    final sig = resolved
        .map((e) => '${e.value.latitude.toStringAsFixed(5)},${e.value.longitude.toStringAsFixed(5)}')
        .join('|');
    if (sig == _lastCoordsSignature) return;
    _lastCoordsSignature = sig;

    final fallbackPoints = resolved.map((e) => e.value).toList();
    setState(() {
      _roadPath = fallbackPoints;
    });

    _initVehicleSimulation();

    if (resolved.length >= 2) {
      _fetchOsrmRoadPath(resolved.map((e) => e.value).toList());
    }
  }

  Future<void> _fetchOsrmRoadPath(List<LatLng> waypoints) async {
    try {
      final coordStr = waypoints
          .map((p) => '${p.longitude.toStringAsFixed(5)},${p.latitude.toStringAsFixed(5)}')
          .join(';');
      final uri = Uri.parse(
        'https://router.project-osrm.org/route/v1/driving/$coordStr?overview=full&geometries=geojson',
      );
      final res = await http.get(uri).timeout(const Duration(seconds: 6));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final routes = data['routes'] as List?;
        if (routes != null && routes.isNotEmpty) {
          final coords = routes.first['geometry']?['coordinates'] as List?;
          if (coords != null && coords.length >= 2) {
            final parsed = <LatLng>[];
            for (final c in coords) {
              if (c is List && c.length >= 2) {
                final lng = (c[0] as num).toDouble();
                final lat = (c[1] as num).toDouble();
                parsed.add(LatLng(lat, lng));
              }
            }
            if (mounted && parsed.length >= 2) {
              setState(() {
                _roadPath = parsed;
              });
              _initVehicleSimulation();
            }
          }
        }
      }
    } catch (_) {
      // Keep direct stop-to-stop polyline fallback if OSRM is unreachable
    }
  }

  void _initVehicleSimulation() {
    _telematicsTimer?.cancel();
    if (_roadPath.length < 2) return;

    final resolved = _resolvedStops;
    int initialPathIdx = 0;

    // Check completed stops to place bus accurately
    int lastCompletedStopIdx = -1;
    for (int i = 0; i < resolved.length; i++) {
      if (resolved[i].key.isCompleted) {
        lastCompletedStopIdx = i;
      }
    }

    if (lastCompletedStopIdx >= 0 && lastCompletedStopIdx < resolved.length - 1) {
      final stopCoord = resolved[lastCompletedStopIdx].value;
      double minD = double.infinity;
      for (int i = 0; i < _roadPath.length; i++) {
        final d = (stopCoord.latitude - _roadPath[i].latitude).abs() +
            (stopCoord.longitude - _roadPath[i].longitude).abs();
        if (d < minD) {
          minD = d;
          initialPathIdx = i;
        }
      }
      initialPathIdx = (initialPathIdx + 2) % _roadPath.length;
    }

    _vehiclePathIndex = initialPathIdx;
    _vehicleLocation = _roadPath[initialPathIdx];
    _vehicleSpeedKmH = 40;
    _vehicleStatus = 'en_route';

    _telematicsTimer = Timer.periodic(const Duration(milliseconds: 1300), (_) {
      if (!mounted || _roadPath.length < 2) return;

      if (_boardingPauseTicks > 0) {
        setState(() {
          _boardingPauseTicks--;
          _vehicleSpeedKmH = 0;
          _vehicleStatus = 'at_stop';
        });
        return;
      }

      final nextIdx = (_vehiclePathIndex + 1) % _roadPath.length;
      final p1 = _roadPath[_vehiclePathIndex];
      final p2 = _roadPath[nextIdx];

      final dLng = (p2.longitude - p1.longitude) * math.pi / 180.0;
      final y = math.sin(dLng) * math.cos(p2.latitude * math.pi / 180.0);
      final x = math.cos(p1.latitude * math.pi / 180.0) * math.sin(p2.latitude * math.pi / 180.0) -
          math.sin(p1.latitude * math.pi / 180.0) * math.cos(p2.latitude * math.pi / 180.0) * math.cos(dLng);
      final bearing = (math.atan2(y, x) * 180.0 / math.pi + 360.0) % 360.0;

      // Check proximity to any stop
      for (final st in resolved) {
        final diff = (p2.latitude - st.value.latitude).abs() +
            (p2.longitude - st.value.longitude).abs();
        if (diff < 0.0003 && st.key.sequence > 1) {
          _boardingPauseTicks = 3;
          break;
        }
      }

      setState(() {
        _vehiclePathIndex = nextIdx;
        _vehicleLocation = p2;
        _vehicleHeading = bearing;
        _vehicleSpeedKmH = _boardingPauseTicks > 0
            ? 0
            : (36 + (_vehiclePathIndex % 7) * 2);
        _vehicleStatus = _boardingPauseTicks > 0 ? 'at_stop' : 'en_route';
      });
    });
  }

  void _fitAllStops() {
    if (!mounted || !_isExpanded) return;
    final resolved = _resolvedStops;
    if (resolved.isEmpty) return;

    try {
      if (resolved.length == 1) {
        _mapController.move(resolved.first.value, 14.5);
        return;
      }

      double minLat = resolved.first.value.latitude;
      double maxLat = resolved.first.value.latitude;
      double minLng = resolved.first.value.longitude;
      double maxLng = resolved.first.value.longitude;

      for (final item in resolved) {
        final p = item.value;
        if (p.latitude < minLat) minLat = p.latitude;
        if (p.latitude > maxLat) maxLat = p.latitude;
        if (p.longitude < minLng) minLng = p.longitude;
        if (p.longitude > maxLng) maxLng = p.longitude;
      }

      final center = LatLng((minLat + maxLat) / 2.0, (minLng + maxLng) / 2.0);
      final span = ((maxLat - minLat).abs() > (maxLng - minLng).abs())
          ? (maxLat - minLat).abs()
          : (maxLng - minLng).abs();

      double zoom = 13.0;
      if (span > 0.12) {
        zoom = 11.2;
      } else if (span > 0.06) {
        zoom = 12.2;
      } else if (span > 0.03) {
        zoom = 13.0;
      } else {
        zoom = 13.8;
      }

      _mapController.move(center, zoom);
    } catch (_) {}
  }

  void _focusStopBySequence(int sequence) {
    final resolved = _resolvedStops;
    for (final entry in resolved) {
      if (entry.key.sequence == sequence) {
        if (!_isExpanded) {
          setState(() => _isExpanded = true);
        }
        WidgetsBinding.instance.addPostFrameCallback((_) {
          try {
            _mapController.move(entry.value, 15.5);
          } catch (_) {}
        });
        break;
      }
    }
  }

  String get _googleTileUrl {
    switch (_layerType) {
      case GoogleMapLayerType.road:
        return 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
      case GoogleMapLayerType.traffic:
        return 'https://mt1.google.com/vt/lyrs=m,traffic&x={x}&y={y}&z={z}';
      case GoogleMapLayerType.satellite:
        return 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
    }
  }

  Future<void> _openFullRouteInGoogleMaps() async {
    final resolved = _resolvedStops;
    if (resolved.isEmpty) return;

    final origin = '${resolved.first.value.latitude},${resolved.first.value.longitude}';
    final destination = '${resolved.last.value.latitude},${resolved.last.value.longitude}';
    String waypointsParam = '';
    if (resolved.length > 2) {
      final middle = resolved
          .sublist(1, resolved.length - 1)
          .take(8)
          .map((e) => '${e.value.latitude},${e.value.longitude}')
          .join('|');
      waypointsParam = '&waypoints=${Uri.encodeComponent(middle)}';
    }

    final url = Uri.parse(
      'https://www.google.com/maps/dir/?api=1&origin=$origin&destination=$destination$waypointsParam&travelmode=driving',
    );
    await _launchMapsUrl(url);
  }

  Future<void> _openSingleStopInGoogleMaps(MapStopPin stop, LatLng coord) async {
    final url = Uri.parse(
      'https://www.google.com/maps/dir/?api=1&destination=${coord.latitude},${coord.longitude}&travelmode=driving',
    );
    await _launchMapsUrl(url);
  }

  Future<void> _launchMapsUrl(Uri url) async {
    try {
      final launched = await launchUrl(
        url,
        mode: LaunchMode.platformDefault,
        webOnlyWindowName: '_blank',
      );
      if (!launched && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Could not open Google Maps: $url'),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Unable to launch navigation: $e'),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final resolved = _resolvedStops;
    final selectedEntry = resolved.where((e) => e.key.sequence == _selectedSequence).firstOrNull;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.25 : 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header Bar
          InkWell(
            onTap: () {
              setState(() => _isExpanded = !_isExpanded);
              if (_isExpanded) {
                WidgetsBinding.instance.addPostFrameCallback((_) => _fitAllStops());
              }
            },
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(7),
                    decoration: BoxDecoration(
                      color: const Color(0xFF4285F4).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(9),
                    ),
                    child: const Icon(
                      Icons.map_rounded,
                      size: 18,
                      color: Color(0xFF4285F4),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Text(
                              'Google Maps',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF4285F4),
                              ),
                            ),
                            const SizedBox(width: 6),
                            Flexible(
                              child: Text(
                                '· ${widget.routeTitle} (${widget.shiftLabel})',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: isDark ? Colors.white : AppColors.textPrimaryLight,
                                ),
                              ),
                            ),
                          ],
                        ),
                        Text(
                          _vehicleLocation != null
                              ? '${resolved.length} Stops · Demo GPS: ${_vehicleSpeedKmH > 0 ? "$_vehicleSpeedKmH km/h" : "Boarding"}'
                              : '${resolved.length} Stops · Tap any pin or stop to preview & navigate',
                          style: TextStyle(
                            fontSize: 10.5,
                            fontWeight: _vehicleLocation != null ? FontWeight.w600 : FontWeight.normal,
                            color: _vehicleLocation != null
                                ? const Color(0xFFF59E0B)
                                : (isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (resolved.isNotEmpty)
                    TextButton.icon(
                      onPressed: _openFullRouteInGoogleMaps,
                      icon: const Icon(Icons.directions_rounded, size: 15),
                      label: const Text('Navigate', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                      style: TextButton.styleFrom(
                        foregroundColor: const Color(0xFF4285F4),
                        backgroundColor: const Color(0xFF4285F4).withValues(alpha: 0.12),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                  const SizedBox(width: 4),
                  Icon(
                    _isExpanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                    color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                  ),
                ],
              ),
            ),
          ),

          if (_isExpanded) ...[
            const Divider(height: 1),
            if (resolved.isEmpty)
              SizedBox(
                height: 160,
                child: Center(
                  child: Text(
                    'No stops available to display on Google Maps.',
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                    ),
                  ),
                ),
              )
            else
              SizedBox(
                height: widget.mapHeight,
                child: Stack(
                  children: [
                    FlutterMap(
                      mapController: _mapController,
                      options: MapOptions(
                        initialCenter: resolved.first.value,
                        initialZoom: 13.0,
                        minZoom: 9.0,
                        maxZoom: 19.0,
                        onTap: (_, _) {
                          setState(() => _selectedSequence = null);
                        },
                      ),
                      children: [
                        TileLayer(
                          urlTemplate: _googleTileUrl,
                          userAgentPackageName: 'ca.pcytech.driverapp',
                          maxZoom: 19,
                        ),
                        if (_roadPath.length >= 2)
                          PolylineLayer(
                            polylines: [
                              Polyline(
                                points: _roadPath,
                                strokeWidth: 6.5,
                                color: const Color(0xFF1E3A8A).withValues(alpha: 0.35),
                              ),
                              Polyline(
                                points: _roadPath,
                                strokeWidth: 4.2,
                                color: const Color(0xFF2563EB),
                              ),
                            ],
                          ),
                        MarkerLayer(
                          markers: [
                            ...resolved.map((entry) {
                              final stop = entry.key;
                              final coord = entry.value;
                              final isSelected = _selectedSequence == stop.sequence;
                              final Color pinColor = stop.isCompleted
                                  ? AppColors.success
                                  : (stop.isSchoolStop
                                      ? const Color(0xFF7C3AED)
                                      : const Color(0xFF2563EB));

                              return Marker(
                                point: coord,
                                width: isSelected ? 46 : 36,
                                height: isSelected ? 46 : 36,
                                alignment: Alignment.center,
                                child: GestureDetector(
                                  onTap: () {
                                    setState(() => _selectedSequence = stop.sequence);
                                    _mapController.move(coord, 15.2);
                                    widget.onStopSelected?.call(stop);
                                  },
                                  child: AnimatedContainer(
                                    duration: const Duration(milliseconds: 180),
                                    width: isSelected ? 38 : 30,
                                    height: isSelected ? 38 : 30,
                                    decoration: BoxDecoration(
                                      color: pinColor,
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                        color: isSelected ? AppColors.primary : Colors.white,
                                        width: isSelected ? 3 : 2.2,
                                      ),
                                      boxShadow: const [
                                        BoxShadow(
                                          color: Colors.black38,
                                          blurRadius: 6,
                                          offset: Offset(0, 2),
                                        ),
                                      ],
                                    ),
                                    child: Center(
                                      child: stop.isSchoolStop
                                          ? const Icon(Icons.school_rounded, size: 15, color: Colors.white)
                                          : Text(
                                              '${stop.sequence}',
                                              style: TextStyle(
                                                fontSize: isSelected ? 13 : 11,
                                                fontWeight: FontWeight.w900,
                                                color: Colors.white,
                                              ),
                                            ),
                                    ),
                                  ),
                                ),
                              );
                            }),
                            // Simulated Real-Time GPS Vehicle Marker
                            if (_vehicleLocation != null)
                              Marker(
                                point: _vehicleLocation!,
                                width: 56,
                                height: 56,
                                alignment: Alignment.center,
                                child: GestureDetector(
                                  onTap: () {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(
                                          'Demo GPS, not a live bus. Speed: $_vehicleSpeedKmH km/h · Heading: ${_vehicleHeading.round()}° · Status: $_vehicleStatus',
                                        ),
                                        duration: const Duration(seconds: 2),
                                      ),
                                    );
                                  },
                                  child: Stack(
                                    alignment: Alignment.center,
                                    children: [
                                      // Pulsing radar glow
                                      Container(
                                        width: 50,
                                        height: 50,
                                        decoration: BoxDecoration(
                                          shape: BoxShape.circle,
                                          color: Colors.amber.withValues(alpha: 0.22),
                                          border: Border.all(color: Colors.amber, width: 1.5),
                                        ),
                                      ),
                                      // Heading rotation container
                                      Transform.rotate(
                                        angle: _vehicleHeading * (math.pi / 180.0),
                                        child: Container(
                                          width: 32,
                                          height: 32,
                                          decoration: BoxDecoration(
                                            color: const Color(0xFF0F172A),
                                            shape: BoxShape.circle,
                                            border: Border.all(color: Colors.white, width: 2),
                                            boxShadow: const [
                                              BoxShadow(
                                                color: Colors.black45,
                                                blurRadius: 4,
                                                offset: Offset(0, 2),
                                              ),
                                            ],
                                          ),
                                          child: const Icon(
                                            Icons.directions_bus_rounded,
                                            size: 18,
                                            color: Color(0xFFFBBF24),
                                          ),
                                        ),
                                      ),
                                      // Speed pill
                                      Positioned(
                                        bottom: 0,
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFF0F172A),
                                            borderRadius: BorderRadius.circular(4),
                                            border: Border.all(color: Colors.amber, width: 0.8),
                                          ),
                                          child: Text(
                                            'DEMO',
                                            style: const TextStyle(
                                              fontSize: 8.5,
                                              fontWeight: FontWeight.bold,
                                              color: Colors.white,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),

                    // Top-Left Layer Switcher (Road / Traffic / Satellite)
                    Positioned(
                      top: 10,
                      left: 10,
                      child: Container(
                        padding: const EdgeInsets.all(3),
                        decoration: BoxDecoration(
                          color: _slate900WithAlpha(isDark),
                          borderRadius: BorderRadius.circular(10),
                          boxShadow: const [
                            BoxShadow(color: Colors.black26, blurRadius: 6),
                          ],
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            _buildLayerChip('Road', GoogleMapLayerType.road),
                            _buildLayerChip('Traffic', GoogleMapLayerType.traffic),
                            _buildLayerChip('Satellite', GoogleMapLayerType.satellite),
                          ],
                        ),
                      ),
                    ),

                    // Top-Right Zoom & Fit All Controls
                    Positioned(
                      top: 10,
                      right: 10,
                      child: Column(
                        children: [
                          if (_vehicleLocation != null) ...[
                            _buildMapIconBtn(
                              icon: Icons.directions_bus_rounded,
                              tooltip: 'Locate Bus',
                              color: const Color(0xFFFBBF24),
                              onTap: () {
                                try {
                                  _mapController.move(_vehicleLocation!, 15.5);
                                } catch (_) {}
                              },
                            ),
                            const SizedBox(height: 6),
                          ],
                          _buildMapIconBtn(
                            icon: Icons.fit_screen_rounded,
                            tooltip: 'Fit All Stops',
                            onTap: _fitAllStops,
                          ),
                          const SizedBox(height: 6),
                          _buildMapIconBtn(
                            icon: Icons.add_rounded,
                            tooltip: 'Zoom In',
                            onTap: () {
                              try {
                                _mapController.move(
                                  _mapController.camera.center,
                                  (_mapController.camera.zoom + 1).clamp(9.0, 19.0),
                                );
                              } catch (_) {}
                            },
                          ),
                          const SizedBox(height: 6),
                          _buildMapIconBtn(
                            icon: Icons.remove_rounded,
                            tooltip: 'Zoom Out',
                            onTap: () {
                              try {
                                _mapController.move(
                                  _mapController.camera.center,
                                  (_mapController.camera.zoom - 1).clamp(9.0, 19.0),
                                );
                              } catch (_) {}
                            },
                          ),
                        ],
                      ),
                    ),

                    // Selected Stop Floating Card at Bottom of Map
                    if (selectedEntry != null)
                      Positioned(
                        left: 10,
                        right: 10,
                        bottom: 10,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                            color: isDark ? const Color(0xF20F172A) : Colors.white.withValues(alpha: 0.96),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: selectedEntry.key.isSchoolStop
                                  ? const Color(0xFF7C3AED).withValues(alpha: 0.5)
                                  : const Color(0xFF2563EB).withValues(alpha: 0.5),
                            ),
                            boxShadow: const [
                              BoxShadow(color: Colors.black26, blurRadius: 8, offset: Offset(0, 3)),
                            ],
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 30,
                                height: 30,
                                decoration: BoxDecoration(
                                  color: selectedEntry.key.isSchoolStop
                                      ? const Color(0xFF7C3AED)
                                      : const Color(0xFF2563EB),
                                  shape: BoxShape.circle,
                                ),
                                child: Center(
                                  child: Text(
                                    '${selectedEntry.key.sequence}',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      selectedEntry.key.title,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        fontSize: 12.5,
                                        fontWeight: FontWeight.bold,
                                        color: isDark ? Colors.white : AppColors.textPrimaryLight,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      '${selectedEntry.key.isSchoolStop ? 'School Stop' : 'Student Stop'} · Scheduled ${selectedEntry.key.scheduledTime}',
                                      style: TextStyle(
                                        fontSize: 10.5,
                                        color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 8),
                              IconButton(
                                onPressed: () => _openSingleStopInGoogleMaps(
                                  selectedEntry.key,
                                  selectedEntry.value,
                                ),
                                icon: const Icon(Icons.turn_right_rounded, size: 18),
                                tooltip: 'Navigate in Google Maps',
                                style: IconButton.styleFrom(
                                  backgroundColor: const Color(0xFF4285F4),
                                  foregroundColor: Colors.white,
                                  minimumSize: const Size(32, 32),
                                  padding: EdgeInsets.zero,
                                ),
                              ),
                              const SizedBox(width: 4),
                              IconButton(
                                onPressed: () => setState(() => _selectedSequence = null),
                                icon: const Icon(Icons.close_rounded, size: 16),
                                style: IconButton.styleFrom(
                                  minimumSize: const Size(28, 28),
                                  padding: EdgeInsets.zero,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
              ),
          ],
        ],
      ),
    );
  }

  Widget _buildLayerChip(String label, GoogleMapLayerType type) {
    final isSelected = _layerType == type;
    return GestureDetector(
      onTap: () => setState(() => _layerType = type),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF4285F4) : Colors.transparent,
          borderRadius: BorderRadius.circular(7),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.bold,
            color: isSelected ? Colors.white : Colors.white70,
          ),
        ),
      ),
    );
  }

  Widget _buildMapIconBtn({
    required IconData icon,
    required String tooltip,
    required VoidCallback onTap,
    Color? color,
  }) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: const Color(0xD90F172A),
        borderRadius: BorderRadius.circular(8),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.all(6),
            child: Icon(icon, size: 17, color: color ?? Colors.white),
          ),
        ),
      ),
    );
  }
}

Color _slate900WithAlpha(bool isDark) =>
    isDark ? const Color(0xD90F172A) : const Color(0xD91E293B);
