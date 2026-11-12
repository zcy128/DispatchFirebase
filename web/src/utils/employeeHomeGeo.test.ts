import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  buildGoogleMapsSearchUrl,
  clearEmployeeGeocodeCache,
  geocodeEmployeeAddress,
  getEmployeeHomeAddressText,
  resolveInitialEmployeeLocation,
} from './employeeHomeGeo';
import type { Employee } from '../types/employee';

describe('employeeHomeGeo', () => {
  beforeEach(() => {
    clearEmployeeGeocodeCache();
    vi.restoreAllMocks();
  });

  const baseEmployee: Employee = {
    id: 'emp-100',
    employeeNumber: 'EMP-100',
    firstName: 'Alex',
    lastName: 'Driver',
    fullName: 'Alex Driver',
    jobPosition: 'School Bus Driver',
    isActive: true,
  };

  it('extracts home address from personalAddress or falls back to employeeContacts', () => {
    expect(
      getEmployeeHomeAddressText({
        ...baseEmployee,
        personalAddress: '  245 Bank St, Ottawa, ON  ',
      })
    ).toBe('245 Bank St, Ottawa, ON');

    expect(
      getEmployeeHomeAddressText({
        ...baseEmployee,
        employeeContacts: [
          {
            contactId: 'c1',
            primaryContact: true,
            contactName: 'Home',
            street: '45 Meadowlands Dr',
            city: 'Nepean',
            postalCode: 'K2G 2R5',
            active: true,
          },
        ],
      })
    ).toBe('45 Meadowlands Dr, Nepean, K2G 2R5');

    expect(getEmployeeHomeAddressText(baseEmployee)).toBe('');
  });

  it('resolves exact GPS coordinates with priority over address fallback', () => {
    const loc = resolveInitialEmployeeLocation({
      ...baseEmployee,
      personalAddress: '245 Bank St, Ottawa, ON',
      lat: 45.415,
      lng: -75.696,
    });

    expect(loc).toEqual({
      lat: 45.415,
      lng: -75.696,
      source: 'exact',
      addressText: '245 Bank St, Ottawa, ON',
    });
  });

  it('resolves estimated coordinates when only address is recorded and null when empty', () => {
    const estimated = resolveInitialEmployeeLocation({
      ...baseEmployee,
      personalAddress: '45 Meadowlands Dr, Nepean, ON',
    });

    expect(estimated).not.toBeNull();
    expect(estimated?.source).toBe('estimated');
    expect(estimated?.addressText).toBe('45 Meadowlands Dr, Nepean, ON');

    expect(resolveInitialEmployeeLocation(baseEmployee)).toBeNull();
  });

  it('geocodes address via Nominatim and caches the resolved coordinates', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ lat: '45.41123', lon: '-75.69812' }],
    });
    vi.stubGlobal('fetch', fetchMock);

    const emp: Employee = {
      ...baseEmployee,
      personalAddress: '245 Bank St, Ottawa, ON',
    };

    const point = await geocodeEmployeeAddress('245 Bank St, Ottawa, ON');
    expect(point).toEqual({ lat: 45.41123, lng: -75.69812 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Subsequent resolution hits the in-memory geocode cache synchronously
    const cachedLoc = resolveInitialEmployeeLocation(emp);
    expect(cachedLoc).toEqual({
      lat: 45.41123,
      lng: -75.69812,
      source: 'geocoded',
      addressText: '245 Bank St, Ottawa, ON',
    });

    // Second geocode call uses cache without hitting network
    const secondPoint = await geocodeEmployeeAddress('245 bank st, ottawa, on');
    expect(secondPoint).toEqual({ lat: 45.41123, lng: -75.69812 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('builds Google Maps search URLs from address or coordinates', () => {
    expect(
      buildGoogleMapsSearchUrl({
        ...baseEmployee,
        personalAddress: '245 Bank St, Ottawa, ON',
      })
    ).toBe('https://www.google.com/maps/search/?api=1&query=245%20Bank%20St%2C%20Ottawa%2C%20ON');

    expect(
      buildGoogleMapsSearchUrl(baseEmployee, { lat: 45.41123, lng: -75.69812 })
    ).toBe('https://www.google.com/maps/search/?api=1&query=45.41123,-75.69812');

    expect(buildGoogleMapsSearchUrl(baseEmployee, null)).toBeNull();
  });
});
