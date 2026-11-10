import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SmsConversationModal } from './SmsConversationModal';
import type { DispatchShift } from '../../types/dispatch';

vi.mock('../../services/smsService', () => ({
  SmsService: {
    sendSMS: vi.fn(),
    getDailyHistory: vi.fn().mockResolvedValue([]),
  },
}));

describe('SmsConversationModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockShift: DispatchShift = {
    id: 'DS-2026-11-10-TEST-001',
    dispatchDate: '2026-11-10',
    routeId: 'RT-001',
    routeNo: 'OCDSB-001',
    routeName: 'Route 001 - Merivale',
    shiftType: 'AM',
    driverId: 'EMP-1',
    driverName: 'Alice Driver',
    driverPhone: '613-555-0100',
    vehicleId: 101,
    unitNumber: '1001',
    plateNumber: 'ON-1001',
    firstStopTime: '07:30',
    lastStopTime: '08:30',
    totalStops: 2,
    completedStops: 0,
    lateMinutes: 0,
    health: 'green',
    stops: [],
  };

  it('renders modal header, recipient details, and composer elements when open', () => {
    const html = renderToStaticMarkup(
      React.createElement(SmsConversationModal, {
        isOpen: true,
        onClose: vi.fn(),
        recipientPhone: '613-555-0100',
        recipientName: 'Alice Driver',
        recipientRole: 'driver',
        shift: mockShift,
        selectedDate: '2026-11-10',
      })
    );

    // Header info
    expect(html).toContain('Alice Driver');
    expect(html).toContain('613-555-0100');
    expect(html).toContain('driver');
    expect(html).toContain('Route OCDSB-001 (AM)');
    expect(html).toContain('Twilio Gateway');

    // Quick templates
    expect(html).toContain('Check-In Reminder');
    expect(html).toContain('Delay Notice');
    expect(html).toContain('Urgent Callback');
    expect(html).toContain('Pre-Trip Inspection');

    // Composer elements
    expect(html).toContain('Type SMS message to Alice Driver');
    expect(html).toContain('Send SMS');
    expect(html).toContain('0 / 160 chars');
    expect(html).toContain('href="sms:613-555-0100"');
    expect(html).toContain('Native SMS');
  });

  it('does not render anything when isOpen is false', () => {
    const html = renderToStaticMarkup(
      React.createElement(SmsConversationModal, {
        isOpen: false,
        onClose: vi.fn(),
        recipientPhone: '613-555-0100',
        recipientName: 'Alice Driver',
        selectedDate: '2026-11-10',
      })
    );

    expect(html).toBe('');
  });
});
