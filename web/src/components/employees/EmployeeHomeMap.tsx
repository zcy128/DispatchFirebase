import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  ExternalLink,
  Layers,
  LocateFixed,
  Loader2,
  Home
} from 'lucide-react';
import { Employee } from '../../types/employee';
import {
  EmployeeHomeLocation,
  buildGoogleMapsSearchUrl,
  geocodeEmployeeAddress,
  getEmployeeHomeAddressText,
  resolveInitialEmployeeLocation
} from '../../utils/employeeHomeGeo';

interface EmployeeHomeMapProps {
  employee: Employee;
  height?: string;
  onEditAddress?: () => void;
}

type HomeMapLayer = 'roadmap' | 'satellite' | 'osm';

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getTileConfig(layer: HomeMapLayer): {
  url: string;
  subdomains: string[];
  attribution: string;
} {
  if (layer === 'satellite') {
    return {
      url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      subdomains: ['0', '1', '2', '3'],
      attribution: '&copy; Google Maps',
    };
  }
  if (layer === 'osm') {
    return {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      subdomains: ['a', 'b', 'c'],
      attribution: '&copy; OpenStreetMap contributors',
    };
  }
  return {
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    attribution: '&copy; Google Maps',
  };
}

/**
 * Interactive map card displaying an employee's home residence location.
 */
export const EmployeeHomeMap: React.FC<EmployeeHomeMapProps> = ({
  employee,
  height = '220px',
  onEditAddress,
}) => {
  const initialLocation = useMemo(
    () => resolveInitialEmployeeLocation(employee),
    [employee]
  );

  const [location, setLocation] = useState<EmployeeHomeLocation | null>(initialLocation);
  const [geocoding, setGeocoding] = useState(false);
  const [mapLayer, setMapLayer] = useState<HomeMapLayer>('roadmap');

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const addressText = useMemo(
    () => getEmployeeHomeAddressText(employee),
    [employee]
  );

  // Sync initial location and geocode street address when exact lat/lng is absent
  useEffect(() => {
    const syncLoc = resolveInitialEmployeeLocation(employee);
    setLocation(syncLoc);

    if (!syncLoc || syncLoc.source !== 'estimated' || !syncLoc.addressText) {
      setGeocoding(false);
      return;
    }

    const controller = new AbortController();
    setGeocoding(true);

    geocodeEmployeeAddress(syncLoc.addressText, controller.signal)
      .then((point) => {
        if (controller.signal.aborted || !point) return;
        setLocation({
          lat: point.lat,
          lng: point.lng,
          source: 'geocoded',
          addressText: syncLoc.addressText,
        });
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setGeocoding(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [employee]);

  // Initialize Leaflet map instance
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !location) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const initialZoom = location.source === 'estimated' ? 13 : 15;
    const map = L.map(container, {
      center: [location.lat, location.lng],
      zoom: initialZoom,
      zoomControl: true,
      attributionControl: true,
    });

    const tileCfg = getTileConfig(mapLayer);
    const tileLayer = L.tileLayer(tileCfg.url, {
      subdomains: tileCfg.subdomains,
      attribution: tileCfg.attribution,
      maxZoom: 20,
    }).addTo(map);

    mapRef.current = map;
    tileLayerRef.current = tileLayer;

    // Re-validate dimensions after slide-over drawer transition finishes
    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 260);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        map.invalidateSize();
      });
      observer.observe(container);
    }

    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      markerRef.current = null;
    };
  }, [employee.id, Boolean(location)]);

  // Switch tile layer dynamically without tearing down the map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    const cfg = getTileConfig(mapLayer);
    tileLayerRef.current = L.tileLayer(cfg.url, {
      subdomains: cfg.subdomains,
      attribution: cfg.attribution,
      maxZoom: 20,
    }).addTo(map);
  }, [mapLayer]);

  // Update home marker & camera center whenever coordinates resolve
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !location) return;

    if (markerRef.current) {
      map.removeLayer(markerRef.current);
      markerRef.current = null;
    }

    const icon = L.divIcon({
      className: 'employee-home-pin',
      html: `
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">
          <div style="background:#e11d48;color:#fff;width:30px;height:30px;border-radius:9999px;border:2.5px solid #fff;box-shadow:0 4px 12px rgba(225,29,72,0.55);display:flex;align-items:center;justify-content:center;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/>
              <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            </svg>
          </div>
          <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid #fff;margin-top:-1px;"></div>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
      popupAnchor: [0, -34],
    });

    const marker = L.marker([location.lat, location.lng], { icon }).addTo(map);
    const safeName = escapeHtml(employee.fullName || 'Employee');
    const safeAddr = escapeHtml(location.addressText || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`);
    marker.bindPopup(
      `<div style="font-family:system-ui,sans-serif;min-width:160px;">
        <div style="font-weight:700;font-size:12px;color:#0f172a;margin-bottom:2px;">${safeName}</div>
        <div style="font-size:11px;color:#475569;">${safeAddr}</div>
      </div>`
    );

    markerRef.current = marker;
    const zoom = location.source === 'estimated' ? 13 : 15;
    map.setView([location.lat, location.lng], zoom, { animate: true });
  }, [location, employee.fullName]);

  const handleRecenter = () => {
    if (!mapRef.current || !location) return;
    const zoom = location.source === 'estimated' ? 13 : 15;
    mapRef.current.setView([location.lat, location.lng], zoom, { animate: true });
    markerRef.current?.openPopup();
  };

  const cycleLayer = () => {
    setMapLayer((prev) =>
      prev === 'roadmap' ? 'satellite' : prev === 'satellite' ? 'osm' : 'roadmap'
    );
  };

  const googleMapsUrl = useMemo(
    () => buildGoogleMapsSearchUrl(employee, location),
    [employee, location]
  );

  if (!location) {
    return (
      <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-4 flex flex-col items-center justify-center text-center space-y-2">
        <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
          <MapPin className="w-4 h-4" />
        </div>
        <p className="text-xs text-slate-400">
          No home address or GPS coordinates recorded for this employee.
        </p>
        {onEditAddress && (
          <button
            type="button"
            onClick={onEditAddress}
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 underline cursor-pointer"
          >
            Add Home Address
          </button>
        )}
      </div>
    );
  }

  const sourceBadge =
    location.source === 'exact'
      ? { label: 'Exact GPS', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' }
      : location.source === 'geocoded'
      ? { label: 'Street Geocoded', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' }
      : { label: 'Estimated Area', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };

  return (
    <div className="rounded-xl overflow-hidden border border-slate-700/70 bg-slate-950/60">
      {/* Top address & status bar */}
      <div className="px-3.5 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2 min-w-0">
          <Home className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span
            className="text-xs font-medium text-slate-200 truncate"
            title={addressText || `${location.lat}, ${location.lng}`}
          >
            {addressText || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`}
          </span>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0">
          {geocoding && (
            <span className="inline-flex items-center space-x-1 text-[10px] text-sky-300">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Locating</span>
            </span>
          )}
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${sourceBadge.cls}`}
          >
            {sourceBadge.label}
          </span>
        </div>
      </div>

      {/* Interactive map canvas */}
      <div className="relative" style={{ height }}>
        <div ref={containerRef} className="w-full h-full z-0" />

        {/* Map overlay controls */}
        <div className="absolute top-2.5 right-2.5 z-[400] flex items-center space-x-1.5">
          <button
            type="button"
            onClick={cycleLayer}
            title={`Switch map layer (current: ${mapLayer})`}
            className="px-2 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 shadow text-[10px] font-semibold flex items-center space-x-1 backdrop-blur-xs cursor-pointer"
          >
            <Layers className="w-3 h-3 text-amber-400" />
            <span className="uppercase">{mapLayer}</span>
          </button>

          <button
            type="button"
            onClick={handleRecenter}
            title="Center map on home pin"
            className="p-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 shadow backdrop-blur-xs cursor-pointer"
          >
            <LocateFixed className="w-3.5 h-3.5 text-rose-400" />
          </button>
        </div>
      </div>

      {/* Footer coordinates & Google Maps external link */}
      <div className="px-3.5 py-2 bg-slate-900/80 border-t border-slate-800 flex items-center justify-between text-[11px]">
        <span className="font-mono text-slate-400">
          {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
        </span>

        {googleMapsUrl && (
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1 text-sky-400 hover:text-sky-300 font-semibold transition"
          >
            <span>Open in Google Maps</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
};
