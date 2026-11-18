import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import '../models/map_stop_pin.dart';

/// Shared [TileLayer] widget for Driver and Parent fleet maps.
class FleetMapTileLayer extends StatelessWidget {
  final FleetMapLayerType layerType;
  final String userAgentPackageName;

  const FleetMapTileLayer({
    super.key,
    this.layerType = FleetMapLayerType.road,
    this.userAgentPackageName = 'ca.pcy.fleet',
  });

  String get _urlTemplate {
    switch (layerType) {
      case FleetMapLayerType.satellite:
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case FleetMapLayerType.traffic:
      case FleetMapLayerType.road:
        return 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    }
  }

  @override
  Widget build(BuildContext context) {
    return TileLayer(
      urlTemplate: _urlTemplate,
      userAgentPackageName: userAgentPackageName,
    );
  }
}
