import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, ShieldCheck, MapPin, Clock, School as SchoolIcon, Bus } from 'lucide-react';
import { RouteService } from '../../services/routeService';
import { BusRouteShift } from '../../types/route';
import { sanitizeStopsForPublicViewing } from '../../utils/stopSanitizer';
import { RouteOpening, SanitizedStopPreview } from '../../types/routeOpening';
import { CharterService } from '../../services/charterService';
import { formatCharterStopTime, addMinutesToCharterTime } from '../../types/charter';
import { useI18n } from '../../contexts/I18nContext';

interface RouteOpeningStopPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  routeId: string;
  routeNo: string;
  routeName?: string;
  opening?: RouteOpening;
}

export const RouteOpeningStopPreviewModal: React.FC<RouteOpeningStopPreviewModalProps> = ({
  isOpen,
  onClose,
  routeId,
  routeNo,
  routeName,
  opening
}) => {
  const { t } = useI18n();
  const [shifts, setShifts] = useState<BusRouteShift[]>([]);
  const [charterStops, setCharterStops] = useState<SanitizedStopPreview[]>([]);
  const [selectedShiftIndex, setSelectedShiftIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Load shifts for route or charter stops
  useEffect(() => {
    if (!isOpen || !routeId) {
      setShifts([]);
      setCharterStops([]);
      setSelectedShiftIndex(0);
      return;
    }

    let isCancelled = false;
    setLoading(true);

    if (opening?.postingType === 'charter' || (opening?.sanitizedStops && opening.sanitizedStops.length > 0)) {
      if (opening.sanitizedStops && opening.sanitizedStops.length > 0) {
        if (opening.postingType === 'charter' && opening.sanitizedStops.length === 3) {
          const s0 = opening.sanitizedStops[0];
          const s1 = opening.sanitizedStops[1];
          const s2 = opening.sanitizedStops[2];
          const t0 = formatCharterStopTime(s0.stopScheduleTime) || formatCharterStopTime(opening.departsAt) || '08:00';
          const t1 = addMinutesToCharterTime(t0, 30);
          const t2 = formatCharterStopTime(s2.stopScheduleTime) || formatCharterStopTime(opening.returnsAt) || '15:00';
          const t3 = addMinutesToCharterTime(t2, 30);
          setCharterStops([
            { ...s0, sequence: 1, stopScheduleTime: t0 },
            { ...s1, sequence: 2, stopScheduleTime: t1 },
            {
              ...s1,
              stopId: 'stop-3',
              sequence: 3,
              stopLocation: s1.stopLocation.replace(/^Destination/i, 'Return Pickup'),
              stopScheduleTime: t2,
              stopType: 'CharterPickup',
            },
            {
              ...s2,
              stopId: 'stop-4',
              sequence: 4,
              stopLocation: s2.stopLocation.replace(/^Return/i, 'Return Dropoff'),
              stopScheduleTime: t3,
              stopType: 'CharterReturn',
            },
          ]);
        } else {
          setCharterStops(opening.sanitizedStops);
        }
        setShifts([]);
        setLoading(false);
        return;
      }
      const targetTripId = opening.charterTripId || routeId;
      CharterService.getTripById(targetTripId)
        .then((trip) => {
          if (isCancelled) return;
          if (trip && trip.stops && trip.stops.length > 0) {
            const depT = formatCharterStopTime(trip.departsAt) || '08:00';
            const retT = formatCharterStopTime(trip.returnsAt) || '15:00';
            const raw = trip.stops;
            if (trip.roundTrip !== false && raw.length === 3) {
              const t0 = formatCharterStopTime(raw[0].scheduledAt) || depT;
              const t1 = addMinutesToCharterTime(t0, 30);
              const t2 = formatCharterStopTime(raw[2].scheduledAt) || retT;
              const t3 = addMinutesToCharterTime(t2, 30);
              setCharterStops([
                {
                  stopId: raw[0].id || 'stop-1',
                  sequence: 1,
                  stopLocation: `Pickup: ${raw[0].address}`,
                  stopScheduleTime: t0,
                  stopType: 'CharterPickup',
                  schoolName: trip.clientName,
                  latitude: raw[0].latitude,
                  longitude: raw[0].longitude,
                },
                {
                  stopId: raw[1].id || 'stop-2',
                  sequence: 2,
                  stopLocation: `Dropoff: ${raw[1].address}`,
                  stopScheduleTime: t1,
                  stopType: 'CharterDestination',
                  schoolName: trip.clientName,
                  latitude: raw[1].latitude,
                  longitude: raw[1].longitude,
                },
                {
                  stopId: 'stop-3',
                  sequence: 3,
                  stopLocation: `Return Pickup: ${raw[1].address}`,
                  stopScheduleTime: t2,
                  stopType: 'CharterPickup',
                  schoolName: trip.clientName,
                  latitude: raw[1].latitude,
                  longitude: raw[1].longitude,
                },
                {
                  stopId: raw[2].id || 'stop-4',
                  sequence: 4,
                  stopLocation: `Return Dropoff: ${raw[2].address || raw[0].address}`,
                  stopScheduleTime: t3,
                  stopType: 'CharterReturn',
                  schoolName: trip.clientName,
                  latitude: raw[2].latitude,
                  longitude: raw[2].longitude,
                },
              ]);
            } else {
              const mapped: SanitizedStopPreview[] = raw.map((s, idx) => ({
                stopId: s.id || `stop-${idx + 1}`,
                sequence: s.sequenceOrder || idx + 1,
                stopLocation: s.locationName ? `${s.locationName}: ${s.address}` : s.address,
                stopScheduleTime: formatCharterStopTime(s.scheduledAt) || (idx === 0 ? depT : retT),
                stopType: s.stopType === 0 || s.stopType === 3 ? 'CharterPickup' : s.stopType === 1 ? 'CharterDestination' : 'CharterReturn',
                schoolName: trip.clientName,
                latitude: s.latitude,
                longitude: s.longitude,
              }));
              setCharterStops(mapped);
            }
          }
          setLoading(false);
        })
        .catch(() => {
          if (!isCancelled) setLoading(false);
        });
      return () => {
        isCancelled = true;
      };
    }

    RouteService.getShiftsForRoute(routeId)
      .then((data) => {
        if (!isCancelled) {
          setShifts(data || []);
          setSelectedShiftIndex(0);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('[StopPreview] Failed to load route shifts:', err);
        if (!isCancelled) {
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, routeId, opening]);

  const activeShift = shifts[selectedShiftIndex] || null;
  const markersByIndexRef = useRef<L.Marker[]>([]);

  // Derive sanitized stops with resolved coordinates
  const sanitizedStops: SanitizedStopPreview[] = useMemo(() => {
    if (charterStops.length > 0) return charterStops;
    if (!activeShift || !activeShift.stops) return [];
    return sanitizeStopsForPublicViewing(
      activeShift.stops,
      activeShift.shiftSchools || routeName
    );
  }, [charterStops, activeShift, routeName]);

  const handleFocusStop = (idx: number) => {
    const map = mapInstanceRef.current;
    const stop = sanitizedStops[idx];
    if (!map || !stop || typeof stop.latitude !== 'number' || typeof stop.longitude !== 'number') return;
    map.flyTo([stop.latitude, stop.longitude], Math.max(map.getZoom(), 15), { duration: 0.6 });
    const marker = markersByIndexRef.current[idx];
    if (marker) {
      marker.openPopup();
    }
  };

  // Leaflet map setup, marker rendering, and OSRM road path
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [45.378, -75.751], // Ottawa center
        zoom: 12,
        zoomControl: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
      markersLayerRef.current = markersGroup;
    }

    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();
    markersByIndexRef.current = [];

    const validCoords: [number, number][] = [];

    sanitizedStops.forEach((stop, idx) => {
      if (
        typeof stop.latitude === 'number' &&
        typeof stop.longitude === 'number' &&
        !isNaN(stop.latitude) &&
        !isNaN(stop.longitude)
      ) {
        const latLng: [number, number] = [stop.latitude, stop.longitude];
        validCoords.push(latLng);

        const isSchool = String(stop.stopType || '').toLowerCase().includes('school');
        const displayTitle = isSchool
          ? stop.schoolName || stop.stopLocation
          : stop.stopLocation;

        const customIcon = L.divIcon({
          className: 'custom-preview-pin',
          html: `<div style="
            background-color: ${isSchool ? '#8b5cf6' : '#f59e0b'};
            color: #ffffff;
            font-weight: 800;
            font-size: 11px;
            width: ${isSchool ? '30px' : '26px'};
            height: ${isSchool ? '30px' : '26px'};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2.5px solid #ffffff;
            box-shadow: 0 3px 8px rgba(0,0,0,0.5);
          ">${stop.sequence}</div>`,
          iconSize: isSchool ? [30, 30] : [26, 26],
          iconAnchor: isSchool ? [15, 15] : [13, 13]
        });

        const marker = L.marker(latLng, {
          icon: customIcon,
          zIndexOffset: isSchool ? 1000 : 100 + idx
        });
        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4; min-width: 180px;">
            <div style="font-weight: 700; color: #1e293b;">Stop #${stop.sequence} ${isSchool ? '🏫 (School Stop)' : '(Student Stop)'}</div>
            <div style="color: #475569; margin-top: 3px; font-weight: 600;">${isSchool ? `🏫 ${displayTitle}` : `📍 ${displayTitle}`}</div>
            ${stop.stopScheduleTime ? `<div style="color: #0284c7; margin-top: 3px; font-weight: 700;">⏰ ${stop.stopScheduleTime}</div>` : ''}
          </div>
        `);
        markersGroup.addLayer(marker);
        markersByIndexRef.current[idx] = marker;
      }
    });

    let fallbackPolyline: L.Polyline | null = null;
    if (validCoords.length > 1) {
      // Draw immediate stop-to-stop path first
      fallbackPolyline = L.polyline(validCoords, {
        color: '#3b82f6',
        weight: 4,
        opacity: 0.85,
        dashArray: '6, 8'
      });
      markersGroup.addLayer(fallbackPolyline);

      const bounds = fallbackPolyline.getBounds();
      map.fitBounds(bounds, { padding: [40, 40] });

      // Fetch OSRM road driving geometry for realistic street routing
      const coordsStr = validCoords.map((pt) => `${pt[1]},${pt[0]}`).join(';');
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      fetch(osrmUrl, { signal: controller.signal })
        .then((res) => {
          clearTimeout(timeoutId);
          if (!res.ok) throw new Error('OSRM failed');
          return res.json();
        })
        .then((data) => {
          if (data?.routes?.[0]?.geometry?.coordinates && markersLayerRef.current === markersGroup) {
            const roadCoords: [number, number][] = data.routes[0].geometry.coordinates.map(
              (c: [number, number]) => [c[1], c[0]]
            );
            if (fallbackPolyline) {
              markersGroup.removeLayer(fallbackPolyline);
            }
            const casing = L.polyline(roadCoords, {
              color: '#1e3a8a',
              weight: 7,
              opacity: 0.7,
              lineCap: 'round',
              lineJoin: 'round'
            });
            const roadLine = L.polyline(roadCoords, {
              color: '#3b82f6',
              weight: 4.5,
              opacity: 0.95,
              lineCap: 'round',
              lineJoin: 'round'
            });
            markersGroup.addLayer(casing);
            markersGroup.addLayer(roadLine);
          }
        })
        .catch(() => {
          // Keep dashed fallbackPolyline
        });
    } else if (validCoords.length === 1) {
      map.setView(validCoords[0], 14);
    }

    // Invalidate map size and re-fit bounds after modal layout finishes
    const timer = setTimeout(() => {
      map.invalidateSize();
      if (validCoords.length > 1) {
        map.fitBounds(L.latLngBounds(validCoords), { padding: [40, 40] });
      }
    }, 220);

    return () => {
      clearTimeout(timer);
    };
  }, [isOpen, sanitizedStops]);

  // Teardown map on modal close
  useEffect(() => {
    if (!isOpen && mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-100">
                  {t.routeOpenings?.confidentialStopsTitle || 'Route Stops & Path Preview'}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Route {routeNo}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {routeName || 'School Bus Transit Path'} • Operational Stop Schedule
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Confidential Security Banner */}
        <div className="px-6 py-2.5 bg-emerald-950/40 border-b border-emerald-800/40 flex items-center gap-2.5 text-xs text-emerald-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            {t.routeOpenings?.confidentialBanner ||
              'Student privacy protection active: Passenger names, IDs, grades, and parent contacts are strictly masked.'}
          </span>
        </div>

        {/* Shift selector tabs (if multiple shifts exist) */}
        {shifts.length > 1 && (
          <div className="flex items-center gap-2 px-6 py-2.5 bg-slate-950/60 border-b border-slate-800 overflow-x-auto">
            <span className="text-xs text-slate-400 font-medium mr-2">Shifts:</span>
            {shifts.map((shift, idx) => (
              <button
                key={shift.id || idx}
                onClick={() => setSelectedShiftIndex(idx)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  selectedShiftIndex === idx
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-750'
                }`}
              >
                {shift.shiftType || `Shift #${idx + 1}`} ({shift.stops?.length || 0} stops)
              </button>
            ))}
          </div>
        )}

        {/* Content Body: Split Map & Stop List */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[440px]">
          {/* Left / Top: Interactive Map */}
          <div className="lg:col-span-7 h-72 lg:h-full min-h-[320px] lg:min-h-[440px] relative border-b lg:border-b-0 lg:border-r border-slate-800">
            <div ref={mapContainerRef} className="absolute inset-0 w-full h-full bg-slate-950" />
            <div className="absolute top-3 right-3 z-[400] bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/70 text-[11px] text-slate-300 flex items-center gap-2 shadow">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Student Stop
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 ml-1" /> School Stop
            </div>
          </div>

          {/* Right / Bottom: Sanitized Stops Table */}
          <div className="lg:col-span-5 flex flex-col h-full max-h-[460px] lg:max-h-[540px] overflow-hidden bg-slate-900/40">
            <div className="p-3.5 border-b border-slate-800/80 bg-slate-900/80 flex items-center justify-between text-xs font-semibold text-slate-300">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                Stop Sequence ({sanitizedStops.length} stops)
              </span>
              {activeShift && (
                <span className="text-slate-400 font-normal">
                  {activeShift.firstStopTime || '--'} ~ {activeShift.lastStopTime || '--'}
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50 p-2 space-y-1">
              {loading ? (
                <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
                  Loading sanitized stop sequence...
                </div>
              ) : sanitizedStops.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  No stops found for this shift.
                </div>
              ) : (
                sanitizedStops.map((stop, idx) => {
                  const isSchool = String(stop.stopType || '').toLowerCase().includes('school');
                  const displayTitle = isSchool
                    ? (stop.schoolName || stop.stopLocation)
                    : stop.stopLocation;
                  return (
                    <div
                      key={stop.stopId || stop.sequence}
                      onClick={() => handleFocusStop(idx)}
                      className="p-2.5 rounded-xl hover:bg-slate-800/60 transition-colors flex items-start gap-3 cursor-pointer"
                    >
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                          isSchool
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}
                      >
                        {stop.sequence}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={`text-xs font-semibold truncate flex items-center gap-1.5 ${
                              isSchool ? 'text-purple-300' : 'text-slate-200'
                            }`}
                          >
                            {isSchool && <SchoolIcon className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                            <span className="truncate">{displayTitle}</span>
                          </p>
                          {stop.stopScheduleTime && (
                            <span className="text-[11px] font-mono text-cyan-400 shrink-0 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-cyan-500" />
                              {stop.stopScheduleTime}
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex items-center gap-2">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${
                              isSchool
                                ? 'bg-purple-950/60 text-purple-400 border border-purple-800/50'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {isSchool ? 'School Stop' : 'Student Stop'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Preview stops before bidding. Actual student passenger manifests are provided upon assignment confirmation.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};
