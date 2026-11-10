import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DispatchShift } from '../types/dispatch';
import {
  calculateDynamicShiftLateness,
  diffMinutes,
  evaluateAutoDelayAlertTrigger,
  isAlertMessageShift,
  minutesToTimeString,
  subtractMinutesFromTime,
  timeStringToMinutes,
} from './dispatchDelayUtils';

function shift(partial: Partial<DispatchShift>): DispatchShift {
  return {
    id: 'DS-2026-11-02-OCDSB-001-AM',
    dispatchDate: '2026-11-02',
    routeId: 'RT-001',
    routeNo: 'OCDSB-001',
    routeName: 'Route 001 - Hillcrest High School',
    shiftType: 'AM',
    driverName: 'Driver1 Doe',
    unitNumber: '1001',
    scheduledCheckInTime: '06:30',
    isDriverCheckedIn: false,
    stops: [],
    ...partial,
  } as DispatchShift;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('time conversion', () => {
  it('converts clock times and wraps backwards past midnight', () => {
    expect(timeStringToMinutes('07:31')).toBe(451);
    expect(minutesToTimeString(451)).toBe('07:31');
    expect(subtractMinutesFromTime('08:00', 60)).toBe('07:00');
    expect(diffMinutes('07:46', '06:41')).toBe(65);
    expect(minutesToTimeString(-30)).toBe('23:30');
  });
});

describe('calculateDynamicShiftLateness', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 2, 7, 0, 0));
  });

  it('counts a completed check-in that is 11 minutes late as yellow', () => {
    const info = calculateDynamicShiftLateness(shift({
      isDriverCheckedIn: true,
      driverCheckedInAt: '06:41',
    }), '07:00', true);

    expect(info.driverLateMinutes).toBe(11);
    expect(info.isDriverOverdue).toBe(false);
    expect(info.isCheckInOverdue).toBe(false);
    expect(info.effectiveHealth).toBe('yellow');
  });

  it('marks an assigned driver overdue once the scheduled check-in has passed', () => {
    const info = calculateDynamicShiftLateness(shift({}), '07:00', true);

    expect(info.isDriverOverdue).toBe(true);
    expect(info.driverLateMinutes).toBe(30);
    expect(info.isCheckInOverdue).toBe(true);
    expect(info.effectiveHealth).toBe('red');
  });

  it('stays green when the driver is checked in before the scheduled time', () => {
    const info = calculateDynamicShiftLateness(shift({
      isDriverCheckedIn: true,
      driverCheckedInAt: '06:20',
    }), '06:25', true);

    expect(info.driverLateMinutes).toBe(0);
    expect(info.effectiveHealth).toBe('green');
  });

  it('turns red when the bus or driver is missing, or a stop is at least 15 minutes late', () => {
    const missing = calculateDynamicShiftLateness(shift({
      driverName: '',
      isDriverCheckedIn: true,
      driverCheckedInAt: '06:30',
    }), '06:30', true);
    expect(missing.isMissingDriver).toBe(true);
    expect(missing.effectiveHealth).toBe('red');

    const lateStop = calculateDynamicShiftLateness(shift({
      isDriverCheckedIn: true,
      driverCheckedInAt: '06:30',
      stops: [{
        stopId: 1,
        sequence: 1,
        stopLocation: 'Hillcrest High School',
        stopScheduleTime: '07:00',
        stopType: 'SchoolDropoff',
      }],
    }), '07:20', true);
    expect(lateStop.maxStopLateMinutes).toBe(20);
    expect(lateStop.hasStopDelay).toBe(true);
    expect(lateStop.effectiveHealth).toBe('red');
  });
});

describe('evaluateAutoDelayAlertTrigger and isAlertMessageShift', () => {
  it('triggers tier 1 auto delay alert at 15 minutes late and tier 2 at 45 minutes late', () => {
    const s15 = shift({
      isDriverCheckedIn: true,
      driverCheckedInAt: '06:30',
      stops: [
        {
          stopId: 1,
          sequence: 1,
          stopLocation: 'Stop 1',
          stopScheduleTime: '07:00',
          stopType: 'StudentPickup',
        },
      ],
    });
    const info15 = calculateDynamicShiftLateness(s15, '07:16', true);
    const trigger1 = evaluateAutoDelayAlertTrigger(s15, info15, {
      autoDelayAlertEnabled: true,
      autoDelayFirstAlertMinutes: 15,
      autoDelaySecondAlertMinutes: 45,
    });
    expect(trigger1.shouldSend).toBe(true);
    expect(trigger1.tier).toBe(1);
    expect(trigger1.thresholdMinutes).toBe(15);
    expect(trigger1.actualLateMinutes).toBe(16);

    // Once tier 1 is recorded in parentNotifications, 20m late should NOT re-trigger tier 1
    const sWithTier1 = shift({
      ...s15,
      parentNotifications: [
        {
          id: 'PN-1',
          timestamp: '2026-11-02T07:16:00Z',
          timeStr: '07:16',
          delayMinutes: 16,
          reasonCategory: 'other',
          reasonLabel: 'Auto Delay Alert (15m Threshold)',
          messageText: 'Delayed 16m',
          channels: ['sms'],
          scope: 'all',
          recipientsCount: 1,
        },
      ],
    });
    const info20 = calculateDynamicShiftLateness(sWithTier1, '07:20', true);
    const triggerAfterTier1 = evaluateAutoDelayAlertTrigger(sWithTier1, info20, {
      autoDelayAlertEnabled: true,
      autoDelayFirstAlertMinutes: 15,
      autoDelaySecondAlertMinutes: 45,
    });
    expect(triggerAfterTier1.shouldSend).toBe(false);

    // At 46 minutes late, tier 2 (45m threshold) triggers
    const info46 = calculateDynamicShiftLateness(sWithTier1, '07:46', true);
    const trigger2 = evaluateAutoDelayAlertTrigger(sWithTier1, info46, {
      autoDelayAlertEnabled: true,
      autoDelayFirstAlertMinutes: 15,
      autoDelaySecondAlertMinutes: 45,
    });
    expect(trigger2.shouldSend).toBe(true);
    expect(trigger2.tier).toBe(2);
    expect(trigger2.thresholdMinutes).toBe(45);
    expect(trigger2.actualLateMinutes).toBe(46);

    // When disabled, never triggers
    const triggerDisabled = evaluateAutoDelayAlertTrigger(s15, info15, {
      autoDelayAlertEnabled: false,
      autoDelayFirstAlertMinutes: 15,
      autoDelaySecondAlertMinutes: 45,
    });
    expect(triggerDisabled.shouldSend).toBe(false);
    expect(isAlertMessageShift(sWithTier1, info20)).toBe(true);
  });
});
