import { Employee } from '../types/employee';
import { LatLngPoint } from './geoUtils';
import { resolveEmployeeCoordinates } from './deadheadCalculator';

export type EmployeeLocationSource = 'exact' | 'geocoded' | 'estimated';

export interface EmployeeHomeLocation {
  lat: number;
  lng: number;
  source: EmployeeLocationSource;
  addressText: string;
}

const geocodeCache = new Map<string, LatLngPoint | null>();

/**
 * Extracts a formatted home address string from the employee profile or primary contact fallback.
 */
export function getEmployeeHomeAddressText(employee: Employee): string {
  const direct = (employee.personalAddress || '').trim();
  if (direct) return direct;

  const contact = employee.employeeContacts?.find((c) => c.street || c.city);
  if (!contact) return '';

  return [contact.street, contact.city, contact.postalCode]
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join(', ');
}

/**
 * Resolves immediate synchronous home coordinates for an employee.
 * Priority:
 * 1. Explicit GPS coordinates (emp.lat / emp.lng)
 * 2. Previously geocoded address cache hit
 * 3. Regional address estimator fallback (resolveEmployeeCoordinates)
 */
export function resolveInitialEmployeeLocation(
  employee: Employee
): EmployeeHomeLocation | null {
  const addressText = getEmployeeHomeAddressText(employee);

  if (
    typeof employee.lat === 'number' &&
    typeof employee.lng === 'number' &&
    employee.lat !== 0 &&
    employee.lng !== 0 &&
    !Number.isNaN(employee.lat) &&
    !Number.isNaN(employee.lng)
  ) {
    return {
      lat: employee.lat,
      lng: employee.lng,
      source: 'exact',
      addressText,
    };
  }

  if (addressText) {
    const cacheKey = addressText.toLowerCase();
    const cached = geocodeCache.get(cacheKey);
    if (cached) {
      return {
        lat: cached.lat,
        lng: cached.lng,
        source: 'geocoded',
        addressText,
      };
    }
  }

  const estimated = resolveEmployeeCoordinates(employee);
  if (!estimated) return null;

  return {
    lat: estimated.lat,
    lng: estimated.lng,
    source: 'estimated',
    addressText,
  };
}

/**
 * Builds an external Google Maps search URL from the employee's address or coordinates.
 */
export function buildGoogleMapsSearchUrl(
  employee: Employee,
  coords?: LatLngPoint | null
): string | null {
  const addressText = getEmployeeHomeAddressText(employee);
  if (addressText) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`;
  }
  if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
  }
  return null;
}

/**
 * Geocodes a street address string using OpenStreetMap Nominatim with in-memory caching.
 */
export async function geocodeEmployeeAddress(
  address: string,
  signal?: AbortSignal
): Promise<LatLngPoint | null> {
  const normalized = address.trim();
  if (!normalized) return null;

  const cacheKey = normalized.toLowerCase();
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey) ?? null;
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(normalized)}`;
    const response = await fetch(url, {
      signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data: Array<{ lat?: string; lon?: string }> = await response.json();
    const first = Array.isArray(data) ? data[0] : undefined;
    const lat = first?.lat ? Number(first.lat) : NaN;
    const lng = first?.lon ? Number(first.lon) : NaN;

    if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
      const point = { lat, lng };
      geocodeCache.set(cacheKey, point);
      return point;
    }

    geocodeCache.set(cacheKey, null);
    return null;
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      return null;
    }
    return null;
  }
}

export function clearEmployeeGeocodeCache(): void {
  geocodeCache.clear();
}
