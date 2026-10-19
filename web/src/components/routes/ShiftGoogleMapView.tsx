import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BusRoute, BusRouteShift, RouteStop, formatOpDays, getShiftBadgeStyle } from '../../types/route';
import { Student } from '../../types/student';
import { resolveStopCoordinates, resolveHomeCoordinates } from '../../utils/geoUtils';
import { diffMinutes } from '../../utils/dispatchDelayUtils';
import { RouteService } from '../../services/routeService';
import { useI18n } from '../../contexts/I18nContext';
import { OptimizeRouteModal } from './OptimizeRouteModal';
import {
  GpsSimulator,
  SimulatedVehicleState,
  StopCoordinateHint
} from '../../utils/gpsSimulationEngine';
import {
  MapPin,
  Bus,
  Clock,
  Navigation,
  Layers,
  Maximize2,
  Minimize2,
  RefreshCw,
  Users,
  GraduationCap,
  Move,
  Zap,
  Play,
  Pause
} from 'lucide-react';

interface ShiftGoogleMapViewProps {
  shift: BusRouteShift | null;
  route: BusRoute;
  studentsMap?: Record<number, Student>;
  onSelectStudent?: (student: Student) => void;
  onUpdateShift?: (updatedShift: BusRouteShift) => void;
  height?: string | number;
}

type MapLayerType = 'roadmap' | 'satellite' | 'terrain' | 'osm';

/**
 * Accurately determines if a stop represents a school destination or pickup origin.
 * Ensures student home pickup/dropoff stops are never falsely classified as school stops.
 */
const checkIsSchoolStop = (
  stop: RouteStop,
  _shiftSchools?: string,
  isLastStop?: boolean,
  isFirstStop?: boolean,
  shiftType?: string
): boolean => {
  const type = (stop.stopType || '').toLowerCase().trim();

  // 1. If stopType indicates Home, Corner, or Yard, it is definitely a STUDENT stop, NOT a school stop
  if (
    type === 'homepickup' ||
    type === 'homedropoff' ||
    type.includes('home') ||
    type.includes('corner') ||
    type.includes('yard')
  ) {
    return false;
  }

  // 2. Explicit school stopType (SchoolDropoff, SchoolPickup, or contains 'school')
  if (
    type === 'schooldropoff' ||
    type === 'schoolpickup' ||
    (type.includes('school') && !type.includes('home'))
  ) {
    return true;
  }

  // 3. Fallback when stopType is completely empty / undefined
  if (!type) {
    const loc = (stop.stopLocation || '').toLowerCase().trim();
    const isSchoolAddress =
      loc.startsWith('école') ||
      loc.startsWith('ecole') ||
      loc.includes('high school') ||
      loc.includes('elementary school') ||
      loc.includes('collegiate') ||
      loc.includes('public school');

    if (isSchoolAddress) {
      return true;
    }

    // Typical school bus operations:
    // In AM shift, the final terminal stop is the dropoff school;
    // In PM shift, the initial first stop is the pickup school.
    const isAM = (shiftType || '').toUpperCase().includes('AM');
    const isPM = (shiftType || '').toUpperCase().includes('PM');
    if (isAM && isLastStop) return true;
    if (isPM && isFirstStop) return true;
  }

  return false;
};

export const ShiftGoogleMapView: React.FC<ShiftGoogleMapViewProps> = ({
  shift,
  route,
  studentsMap = {},
  onSelectStudent: _onSelectStudent,
  onUpdateShift,
  height = '540px'
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);
  const polylineBorderRef = useRef<L.Polyline | null>(null);

  const { t } = useI18n();
  const [mapLayer, setMapLayer] = useState<MapLayerType>('roadmap');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedStopIndex, setSelectedStopIndex] = useState<number | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMin: number } | null>(null);

  // Stop sequence optimization modal state
  const [isOptimizeModalOpen, setIsOptimizeModalOpen] = useState(false);

  // Live GPS Vehicle Simulation state & refs
  const vehicleMarkerRef = useRef<L.Marker | null>(null);
  const gpsSimulatorRef = useRef<GpsSimulator | null>(null);
  const [vehicleState, setVehicleState] = useState<SimulatedVehicleState | null>(null);
  const [isSimPaused, setIsSimPaused] = useState(false);
  const [simSpeedMultiplier, setSimSpeedMultiplier] = useState<number>(1);

  // Relocated / draggable bus stop adjustment mode
  const [isEditPickupMode, setIsEditPickupMode] = useState(false);
  const [isSavingStop, setIsSavingStop] = useState(false);
  const homeMarkersRef = useRef<L.Marker[]>([]);
  const connectingLinesRef = useRef<L.Polyline[]>([]);

  // Local stops state to support instant visual update upon dragging
  const [localStops, setLocalStops] = useState<RouteStop[]>([]);

  // Keep localStops in sync with incoming shift
  useEffect(() => {
    if (shift?.stops) {
      setLocalStops([...shift.stops].sort((a, b) => (a.sequence || 0) - (b.sequence || 0)));
    } else {
      setLocalStops([]);
    }
  }, [shift]);

  // Sorted stops for this shift
  const stops = useMemo(() => {
    return localStops;
  }, [localStops]);

  // Resolved stop coordinates in Ottawa with robust school detection, lateness, and rider status
  const stopsWithCoords = useMemo(() => {
    const totalStops = stops.length;
    return stops.map((stop, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === totalStops - 1;
      const isSchool = checkIsSchoolStop(stop, shift?.shiftSchools, isLast, isFirst, shift?.shiftType);
      const coords = resolveStopCoordinates(stop, shift?.shiftSchools || route.routeName, totalStops);
      const homeCoords = resolveHomeCoordinates(stop, shift?.shiftSchools || route.routeName, totalStops);

      const actualTime = stop.actualArrivalTime;
      let lateMinutes = 0;
      if (typeof stop.minutesLate === 'number' && stop.minutesLate > 0) {
        lateMinutes = stop.minutesLate;
      } else if (actualTime && stop.pullawayTime) {
        lateMinutes = Math.max(0, diffMinutes(actualTime, stop.pullawayTime));
      }
      const isLate = lateMinutes > 0;
      const assignedCount = stop.assignedStudents?.length || 0;
      const hasNoStudents = !isSchool && assignedCount === 0;

      // Distance in meters between actual bus stop and student home
      const distMeters = Math.round(
        L.latLng(coords.lat, coords.lng).distanceTo(L.latLng(homeCoords.lat, homeCoords.lng))
      );
      const isRelocated = stop.isCustomPickupLocation || distMeters > 25;

      return {
        ...stop,
        resolvedLat: coords.lat,
        resolvedLng: coords.lng,
        homeLat: homeCoords.lat,
        homeLng: homeCoords.lng,
        distMeters,
        isRelocated,
        isSchool,
        isLate,
        lateMinutes,
        hasNoStudents,
        actualTime,
        assignedCount
      };
    });
  }, [stops, shift, route]);

  // Track if initial fitBounds has been performed for the current shift so drags never reset zoom
  const hasFittedBoundsForShiftRef = useRef<string | null>(null);

  // Handle saving dragged bus stop position to Firestore and notifying parent
  const handleSavePickupLocation = useCallback(
    async (stopId: number, newLat: number, newLng: number, isReset: boolean = false) => {
      if (!shift) return;
      setIsSavingStop(true);

      const roundedLat = Math.round(newLat * 1e5) / 1e5;
      const roundedLng = Math.round(newLng * 1e5) / 1e5;

      const baseStops = localStops.length > 0 ? localStops : (shift.stops || []);

      const updatedStops = baseStops.map((s) => {
        if (s.stopId === stopId) {
          if (isReset) {
            const cleanCopy = { ...s };
            delete cleanCopy.pickupLatitude;
            delete cleanCopy.pickupLongitude;
            delete cleanCopy.pickupLocation;
            cleanCopy.isCustomPickupLocation = false;
            return cleanCopy;
          }
          return {
            ...s,
            pickupLatitude: roundedLat,
            pickupLongitude: roundedLng,
            pickupLocation: s.pickupLocation || `Street Stop near ${s.stopLocation}`,
            isCustomPickupLocation: true
          };
        }
        return s;
      });

      const sortedStops = [...updatedStops].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

      // Update local state immediately for smooth UI response
      setLocalStops(sortedStops);

      try {
        const updatedShift: BusRouteShift = {
          ...shift,
          stops: sortedStops,
          updatedAt: new Date().toISOString()
        };
        await RouteService.updateShift(shift.id, {
          stops: sortedStops
        });
        if (onUpdateShift) {
          onUpdateShift(updatedShift);
        }
      } catch (err) {
        console.error('Failed to update stop location:', err);
      } finally {
        setIsSavingStop(false);
      }
    },
    [shift, localStops, onUpdateShift]
  );

  // Apply optimized stops from modal directly to shift & Firestore
  const handleApplyOptimizedStops = useCallback(
    async (optimizedStops: RouteStop[]) => {
      if (!shift) return;

      const cleanStops = optimizedStops.map((s) => {
        const clean: any = {};
        for (const [k, v] of Object.entries(s)) {
          if (v !== undefined) clean[k] = v;
        }
        return clean as RouteStop;
      });

      // Update local state immediately
      setLocalStops(cleanStops);

      const updatedShift: BusRouteShift = {
        ...shift,
        stops: cleanStops,
        updatedAt: new Date().toISOString()
      };

      await RouteService.updateShift(shift.id, {
        stops: cleanStops
      });

      if (onUpdateShift) {
        onUpdateShift(updatedShift);
      }
    },
    [shift, onUpdateShift]
  );

  // Tile URL mapping: authentic Google Maps tile layers
  const getTileUrl = (type: MapLayerType) => {
    switch (type) {
      case 'satellite':
        // Google Hybrid (Satellite + Road & Label Overlay)
        return 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
      case 'terrain':
        // Google Terrain with labels
        return 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}';
      case 'osm':
        return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      case 'roadmap':
      default:
        // Official Google Roadmap vector tiles
        return 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    }
  };

  const getTileAttribution = (type: MapLayerType) => {
    if (type === 'osm') {
      return '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';
    }
    return '&copy; <a href="https://maps.google.com" target="_blank" rel="noreferrer">Google Maps</a>';
  };

  // Build custom SVG stop pin with prominent school vs student vs late vs empty vs relocated differentiation
  const createStopIcon = (
    seq: number,
    isSchool: boolean,
    isSelected: boolean,
    isLate: boolean,
    hasNoStudents: boolean,
    lateMinutes: number,
    schoolTitle?: string,
    isRelocated?: boolean
  ) => {
    if (isSchool) {
      // 🏫 SCHOOL PIN: Larger, vibrant Golden-Amber, or Red Warning if late
      const width = isSelected ? 48 : 42;
      const height = isSelected ? 58 : 52;
      const cleanSchoolTitle = (schoolTitle || 'School Destination').replace(/[<>&"']/g, '');

      const filterId = isLate ? `school-glow-late-${seq}` : `school-glow-${seq}`;
      const gradId = isLate ? `school-grad-late-${seq}` : `school-grad-${seq}`;
      const glowColor = isLate ? '#EF4444' : '#F59E0B';
      const stopColor1 = isLate ? '#F87171' : '#FBBF24';
      const stopColor2 = isLate ? '#DC2626' : '#D97706';
      const strokeColor = isSelected ? '#FFFFFF' : isLate ? '#7F1D1D' : '#78350F';
      const innerStroke = isLate ? '#DC2626' : '#D97706';
      const badgeBg = isLate ? '#991B1B' : '#78350F';
      const badgeText = isLate ? '#FECDD3' : '#FDE68A';

      const svgSchool = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 44 54">
          <defs>
            <filter id="${filterId}" x="-35%" y="-35%" width="170%" height="170%">
              <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="${glowColor}" flood-opacity="0.8"/>
              <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#000000" flood-opacity="0.6"/>
            </filter>
            <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="${stopColor1}"/>
              <stop offset="100%" stop-color="${stopColor2}"/>
            </linearGradient>
          </defs>
          <!-- Pin Body -->
          <path d="M22 0 C9.8 0 0 9.8 0 22 C0 35.5 19 52 20.8 53.5 C21.5 54.1 22.5 54.1 23.2 53.5 C25 52 44 35.5 44 22 C44 9.8 34.2 0 22 0 Z" fill="url(#${gradId})" stroke="${strokeColor}" stroke-width="${isSelected ? 3 : 2}" filter="url(#${filterId})"/>
          <!-- Inner White Badge -->
          <circle cx="22" cy="21" r="14.5" fill="#FFFFFF" stroke="${innerStroke}" stroke-width="1.5"/>
          <!-- School Building Icon SVG inside -->
          <g transform="translate(13, 12)" stroke="${isLate ? '#991B1B' : '#B45309'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">
            <path d="M9 15v-3a1 1 0 0 0-1-1v0a1 1 0 0 0-1 1v3" fill="${isLate ? '#FCA5A5' : '#FDE68A'}"/>
            <path d="M14 6.5v8.5"/>
            <path d="M4 6.5v8.5"/>
            <path d="m1 6.5 8-4.5 8 4.5"/>
            <circle cx="9" cy="8" r="1.5" fill="${isLate ? '#991B1B' : '#B45309'}"/>
          </g>
          <!-- Sequence Badge Pill at bottom of pin -->
          <rect x="11" y="38" width="22" height="11" rx="5.5" fill="${badgeBg}" />
          <text x="22" y="46.5" font-size="8.5" font-family="-apple-system, BlinkMacSystemFont, Arial, sans-serif" font-weight="900" fill="${badgeText}" text-anchor="middle">#${seq}</text>
        </svg>
      `;

      return L.divIcon({
        className: 'bg-transparent border-none',
        html: `
          <div style="position: relative; transform: translate(-50%, -100%); width: ${width}px; height: ${height}px;">
            <!-- Floating Permanent School Label Pill -->
            <div style="position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); margin-bottom: 5px; background: rgba(15, 23, 42, 0.95); border: 1.5px solid ${isLate ? '#EF4444' : '#F59E0B'}; border-radius: 9999px; padding: 2px 9px; font-size: 11px; font-weight: 800; color: ${isLate ? '#FCA5A5' : '#FBBF24'}; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.6); display: flex; align-items: center; gap: 4px; pointer-events: none; z-index: 100;">
              <span>${isLate ? '⚠️' : '🏫'}</span>
              <span style="max-width: 160px; overflow: hidden; text-overflow: ellipsis;">${cleanSchoolTitle}</span>
              ${isLate ? `<span style="background: #EF4444; color: white; font-size: 9px; padding: 1px 4px; border-radius: 4px; margin-left: 2px;">+${lateMinutes}m</span>` : ''}
            </div>
            ${svgSchool}
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
        popupAnchor: [0, -height - 18]
      });
    }

    // STUDENT STOP PINS:
    const size = isSelected ? 36 : 30;
    const pinHeight = isSelected ? 44 : 38;

    if (isLate) {
      // ⚠️ LATE STOP PIN: Bold Warning Red with glowing pulse
      const svgLate = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${pinHeight}" viewBox="0 0 34 42">
          <defs>
            <filter id="late-shadow-${seq}" x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#EF4444" flood-opacity="0.8"/>
              <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.5"/>
            </filter>
          </defs>
          <path d="M17 0 C7.6 0 0 7.6 0 17 C0 27.5 14.5 40.2 16.1 41.5 C16.6 42 17.4 42 17.9 41.5 C19.5 40.2 34 27.5 34 17 C34 7.6 26.4 0 17 0 Z" fill="#EF4444" stroke="${isSelected ? '#FFFFFF' : '#991B1B'}" stroke-width="${isSelected ? 3 : 2}" filter="url(#late-shadow-${seq})"/>
          <circle cx="17" cy="16" r="10" fill="#FFFFFF" />
          <text x="17" y="20" font-size="11" font-family="-apple-system, BlinkMacSystemFont, Arial, sans-serif" font-weight="900" fill="#DC2626" text-anchor="middle">${seq}</text>
        </svg>
      `;

      return L.divIcon({
        className: 'bg-transparent border-none',
        html: `
          <div style="position: relative; transform: translate(-50%, -100%); width: ${size}px; height: ${pinHeight}px;">
            <div style="position: absolute; top: -8px; right: -8px; background: #DC2626; color: white; border: 1.5px solid white; border-radius: 9999px; font-size: 9px; font-weight: 900; padding: 1px 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.4); pointer-events: none; white-space: nowrap; z-index: 10;">
              +${lateMinutes}m
            </div>
            ${svgLate}
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
        popupAnchor: [0, -pinHeight - 4]
      });
    }

    if (isRelocated) {
      // 🚌 RELOCATED / STREET PICKUP PIN: Vibrant Emerald/Teal teardrop with Bus indicator
      const svgRelocated = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${pinHeight}" viewBox="0 0 34 42">
          <defs>
            <filter id="relocated-shadow-${seq}" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#059669" flood-opacity="0.6"/>
              <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.5"/>
            </filter>
          </defs>
          <path d="M17 0 C7.6 0 0 7.6 0 17 C0 27.5 14.5 40.2 16.1 41.5 C16.6 42 17.4 42 17.9 41.5 C19.5 40.2 34 27.5 34 17 C34 7.6 26.4 0 17 0 Z" fill="#059669" stroke="${isSelected ? '#FFFFFF' : '#064E3B'}" stroke-width="${isSelected ? 3.5 : 2}" filter="url(#relocated-shadow-${seq})"/>
          <circle cx="17" cy="16" r="10" fill="#FFFFFF" />
          <text x="17" y="20" font-size="11" font-family="-apple-system, BlinkMacSystemFont, Arial, sans-serif" font-weight="900" fill="#047857" text-anchor="middle">${seq}</text>
        </svg>
      `;

      return L.divIcon({
        className: 'bg-transparent border-none',
        html: `
          <div style="position: relative; transform: translate(-50%, -100%); width: ${size}px; height: ${pinHeight}px;">
            <div style="position: absolute; top: -8px; right: -8px; background: #059669; color: white; border: 1.5px solid white; border-radius: 9999px; font-size: 9px; font-weight: 900; padding: 1px 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.4); pointer-events: none; white-space: nowrap; z-index: 10;">
              🚌 Spot
            </div>
            ${svgRelocated}
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
        popupAnchor: [0, -pinHeight - 4]
      });
    }

    if (hasNoStudents) {
      // 🟣 ZERO STUDENT STOP PIN: Distinct Violet/Purple Pin
      const svgEmpty = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${pinHeight}" viewBox="0 0 34 42">
          <defs>
            <filter id="empty-shadow-${seq}" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#8B5CF6" flood-opacity="0.5"/>
              <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.4"/>
            </filter>
          </defs>
          <path d="M17 0 C7.6 0 0 7.6 0 17 C0 27.5 14.5 40.2 16.1 41.5 C16.6 42 17.4 42 17.9 41.5 C19.5 40.2 34 27.5 34 17 C34 7.6 26.4 0 17 0 Z" fill="#8B5CF6" stroke="${isSelected ? '#FFFFFF' : '#5B21B6'}" stroke-width="${isSelected ? 3 : 2}" filter="url(#empty-shadow-${seq})"/>
          <circle cx="17" cy="16" r="10" fill="#FFFFFF" />
          <text x="17" y="20" font-size="11" font-family="-apple-system, BlinkMacSystemFont, Arial, sans-serif" font-weight="900" fill="#7C3AED" text-anchor="middle">${seq}</text>
        </svg>
      `;

      return L.divIcon({
        className: 'bg-transparent border-none',
        html: `<div style="transform: translate(-50%, -100%); width: ${size}px; height: ${pinHeight}px;">${svgEmpty}</div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
        popupAnchor: [0, -pinHeight - 4]
      });
    }

    // 👤 STANDARD STUDENT STOP PIN: Crisp Electric Blue teardrop with sequence number
    const svgStudent = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${pinHeight}" viewBox="0 0 34 42">
        <defs>
          <filter id="student-shadow-${seq}" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.45"/>
          </filter>
        </defs>
        <path d="M17 0 C7.6 0 0 7.6 0 17 C0 27.5 14.5 40.2 16.1 41.5 C16.6 42 17.4 42 17.9 41.5 C19.5 40.2 34 27.5 34 17 C34 7.6 26.4 0 17 0 Z" fill="#2563EB" stroke="${isSelected ? '#FFFFFF' : '#1E3A8A'}" stroke-width="${isSelected ? 3 : 2}" filter="url(#student-shadow-${seq})"/>
        <circle cx="17" cy="16" r="10" fill="#FFFFFF" />
        <text x="17" y="20" font-size="11" font-family="-apple-system, BlinkMacSystemFont, Arial, sans-serif" font-weight="900" fill="#2563EB" text-anchor="middle">${seq}</text>
      </svg>
    `;

    return L.divIcon({
      className: 'bg-transparent border-none',
      html: `<div style="transform: translate(-50%, -100%); width: ${size}px; height: ${pinHeight}px;">${svgStudent}</div>`,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
      popupAnchor: [0, -pinHeight - 4]
    });
  };

  // Build secondary Home address marker icon
  const createHomeIcon = (seq: number) => {
    return L.divIcon({
      className: 'bg-transparent border-none',
      html: `
        <div style="position: relative; transform: translate(-50%, -50%); width: 24px; height: 24px; background: #0F172A; border: 2px solid #38BDF8; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.5); cursor: pointer;" title="Student Home Address #${seq}">
          <span style="font-size: 12px; line-height: 1;">🏠</span>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
      popupAnchor: [0, -14]
    });
  };

  // Build animated vehicle marker icon with heading rotation, radar ping, and speed badge
  const createVehicleIcon = (state: SimulatedVehicleState) => {
    const isAtStop = state.status === 'at_stop';
    const badgeColor = isAtStop ? '#10B981' : '#F59E0B';
    const speedLabel = isAtStop ? 'BOARDING' : `${state.speedKmH} km/h`;

    return L.divIcon({
      className: 'bg-transparent border-none',
      html: `
        <div style="position: relative; width: 44px; height: 44px; cursor: pointer; z-index: 1500;" title="${state.unitNumber} - ${state.status}">
          <!-- Radar Ping Wave centered exactly at (22, 22) -->
          <div style="position: absolute; top: 50%; left: 50%; width: 48px; height: 48px; transform: translate(-50%, -50%); border-radius: 50%; background: ${isAtStop ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}; border: 1.5px solid ${badgeColor}; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite; pointer-events: none;"></div>
          
          <!-- Directional School Bus Container with smooth heading rotation centered at (22, 22) -->
          <div style="width: 44px; height: 44px; transform: rotate(${state.heading}deg); transform-origin: 22px 22px; transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1); display: flex; align-items: center; justify-content: center;">
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
              <!-- Heading Pointer Triangle -->
              <polygon points="22,1 27,9 17,9" fill="${badgeColor}" stroke="#FFFFFF" stroke-width="1.5" />
              <!-- Bus Outer Shell -->
              <rect x="9" y="8" width="26" height="30" rx="6" fill="#0F172A" stroke="#FFFFFF" stroke-width="2" />
              <!-- School Bus Yellow Body -->
              <rect x="11" y="10" width="22" height="26" rx="4" fill="#FBBF24" />
              <!-- Windshield -->
              <rect x="13" y="12" width="18" height="6" rx="2" fill="#1E293B" />
              <!-- Headlights -->
              <circle cx="13" cy="9.5" r="1.5" fill="#FEF08A" />
              <circle cx="31" cy="9.5" r="1.5" fill="#FEF08A" />
              <!-- Side Windows -->
              <rect x="13" y="20" width="5" height="4" rx="1" fill="#1E293B" />
              <rect x="20" y="20" width="4" height="4" rx="1" fill="#1E293B" />
              <rect x="26" y="20" width="5" height="4" rx="1" fill="#1E293B" />
              <rect x="13" y="26" width="5" height="4" rx="1" fill="#1E293B" />
              <rect x="20" y="26" width="4" height="4" rx="1" fill="#1E293B" />
              <rect x="26" y="26" width="5" height="4" rx="1" fill="#1E293B" />
            </svg>
          </div>

          <!-- Floating Telematics Label Pill centered horizontally above the bus -->
          <div style="position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); margin-bottom: 6px; background: #0F172A; border: 1.5px solid ${badgeColor}; border-radius: 9999px; padding: 2px 8px; color: #FFFFFF; font-size: 10px; font-weight: 800; white-space: nowrap; box-shadow: 0 4px 10px rgba(0,0,0,0.6); display: flex; align-items: center; gap: 4px; pointer-events: none;">
            <span style="color: ${badgeColor};">🚌</span>
            <span>${state.unitNumber}</span>
            <span style="color: #94A3B8;">•</span>
            <span style="color: ${isAtStop ? '#34D399' : '#FBBF24'}; font-family: monospace;">${speedLabel}</span>
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -26]
    });
  };

  // Build interactive vehicle popup content
  const buildVehiclePopupHtml = (vState: SimulatedVehicleState) => {
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 4px; min-width: 250px; max-width: 300px; color: #0F172A;">
        <div style="background: linear-gradient(135deg, #0F172A, #1E293B); border-radius: 8px 8px 0 0; padding: 8px 10px; margin: -4px -4px 8px -4px; color: white;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; background: #F59E0B; color: #0F172A; padding: 2px 6px; border-radius: 4px;">
              📡 Live GPS (Simulated)
            </span>
            <span style="font-size: 10px; font-family: monospace; color: #94A3B8;">${vState.lastPingTime}</span>
          </div>
          <div style="font-size: 14px; font-weight: 800; margin-top: 4px; display: flex; align-items: center; gap: 6px;">
            <span>🚌</span>
            <span>${vState.unitNumber}</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px;">
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 5px 8px;">
            <div style="font-size: 9.5px; color: #64748B; font-weight: 600;">Current Speed</div>
            <div style="font-size: 13px; font-weight: 800; color: ${vState.speedKmH > 0 ? '#2563EB' : '#10B981'}; font-family: monospace;">
              ${vState.speedKmH} km/h
            </div>
          </div>
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 5px 8px;">
            <div style="font-size: 9.5px; color: #64748B; font-weight: 600;">Compass Heading</div>
            <div style="font-size: 13px; font-weight: 800; color: #0F172A; font-family: monospace;">
              ${vState.heading}°
            </div>
          </div>
        </div>

        <div style="background: ${vState.status === 'at_stop' ? '#ECFDF5' : '#EFF6FF'}; border: 1px solid ${vState.status === 'at_stop' ? '#A7F3D0' : '#BFDBFE'}; border-radius: 6px; padding: 6px 8px; margin-bottom: 6px;">
          <div style="font-size: 10px; font-weight: 700; color: ${vState.status === 'at_stop' ? '#047857' : '#1D4ED8'}; margin-bottom: 2px;">
            ${vState.status === 'at_stop' ? '🛑 Currently Boarding Passengers' : '📍 En Route to Next Stop'}
          </div>
          <div style="font-size: 11.5px; font-weight: 800; color: #0F172A;">
            ${vState.nextStopTitle}
          </div>
          ${vState.distanceToNextStopMeters > 0 ? `<div style="font-size: 10px; color: #64748B; margin-top: 2px;">Distance remaining: ~${vState.distanceToNextStopMeters}m</div>` : ''}
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10.5px; color: #475569; padding-top: 4px; border-top: 1px solid #F1F5F9;">
          <span>Driver: <strong>${vState.driverName || 'Assigned'}</strong></span>
          <span style="font-family: monospace; font-size: 9.5px; color: #94A3B8;">${vState.lat.toFixed(4)}, ${vState.lng.toFixed(4)}</span>
        </div>
      </div>
    `;
  };

  // Build rich HTML popup content with dedicated school vs student header, actual arrival times & status
  const buildPopupHtml = (stop: (typeof stopsWithCoords)[0], idx: number) => {
    const assigned = stop.assignedStudents || [];
    const isSchool = stop.isSchool;
    const isLate = stop.isLate;
    const hasNoStudents = stop.hasNoStudents;

    // Resolve primary student home address
    let studentHomeAddress = stop.stopLocation || 'Address not listed';
    if (assigned.length > 0) {
      for (const s of assigned) {
        const master = studentsMap[s.studentId];
        if (master?.studentAddress) {
          studentHomeAddress = master.studentAddress;
          break;
        }
      }
    }

    if (isSchool) {
      const schoolTitle = stop.schoolName || stop.stopLocation || 'School Destination';
      const typeLabel =
        stop.stopType === 'SchoolPickup'
          ? 'School Pickup Origin'
          : stop.stopType === 'SchoolDropoff'
          ? 'School Dropoff Destination'
          : 'School Terminal Stop';

      return `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 2px; min-width: 260px; max-width: 310px; color: #0F172A;">
          <!-- School Header Banner -->
          <div style="background: ${isLate ? 'linear-gradient(135deg, #EF4444, #B91C1C)' : 'linear-gradient(135deg, #F59E0B, #D97706)'}; border-radius: 8px 8px 0 0; padding: 8px 10px; margin: -4px -4px 8px -4px; color: white;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; background: rgba(0,0,0,0.25); padding: 2px 6px; border-radius: 4px;">
                ${isLate ? '⚠️' : '🏫'} ${typeLabel}
              </span>
              <span style="font-size: 11px; font-weight: 800; background: #FFFFFF; color: ${isLate ? '#991B1B' : '#B45309'}; padding: 2px 8px; border-radius: 9999px;">
                Stop #${stop.sequence || idx + 1}
              </span>
            </div>
            <div style="font-size: 14px; font-weight: 800; margin-top: 4px; line-height: 1.3;">
              ${schoolTitle}
            </div>
          </div>

          <!-- Times Panel -->
          <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; background: ${isLate ? '#FEF2F2' : '#FFFBEB'}; border: 1px solid ${isLate ? '#FECDD3' : '#FDE68A'}; padding: 6px 8px; border-radius: 6px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 11px; font-weight: 700; color: ${isLate ? '#991B1B' : '#92400E'};">
                ⏰ Scheduled:
              </span>
              <span style="font-family: monospace; font-size: 12px; font-weight: 800; color: #0F172A;">
                ${stop.pullawayTime || '08:30'}
              </span>
            </div>
            ${
              stop.actualArrivalTime
                ? `
              <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px dashed ${isLate ? '#FECDD3' : '#FDE68A'}; padding-top: 3px; margin-top: 2px;">
                <span style="font-size: 11px; font-weight: 700; color: ${isLate ? '#DC2626' : '#16A34A'};">
                  ⏱️ Actual Arrival:
                </span>
                <span style="font-family: monospace; font-size: 12px; font-weight: 800; color: ${isLate ? '#DC2626' : '#16A34A'};">
                  ${stop.actualArrivalTime} ${isLate ? `(+${stop.lateMinutes}m Late)` : '(On-time)'}
                </span>
              </div>
            `
                : isLate
                ? `
              <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px dashed #FECDD3; padding-top: 3px; margin-top: 2px;">
                <span style="font-size: 11px; font-weight: 700; color: #DC2626;">
                  ⚠️ Status:
                </span>
                <span style="font-size: 11px; font-weight: 800; color: #DC2626;">
                  Late +${stop.lateMinutes}m
                </span>
              </div>
            `
                : ''
            }
          </div>

          <div style="font-size: 11px; color: #475569; margin-bottom: 8px; line-height: 1.4;">
            📍 <strong>${stop.stopLocation || 'School Campus Address'}</strong>
          </div>

          <!-- Summary of students -->
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 6px 8px; margin-bottom: 8px;">
            <div style="font-size: 11px; font-weight: 700; color: #0F172A; display: flex; justify-content: space-between;">
              <span>Riders on this Shift:</span>
              <span style="color: #2563EB;">${assigned.length > 0 ? `${assigned.length} students` : 'All Shift Riders'}</span>
            </div>
            ${
              assigned.length > 0
                ? `
              <div style="max-height: 80px; overflow-y: auto; margin-top: 4px; border-top: 1px dashed #E2E8F0; padding-top: 4px;">
                ${assigned
                  .map(
                    (s) => `
                  <div style="font-size: 10px; color: #334155; display: flex; justify-content: space-between; padding: 1.5px 0;">
                    <span>👤 ${s.studentName}</span>
                    <span style="font-family: monospace; color: #64748B;">#${s.studentNo}</span>
                  </div>
                `
                  )
                  .join('')}
              </div>
            `
                : ''
            }
          </div>

          <!-- Footer Action -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 4px; border-top: 1px solid #F1F5F9;">
            <span style="font-size: 10px; color: #94A3B8; font-family: monospace;">
              ${stop.resolvedLat.toFixed(4)}, ${stop.resolvedLng.toFixed(4)}
            </span>
            <a href="https://www.google.com/maps/search/?api=1&query=${stop.resolvedLat},${stop.resolvedLng}" target="_blank" rel="noopener noreferrer" style="font-size: 11px; color: #D97706; text-decoration: none; font-weight: 800; display: inline-flex; align-items: center; gap: 3px;">
              Open School in Google Maps ↗
            </a>
          </div>
        </div>
      `;
    }

    // Standard Student Stop Popup
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 4px; min-width: 240px; max-width: 290px; color: #0F172A;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px solid #E2E8F0; padding-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="background: ${isLate ? '#EF4444' : hasNoStudents ? '#8B5CF6' : '#2563EB'}; color: white; border-radius: 9999px; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800;">
              ${stop.sequence || idx + 1}
            </span>
            <span style="font-weight: 800; font-size: 13px; color: #1E293B;">
              ${hasNoStudents ? 'Empty Stop' : 'Student Stop'} #${stop.sequence || idx + 1}
            </span>
          </div>
          <div style="text-align: right;">
            <span style="font-family: monospace; font-size: 11px; font-weight: 700; color: #475569; background: #F1F5F9; border: 1px solid #E2E8F0; padding: 2px 6px; border-radius: 5px;">
              ⏰ ${stop.pullawayTime || '08:00'}
            </span>
          </div>
        </div>

        ${
          stop.actualArrivalTime || isLate
            ? `
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; background: ${isLate ? '#FEF2F2' : '#F0FDF4'}; border: 1px solid ${isLate ? '#FECDD3' : '#BBF7D0'}; padding: 4px 8px; border-radius: 6px;">
            <span style="font-size: 11px; font-weight: 700; color: ${isLate ? '#991B1B' : '#166534'};">
              ⏱️ Actual Arrival:
            </span>
            <span style="font-family: monospace; font-size: 12px; font-weight: 800; color: ${isLate ? '#DC2626' : '#16A34A'};">
              ${stop.actualArrivalTime || 'Pending'} ${isLate ? `(+${stop.lateMinutes}m Late)` : '(On-time)'}
            </span>
          </div>
        `
            : ''
        }

        <!-- Relocated Bus Stop vs Home Address Section -->
        <div style="background: ${stop.isRelocated ? '#ECFDF5' : '#F8FAFC'}; border: 1.5px solid ${stop.isRelocated ? '#A7F3D0' : '#E2E8F0'}; border-radius: 8px; padding: 7px 8px; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-size: 11px; font-weight: 800; color: ${stop.isRelocated ? '#065F46' : '#1E293B'}; display: flex; align-items: center; gap: 4px;">
              <span>${stop.isRelocated ? '🚌' : '📍'}</span>
              <span>${stop.isRelocated ? 'Actual Bus Stop (Street Parking)' : 'Bus Stop Location'}</span>
            </span>
            ${
              stop.isRelocated
                ? `<span style="font-size: 9px; font-weight: 800; background: #059669; color: white; padding: 1px 5px; border-radius: 9999px;">${stop.distMeters}m from home</span>`
                : ''
            }
          </div>
          <div style="font-size: 11.5px; color: ${stop.isRelocated ? '#047857' : '#334155'}; font-weight: 600; line-height: 1.35;">
            ${stop.pickupLocation || stop.stopLocation || 'Street Stop'}
          </div>
        </div>

        <!-- Student Home Address (Always preserved for driver reference) -->
        <div style="background: #F0F9FF; border: 1px solid #BAE6FD; border-radius: 8px; padding: 6px 8px; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px;">
            <span style="font-size: 10.5px; font-weight: 800; color: #0369A1; display: flex; align-items: center; gap: 4px;">
              <span>🏠</span>
              <span>Student Home Address</span>
            </span>
            <span style="font-size: 9.5px; font-weight: 700; color: #0284C7; font-family: monospace;">Primary Address</span>
          </div>
          <div style="font-size: 11.5px; color: #0F172A; font-weight: 700; line-height: 1.35;">
            ${studentHomeAddress}
          </div>
        </div>

        <div style="font-size: 10.5px; color: #64748B; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
          <span>Type: <strong style="color: #1E293B;">Home Pickup / Dropoff</strong></span>
          ${stop.runDays ? `<span>Days: <strong style="color: #1E293B;">${stop.runDays}</strong></span>` : ''}
        </div>

        ${
          assigned.length > 0
            ? `
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 7px; margin-bottom: 8px;">
            <div style="font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 4px; display: flex; justify-content: space-between;">
              <span>Assigned Students (${assigned.length})</span>
            </div>
            <div style="max-height: 90px; overflow-y: auto;">
              ${assigned
                .map((s) => {
                  const master = studentsMap[s.studentId];
                  const gradeInfo = master?.grade ? ` (${master.grade})` : '';
                  return `
                    <div style="font-size: 11px; color: #1E293B; display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px dashed #F1F5F9;">
                      <span>👤 <strong>${s.studentName || 'Student'}</strong>${gradeInfo}</span>
                      <span style="font-family: monospace; color: #64748B; font-size: 10px;">#${s.studentNo || s.studentId}</span>
                    </div>
                  `;
                })
                .join('')}
            </div>
          </div>
        `
            : `
          <div style="background: #FAF5FF; border: 1px solid #E9D5FF; border-radius: 8px; padding: 6px 8px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 11px; color: #7E22CE; font-weight: 600;">No students assigned</span>
            <span style="font-size: 10px; background: #F3E8FF; color: #6B21A8; font-weight: 800; padding: 1px 6px; border-radius: 9999px;">0 stu</span>
          </div>
        `
        }

        ${
          stop.isRelocated
            ? `
          <div style="background: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: 6px; padding: 5px 8px; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 10px; color: #475569;">Bus stop moved from home</span>
            <button
              type="button"
              id="reset-stop-btn-${stop.stopId}"
              style="background: #EF4444; color: white; border: none; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; cursor: pointer;"
              onclick="window.__resetStopToHome && window.__resetStopToHome(${stop.stopId})"
            >
              Reset to Home
            </button>
          </div>
        `
            : ''
        }

        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 6px; padding-top: 4px; border-top: 1px solid #F1F5F9;">
          <span style="font-size: 10px; color: #94A3B8; font-family: monospace;">
            ${stop.resolvedLat.toFixed(4)}, ${stop.resolvedLng.toFixed(4)}
          </span>
          <div style="display: flex; align-items: center; gap: 6px;">
            <a href="https://www.google.com/maps/search/?api=1&query=${stop.resolvedLat},${stop.resolvedLng}" target="_blank" rel="noopener noreferrer" style="font-size: 11px; color: #2563EB; text-decoration: none; font-weight: 700; display: inline-flex; align-items: center; gap: 3px;">
              Google Maps ↗
            </a>
          </div>
        </div>
      </div>
    `;
  };

  // Re-center and fit all stops
  const handleFitBounds = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || stopsWithCoords.length === 0) return;

    if (stopsWithCoords.length === 1) {
      map.setView([stopsWithCoords[0].resolvedLat, stopsWithCoords[0].resolvedLng], 15);
      return;
    }

    const bounds = L.latLngBounds(stopsWithCoords.map((s) => [s.resolvedLat, s.resolvedLng]));
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
  }, [stopsWithCoords]);

  // Focus a specific stop
  const handleFocusStop = (index: number) => {
    const map = mapInstanceRef.current;
    if (!map || !stopsWithCoords[index]) return;

    setSelectedStopIndex(index);
    const stop = stopsWithCoords[index];
    map.flyTo([stop.resolvedLat, stop.resolvedLng], Math.max(map.getZoom(), 15), { duration: 0.8 });

    const marker = markersRef.current[index];
    if (marker) {
      marker.openPopup();
    }
  };

  // Switch Tile Layer (Roadmap, Satellite, Terrain)
  const handleToggleLayer = () => {
    const nextLayer: MapLayerType =
      mapLayer === 'roadmap' ? 'satellite' : mapLayer === 'satellite' ? 'terrain' : 'roadmap';
    setMapLayer(nextLayer);

    const map = mapInstanceRef.current;
    if (map && tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      const newLayer = L.tileLayer(getTileUrl(nextLayer), {
        subdomains: ['0', '1', '2', '3'],
        maxZoom: 20,
        attribution: getTileAttribution(nextLayer)
      });
      newLayer.addTo(map);
      tileLayerRef.current = newLayer;
    }
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Default Ottawa center
    const defaultCenter: [number, number] =
      stopsWithCoords.length > 0
        ? [stopsWithCoords[0].resolvedLat, stopsWithCoords[0].resolvedLng]
        : [45.368, -75.758];

    // Create Map instance if not exists
    let map = mapInstanceRef.current;
    if (!map) {
      map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 13,
        zoomControl: false // custom position
      });

      // Zoom control on top right
      L.control.zoom({ position: 'topright' }).addTo(map);

      // Add Tile Layer
      const tileLayer = L.tileLayer(getTileUrl(mapLayer), {
        subdomains: ['0', '1', '2', '3'],
        maxZoom: 20,
        attribution: getTileAttribution(mapLayer)
      });
      tileLayer.addTo(map);
      tileLayerRef.current = tileLayer;

      mapInstanceRef.current = map;
    }

    // Invalidate size on initial mount
    const timer = setTimeout(() => {
      map?.invalidateSize();
      if (hasFittedBoundsForShiftRef.current !== shift?.id && stopsWithCoords.length > 0) {
        handleFitBounds();
        hasFittedBoundsForShiftRef.current = shift?.id || 'init';
      }
    }, 150);

    return () => {
      clearTimeout(timer);
    };
  }, [shift?.id, stopsWithCoords.length, handleFitBounds]);

  // Update Markers & Driving Route when stops or shift changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear previous markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Clear previous vehicle marker
    if (vehicleMarkerRef.current) {
      vehicleMarkerRef.current.remove();
      vehicleMarkerRef.current = null;
    }

    // Clear previous polylines
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }
    if (polylineBorderRef.current) {
      polylineBorderRef.current.remove();
      polylineBorderRef.current = null;
    }

    // Clear previous home markers and connecting lines
    homeMarkersRef.current.forEach((m) => m.remove());
    homeMarkersRef.current = [];
    connectingLinesRef.current.forEach((l) => l.remove());
    connectingLinesRef.current = [];

    // Register global window helper for resetting stop location from popup HTML
    (window as any).__resetStopToHome = (stopId: number) => {
      handleSavePickupLocation(stopId, 0, 0, true);
    };

    if (stopsWithCoords.length === 0) {
      setRouteInfo(null);
      gpsSimulatorRef.current = null;
      setVehicleState(null);
      return;
    }

    // 1. Add Custom Markers (with Draggable capability for student stops)
    stopsWithCoords.forEach((stop, idx) => {
      const isSelected = selectedStopIndex === idx;
      const schoolTitle = stop.schoolName || stop.stopLocation;
      const markerIcon = createStopIcon(
        stop.sequence || idx + 1,
        stop.isSchool,
        isSelected,
        stop.isLate,
        stop.hasNoStudents,
        stop.lateMinutes,
        stop.isSchool ? schoolTitle : undefined,
        stop.isRelocated
      );

      // Make student stops draggable when edit mode is toggled or anytime
      const isDraggable = !stop.isSchool && isEditPickupMode;

      const marker = L.marker([stop.resolvedLat, stop.resolvedLng], {
        icon: markerIcon,
        draggable: isDraggable,
        autoPan: true,
        zIndexOffset: stop.isLate ? 1200 : stop.isSchool ? 1000 : 100 + idx
      });

      marker.bindPopup(buildPopupHtml(stop, idx), {
        maxWidth: 320,
        className: 'custom-bus-popup'
      });

      marker.on('click', () => {
        setSelectedStopIndex(idx);
      });

      // Handle drag end: immediately update position and prompt/persist
      marker.on('dragend', (e: L.DragEndEvent) => {
        const target = e.target as L.Marker;
        const newLatLng = target.getLatLng();
        handleSavePickupLocation(stop.stopId, newLatLng.lat, newLatLng.lng, false);
      });

      marker.addTo(map);
      markersRef.current.push(marker);

      // If stop is relocated from home, also display the student's home marker and connecting dashed line
      if (!stop.isSchool && stop.isRelocated) {
        // Home marker
        const homeMarker = L.marker([stop.homeLat, stop.homeLng], {
          icon: createHomeIcon(stop.sequence || idx + 1),
          zIndexOffset: 80 + idx
        });

        homeMarker.bindPopup(
          `<div style="font-family: -apple-system, sans-serif; padding: 4px; font-size: 11px;">
            <div style="font-weight: 800; color: #0369A1; margin-bottom: 2px;">🏠 Student Home Address #${stop.sequence || idx + 1}</div>
            <div style="color: #334155; margin-bottom: 4px;">${stop.stopLocation || 'Home Address'}</div>
            <div style="font-size: 10px; color: #059669; font-weight: 700;">Bus stop is ${stop.distMeters}m away</div>
          </div>`,
          { maxWidth: 240 }
        );

        homeMarker.addTo(map);
        homeMarkersRef.current.push(homeMarker);

        // Connecting dashed line between bus stop and home
        const connectingLine = L.polyline(
          [
            [stop.resolvedLat, stop.resolvedLng],
            [stop.homeLat, stop.homeLng]
          ],
          {
            color: '#059669',
            weight: 2.5,
            opacity: 0.85,
            dashArray: '4, 4'
          }
        ).addTo(map);

        connectingLinesRef.current.push(connectingLine);
      }
    });

    const stopHints: StopCoordinateHint[] = stopsWithCoords.map((s) => ({
      sequence: s.sequence || 1,
      title: s.isSchool ? (s.schoolName || s.stopLocation) : (s.stopLocation || `Stop #${s.sequence}`),
      lat: s.resolvedLat,
      lng: s.resolvedLng,
      isCompleted: !!s.actualArrivalTime
    }));

    const unitTitle = route.unitNumber ? `Bus ${route.unitNumber}` : 'Bus 1001';
    const driverTitle = route.driverName || 'Assigned Driver';

    // 2. Compute Road Driving Route via OSRM or straight polyline fallback
    if (stopsWithCoords.length >= 2) {
      setIsRouting(true);

      const coordsStr = stopsWithCoords.map((s) => `${s.resolvedLng},${s.resolvedLat}`).join(';');
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      fetch(osrmUrl, { signal: controller.signal })
        .then((res) => {
          clearTimeout(timeoutId);
          if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (data?.routes?.[0]?.geometry?.coordinates) {
            const rawCoords: [number, number][] = data.routes[0].geometry.coordinates.map(
              (pt: [number, number]) => [pt[1], pt[0]] // GeoJSON is [lng, lat], Leaflet is [lat, lng]
            );

            // Border casing line
            const borderPolyline = L.polyline(rawCoords, {
              color: '#1E3A8A',
              weight: 8,
              opacity: 0.7,
              lineCap: 'round',
              lineJoin: 'round'
            }).addTo(map);

            // Main vibrant blue road line
            const mainPolyline = L.polyline(rawCoords, {
              color: '#3B82F6',
              weight: 5,
              opacity: 0.95,
              lineCap: 'round',
              lineJoin: 'round'
            }).addTo(map);

            polylineBorderRef.current = borderPolyline;
            polylineRef.current = mainPolyline;

            const distKm = Math.round((data.routes[0].distance / 1000) * 10) / 10;
            const durMin = Math.round(data.routes[0].duration / 60);
            setRouteInfo({ distanceKm: distKm, durationMin: durMin });

            // Initialize GPS Telematics Simulator for this inspected route
            const simulator = new GpsSimulator(rawCoords, stopHints, unitTitle, driverTitle);
            simulator.setSpeedMultiplier(simSpeedMultiplier);
            gpsSimulatorRef.current = simulator;
            setVehicleState(simulator.getState());
          } else {
            throw new Error('No OSRM geometry found');
          }
        })
        .catch(() => {
          // Fallback to straight stop-to-stop corridor
          const stopCoords: [number, number][] = stopsWithCoords.map((s) => [s.resolvedLat, s.resolvedLng]);

          const borderPolyline = L.polyline(stopCoords, {
            color: '#1E3A8A',
            weight: 7,
            opacity: 0.7,
            dashArray: '8, 8'
          }).addTo(map);

          const mainPolyline = L.polyline(stopCoords, {
            color: '#3B82F6',
            weight: 4,
            opacity: 0.9,
            dashArray: '6, 6'
          }).addTo(map);

          polylineBorderRef.current = borderPolyline;
          polylineRef.current = mainPolyline;
          setRouteInfo(null);

          // Initialize GPS Telematics Simulator with stop coordinates
          const simulator = new GpsSimulator(stopCoords, stopHints, unitTitle, driverTitle);
          simulator.setSpeedMultiplier(simSpeedMultiplier);
          gpsSimulatorRef.current = simulator;
          setVehicleState(simulator.getState());
        })
        .finally(() => {
          setIsRouting(false);
          // Only automatically fit bounds when first loading this shift; do not reset zoom when dragging
          if (hasFittedBoundsForShiftRef.current !== shift?.id && stopsWithCoords.length > 0) {
            handleFitBounds();
            hasFittedBoundsForShiftRef.current = shift?.id || 'init';
          }
        });
    } else {
      if (hasFittedBoundsForShiftRef.current !== shift?.id && stopsWithCoords.length > 0) {
        handleFitBounds();
        hasFittedBoundsForShiftRef.current = shift?.id || 'init';
      }
    }
  }, [shift?.id, stopsWithCoords, isEditPickupMode, selectedStopIndex, handleSavePickupLocation]);

  // Periodic Telematics Ticker: smoothly moves vehicle along route path and updates map marker
  useEffect(() => {
    const timer = setInterval(() => {
      if (!gpsSimulatorRef.current || !mapInstanceRef.current) return;
      const nextState = gpsSimulatorRef.current.tick(1.2);
      setVehicleState(nextState);

      const map = mapInstanceRef.current;
      if (vehicleMarkerRef.current) {
        vehicleMarkerRef.current.setLatLng([nextState.lat, nextState.lng]);
        vehicleMarkerRef.current.setIcon(createVehicleIcon(nextState));
        const popup = vehicleMarkerRef.current.getPopup();
        if (popup && popup.isOpen()) {
          popup.setContent(buildVehiclePopupHtml(nextState));
        }
      } else {
        const vm = L.marker([nextState.lat, nextState.lng], {
          icon: createVehicleIcon(nextState),
          zIndexOffset: 2500
        });
        vm.bindPopup(buildVehiclePopupHtml(nextState), {
          maxWidth: 320,
          className: 'custom-bus-popup'
        });
        vm.addTo(map);
        vehicleMarkerRef.current = vm;
      }
    }, 1200);

    return () => clearInterval(timer);
  }, []);

  // Quick Action: Pan / Fly to Vehicle Location
  const handleLocateBus = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || !vehicleState) return;
    map.flyTo([vehicleState.lat, vehicleState.lng], Math.max(map.getZoom(), 15), {
      duration: 0.8
    });
    if (vehicleMarkerRef.current) {
      vehicleMarkerRef.current.openPopup();
    }
  }, [vehicleState]);

  // Quick Action: Play / Pause Simulation
  const handleToggleSimPause = useCallback(() => {
    if (gpsSimulatorRef.current) {
      const running = gpsSimulatorRef.current.toggleRunning();
      setIsSimPaused(!running);
    }
  }, []);

  // Quick Action: Cycle Speed Multiplier (1x -> 2x -> 5x -> 1x)
  const handleCycleSimSpeed = useCallback(() => {
    const next = simSpeedMultiplier === 1 ? 2 : simSpeedMultiplier === 2 ? 5 : 1;
    setSimSpeedMultiplier(next);
    if (gpsSimulatorRef.current) {
      gpsSimulatorRef.current.setSpeedMultiplier(next);
    }
  }, [simSpeedMultiplier]);

  // Handle Fullscreen resize
  useEffect(() => {
    const timer = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 200);
    return () => clearTimeout(timer);
  }, [isFullscreen]);

  const opDaysStr = shift ? formatOpDays(shift.runDays) : 'MTWRF';
  const badgeStyle = shift ? getShiftBadgeStyle(shift.shiftType, opDaysStr) : { bg: '', border: '', text: '', dot: '' };

  const totalAssignedStudents = useMemo(() => {
    return stops.reduce((acc, s) => acc + (s.assignedStudents?.length || 0), 0);
  }, [stops]);

  // Count how many school stops vs student stops
  const schoolStopsCount = useMemo(() => {
    return stopsWithCoords.filter((s) => s.isSchool).length;
  }, [stopsWithCoords]);

  const lateStopsCount = useMemo(() => {
    return stopsWithCoords.filter((s) => s.isLate).length;
  }, [stopsWithCoords]);

  const noStudentStopsCount = useMemo(() => {
    return stopsWithCoords.filter((s) => s.hasNoStudents).length;
  }, [stopsWithCoords]);

  const relocatedStopsCount = useMemo(() => {
    return stopsWithCoords.filter((s) => s.isRelocated && !s.isSchool).length;
  }, [stopsWithCoords]);

  return (
    <div
      className={`relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 flex flex-col shadow-2xl transition-all ${
        isFullscreen ? 'fixed inset-3 z-50 shadow-2xl border-amber-500/50' : ''
      }`}
      style={{ height: isFullscreen ? 'calc(100vh - 24px)' : height }}
    >
      {/* 1. Header Toolbar Overlay Container */}
      <div className="absolute top-3 left-3 right-14 z-[400] flex flex-col gap-2 pointer-events-none">
        {/* Top Control Bar: Left Info + Right Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          {/* Left: Shift Information Badge + Distinction Legend */}
          <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl px-3.5 py-2 shadow-xl flex flex-wrap items-center gap-3 pointer-events-auto">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs shrink-0">
                <Bus className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-white text-xs sm:text-sm">
                    {route.routeNo} • {shift?.shiftType || 'Shift'} Map
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${badgeStyle.bg} ${badgeStyle.border} ${badgeStyle.text}`}
                  >
                    {opDaysStr}
                  </span>
                  {/* Engine indicator */}
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Google Maps
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center space-x-2 mt-0.5">
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span className="font-mono text-slate-300">
                      {shift?.firstStopTime || '07:30'} - {shift?.lastStopTime || '08:30'}
                    </span>
                  </span>
                  <span>•</span>
                  <span>{stops.length} Stops</span>
                  <span>•</span>
                  <span className="flex items-center space-x-1">
                    <Users className="w-3 h-3 text-sky-400" />
                    <span>{totalAssignedStudents} Students</span>
                  </span>
                  {routeInfo && (
                    <>
                      <span>•</span>
                      <span className="text-amber-300 font-medium">
                        ~{routeInfo.distanceKm} km ({routeInfo.durationMin} min)
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Visual Distinction Legend for Stops */}
            <div className="hidden md:flex items-center gap-2 pl-3 border-l border-slate-700/80 text-[11px]">
              <div className="flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/40 px-2 py-0.5 rounded-md text-amber-300 font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-400 shadow-sm shadow-amber-400" />
                <span>🏫 School ({schoolStopsCount})</span>
              </div>
              <div className="flex items-center gap-1.5 bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 rounded-md text-blue-300 font-medium">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>👤 Student ({stops.length - schoolStopsCount})</span>
              </div>
              {relocatedStopsCount > 0 && (
                <div className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-500/50 px-2 py-0.5 rounded-md text-emerald-300 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
                  <span>🚌 Street Spot ({relocatedStopsCount})</span>
                </div>
              )}
              {lateStopsCount > 0 && (
                <div className="flex items-center gap-1.5 bg-rose-500/20 border border-rose-500/50 px-2 py-0.5 rounded-md text-rose-300 font-bold animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-rose-500 shadow-sm shadow-rose-500" />
                  <span>⚠️ Late ({lateStopsCount})</span>
                </div>
              )}
              {noStudentStopsCount > 0 && (
                <div className="flex items-center gap-1.5 bg-purple-500/15 border border-purple-500/40 px-2 py-0.5 rounded-md text-purple-300 font-medium">
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  <span>0 Students ({noStudentStopsCount})</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Map Control Buttons */}
          <div className="flex items-center space-x-1.5 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-1 shadow-xl pointer-events-auto">
            {/* Draggable stop repositioning toggle */}
            <button
              type="button"
              onClick={() => setIsEditPickupMode(!isEditPickupMode)}
              title={
                isEditPickupMode
                  ? 'Exit Stop Repositioning (Pins Locked)'
                  : 'Drag Stop Pins to Adjust Actual Bus Parking Locations'
              }
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                isEditPickupMode
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/30 ring-2 ring-emerald-400 animate-pulse'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Move className={`w-3.5 h-3.5 ${isEditPickupMode ? 'text-slate-950' : 'text-emerald-400'}`} />
              <span>{isEditPickupMode ? 'Done Adjusting' : 'Adjust Stops'}</span>
            </button>

            {/* Stop Sequence Optimization Button */}
            <button
              type="button"
              onClick={() => setIsOptimizeModalOpen(true)}
              title={t.stops.optimizeOrder || 'Optimize Stop Sequence'}
              className="px-2.5 py-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 fill-emerald-400 text-emerald-400" />
              <span>{t.stops.optimizeOrder || 'Optimize Order'}</span>
            </button>

            {/* Locate Bus Action Button */}
            {vehicleState && (
              <button
                type="button"
                onClick={handleLocateBus}
                title="Locate & Follow Moving Vehicle"
                className="px-2.5 py-1.5 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-500/15 border border-amber-500/40 text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer"
              >
                <Bus className="w-3.5 h-3.5 text-amber-400" />
                <span>Locate Bus</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleFitBounds}
              title="Fit All Stops in View"
              className="px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold flex items-center space-x-1 transition"
            >
              <Navigation className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Fit All Stops</span>
            </button>

            {/* Telematics Simulation Controls */}
            {vehicleState && (
              <div className="flex items-center space-x-1 pl-1 border-l border-slate-700/80">
                <button
                  type="button"
                  onClick={handleToggleSimPause}
                  title={isSimPaused ? 'Resume GPS Telematics' : 'Pause GPS Telematics'}
                  className={`p-1.5 rounded-lg text-xs transition ${
                    isSimPaused
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {isSimPaused ? <Play className="w-3.5 h-3.5 fill-amber-400" /> : <Pause className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={handleCycleSimSpeed}
                  title={`Simulation Speed: ${simSpeedMultiplier}x (Click to cycle)`}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-amber-300 hover:text-white border border-slate-700"
                >
                  {simSpeedMultiplier}x
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleToggleLayer}
              title="Toggle Map Style (Roadmap / Satellite / Terrain)"
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition ${
                mapLayer === 'satellite'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {mapLayer === 'satellite' ? 'Satellite' : mapLayer === 'terrain' ? 'Terrain' : 'Google Roadmap'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Exit Fullscreen' : 'Open Fullscreen'}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4 text-amber-400" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Floating Telematics Status HUD Pill */}
        {vehicleState && (
          <div className="self-start bg-slate-900/95 backdrop-blur border border-amber-500/50 rounded-xl px-3 py-1.5 text-xs shadow-xl flex items-center gap-2.5 pointer-events-auto">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-bold text-white flex items-center gap-1.5">
              <span>{vehicleState.unitNumber}</span>
              <span className="text-amber-400 font-mono text-[11px] font-bold">
                {vehicleState.status === 'at_stop' ? '🛑 Boarding Passengers' : `⚡ ${vehicleState.speedKmH} km/h`}
              </span>
            </span>
            <span className="text-slate-400 text-[11px] hidden sm:inline">
              • Next: <strong className="text-slate-200">{vehicleState.nextStopTitle}</strong>
            </span>
            {vehicleState.distanceToNextStopMeters > 0 && (
              <span className="text-[10px] text-slate-400 font-mono hidden md:inline">
                (~{vehicleState.distanceToNextStopMeters}m)
              </span>
            )}
            <button
              type="button"
              onClick={handleLocateBus}
              className="ml-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              Locate ↗
            </button>
          </div>
        )}

        {/* Repositioning Instructions Banner overlay when mode is active */}
        {isEditPickupMode && (
          <div className="bg-emerald-950/90 backdrop-blur border border-emerald-500/50 rounded-xl px-3.5 py-2 text-xs text-emerald-200 shadow-xl flex items-center justify-between gap-2 pointer-events-auto">
            <div className="flex items-center space-x-2">
              <span className="text-base">✋</span>
              <span>
                <strong>Stop Repositioning Active:</strong> Drag any blue/green student pin to set the actual bus parking spot on the street. Student home address is preserved with 🏠.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsEditPickupMode(false)}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-2.5 py-1 rounded-lg font-bold text-[11px] shrink-0 transition"
            >
              Done
            </button>
          </div>
        )}

        {/* Saving indicator */}
        {isSavingStop && (
          <div className="self-start bg-slate-900/90 backdrop-blur border border-emerald-500 rounded-lg px-2.5 py-1 flex items-center space-x-1.5 text-xs text-emerald-300 shadow-md pointer-events-auto">
            <RefreshCw className="w-3 h-3 text-emerald-400 animate-spin" />
            <span>Saving new stop coordinates...</span>
          </div>
        )}

        {/* Routing spinner indicator */}
        {isRouting && (
          <div className="self-start bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg px-2.5 py-1 flex items-center space-x-1.5 text-xs text-slate-300 shadow-md pointer-events-auto">
            <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
            <span>Calculating road turns...</span>
          </div>
        )}
      </div>

      {/* 2. Main Map Canvas Container */}
      <div className="relative flex-1 w-full bg-slate-950">
        <div ref={mapContainerRef} className="w-full h-full z-0" />
      </div>

      {/* 3. Interactive Bottom Stops Carousel */}
      <div className="border-t border-slate-800/90 bg-slate-900/95 backdrop-blur-md p-2.5 z-10 flex flex-col gap-1.5 shrink-0">
        <div className="flex items-center justify-between text-xs px-1">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-white text-xs flex items-center space-x-1.5">
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              <span>Shift Stops Sequence ({stopsWithCoords.length})</span>
            </span>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Click any stop to locate on map
            </span>
          </div>

          <div className="flex items-center space-x-2 text-[11px] text-slate-400 font-mono">
            <span>Bus #{route.unitNumber || '1001'}</span>
            <span>•</span>
            <span>Driver: {route.driverName || 'Robert Smith'}</span>
          </div>
        </div>

        {/* Horizontal scrollable list of stop cards with distinct School Stop styling */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {stopsWithCoords.length === 0 ? (
            <div className="py-2 text-xs text-slate-500 italic px-2">No stops recorded for this shift</div>
          ) : (
            stopsWithCoords.map((stop, idx) => {
              const isSelected = selectedStopIndex === idx;
              const isSchool = stop.isSchool;
              const isLate = stop.isLate;
              const hasNoStudents = stop.hasNoStudents;
              const assignedCount = stop.assignedStudents?.length || 0;
              const studentNames = (stop.assignedStudents || [])
                .map(
                  (s) =>
                    s.studentName ||
                    studentsMap[s.studentId]?.fullName ||
                    studentsMap[s.studentId]?.studentName ||
                    (s.studentNo ? `Student #${s.studentNo}` : '')
                )
                .filter(Boolean);
              const studentNamesStr = studentNames.join(', ');

              let cardContainerStyle =
                'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 text-slate-200';
              let badgeStyle = 'bg-blue-600 text-white font-bold';

              if (isSelected) {
                if (isLate) {
                  cardContainerStyle =
                    'bg-rose-500/25 border-rose-500 shadow-xl shadow-rose-500/25 ring-2 ring-rose-500 text-rose-100';
                  badgeStyle = 'bg-rose-600 text-white font-black shadow-md shadow-rose-500/30';
                } else if (isSchool) {
                  cardContainerStyle =
                    'bg-amber-500/25 border-amber-400 shadow-lg shadow-amber-500/20 ring-2 ring-amber-400 text-amber-100';
                  badgeStyle =
                    'bg-gradient-to-tr from-amber-600 to-amber-400 text-slate-950 font-black shadow-md shadow-amber-500/30';
                } else if (hasNoStudents) {
                  cardContainerStyle =
                    'bg-purple-950/50 border-purple-400 shadow-lg shadow-purple-500/25 ring-2 ring-purple-400 text-purple-100';
                  badgeStyle = 'bg-purple-600 text-white font-bold shadow-md shadow-purple-500/30';
                } else {
                  cardContainerStyle =
                    'bg-blue-500/20 border-blue-400 shadow-md shadow-blue-500/10 ring-2 ring-blue-400 text-blue-100';
                  badgeStyle = 'bg-blue-600 text-white font-bold';
                }
              } else {
                if (isLate) {
                  cardContainerStyle =
                    'bg-rose-950/40 border-rose-500/70 hover:border-rose-400 hover:bg-rose-900/40 shadow-sm shadow-rose-500/15 text-rose-200';
                  badgeStyle = 'bg-rose-600 text-white font-black shadow-sm shadow-rose-500/20';
                } else if (isSchool) {
                  cardContainerStyle =
                    'bg-amber-500/10 border-amber-500/40 hover:border-amber-400 hover:bg-amber-500/20 text-amber-200';
                  badgeStyle =
                    'bg-gradient-to-tr from-amber-600 to-amber-400 text-slate-950 font-black shadow-md shadow-amber-500/30';
                } else if (hasNoStudents) {
                  cardContainerStyle =
                    'bg-purple-950/30 border-purple-500/35 hover:border-purple-400/60 hover:bg-purple-900/30 text-purple-200';
                  badgeStyle = 'bg-purple-700/80 text-purple-200 font-semibold';
                } else {
                  cardContainerStyle =
                    'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 text-slate-200';
                  badgeStyle = 'bg-blue-600 text-white font-bold';
                }
              }

              return (
                <button
                  key={stop.stopId || idx}
                  type="button"
                  onClick={() => handleFocusStop(idx)}
                  className={`flex items-center space-x-2.5 px-3 py-2 rounded-xl text-left border transition shrink-0 max-w-[270px] sm:max-w-[310px] ${cardContainerStyle}`}
                >
                  {/* Distinct Sequence / Status Badge */}
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs shrink-0 ${badgeStyle}`}
                  >
                    {isSchool ? (
                      <GraduationCap className="w-4 h-4 text-slate-950" />
                    ) : (
                      stop.sequence || idx + 1
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      {/* Scheduled and Actual Times */}
                      <div className="flex items-center space-x-1.5 font-mono text-[11px] min-w-0 truncate">
                        <span
                          className={
                            isLate
                              ? 'text-rose-300 font-bold'
                              : isSchool
                              ? 'text-amber-300 font-bold'
                              : hasNoStudents
                              ? 'text-purple-300 font-semibold'
                              : 'text-slate-300 font-semibold'
                          }
                        >
                          {stop.pullawayTime || '07:30'}
                        </span>
                        {stop.actualArrivalTime && (
                          <span
                            className={`font-mono text-[10px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                              isLate
                                ? 'bg-rose-500/25 text-rose-200 border border-rose-500/50'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}
                            title={`Actual arrival: ${stop.actualArrivalTime}${isLate ? ` (+${stop.lateMinutes}m Late)` : ' (On-time)'}`}
                          >
                            Act: {stop.actualArrivalTime}
                          </span>
                        )}
                        {!stop.actualArrivalTime && isLate && (
                          <span className="text-rose-400 text-[10px] font-extrabold shrink-0">
                            +{stop.lateMinutes}m
                          </span>
                        )}
                      </div>

                      {/* Right Tag/Badge */}
                      {isLate ? (
                        <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-500/30 text-rose-200 border border-rose-500/50 shrink-0 flex items-center space-x-0.5 animate-pulse">
                          <span>⚠️</span>
                          <span>Late {stop.lateMinutes > 0 ? `+${stop.lateMinutes}m` : ''}</span>
                        </span>
                      ) : isSchool ? (
                        <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                          🏫 School
                        </span>
                      ) : stop.isRelocated ? (
                        <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
                          🚌 Spot {stop.distMeters > 0 ? `+${stop.distMeters}m` : ''}
                        </span>
                      ) : hasNoStudents ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 shrink-0">
                          0 stu
                        </span>
                      ) : assignedCount > 0 ? (
                        <span className="text-[10px] bg-blue-500/15 text-blue-300 border border-blue-500/30 px-1.5 py-0.2 rounded font-semibold shrink-0">
                          {assignedCount} {assignedCount === 1 ? 'stu' : 'students'}
                        </span>
                      ) : null}
                    </div>

                    {/* Student Name for Student Stop, School Name for School Stop */}
                    <div
                      className={`text-xs truncate mt-0.5 font-bold ${
                        isLate
                          ? 'text-rose-200'
                          : isSchool
                          ? 'text-amber-200'
                          : stop.isRelocated
                          ? 'text-emerald-200'
                          : hasNoStudents
                          ? 'text-purple-200'
                          : 'text-white'
                      }`}
                      title={
                        isSchool
                          ? stop.schoolName || stop.stopLocation
                          : studentNamesStr || (hasNoStudents ? 'No students assigned' : stop.stopLocation)
                      }
                    >
                      {isSchool ? (
                        stop.schoolName || stop.stopLocation
                      ) : studentNamesStr ? (
                        <span className="flex items-center space-x-1">
                          <span className={isLate ? 'text-rose-400' : stop.isRelocated ? 'text-emerald-400' : 'text-sky-400'}>
                            {stop.isRelocated ? '🚌' : '👤'}
                          </span>
                          <span className="truncate">{studentNamesStr}</span>
                        </span>
                      ) : hasNoStudents ? (
                        <span className="text-purple-300/80 italic font-medium">No assigned students</span>
                      ) : (
                        <span className="text-slate-200">{stop.stopLocation}</span>
                      )}
                    </div>

                    {/* Location Address line: show Bus Stop & Home Address */}
                    <div
                      className="text-[11px] text-slate-400 truncate mt-0.5"
                      title={
                        stop.isRelocated
                          ? `Bus Stop: ${stop.pickupLocation || 'Street Spot'} • Home: ${stop.stopLocation}`
                          : stop.stopLocation
                      }
                    >
                      {stop.isRelocated ? (
                        <span className="text-emerald-300/90 font-medium">
                          🚌 {stop.pickupLocation || 'Relocated Bus Spot'} <span className="text-slate-500">(Home: {stop.stopLocation})</span>
                        </span>
                      ) : (
                        stop.stopLocation
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Stop Sequence Optimization Modal */}
      {shift && (
        <OptimizeRouteModal
          isOpen={isOptimizeModalOpen}
          onClose={() => setIsOptimizeModalOpen(false)}
          shift={shift}
          route={route}
          onApplyOptimizedStops={handleApplyOptimizedStops}
        />
      )}
    </div>
  );
};
