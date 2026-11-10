import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SmsService } from './smsService';
import { apiRequest } from './api';

vi.mock('./api', () => ({
  apiRequest: vi.fn(),
}));

describe('SmsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls POST /api/sms/send with payload', async () => {
    const mockResponse = {
      id: 'sms-123',
      toPhone: '+16135550100',
      fromPhone: '+16135559999',
      body: 'Good morning Alice',
      direction: 'outbound',
      status: 'sent',
      createdAt: '2026-11-10T14:00:00Z',
    };
    vi.mocked(apiRequest).mockResolvedValueOnce(mockResponse);

    const result = await SmsService.sendSMS({
      toPhone: '613-555-0100',
      message: 'Good morning Alice',
      recipientName: 'Alice Driver',
      shiftId: 'DS-001',
    });

    expect(apiRequest).toHaveBeenCalledWith('/api/sms/send', {
      method: 'POST',
      body: JSON.stringify({
        toPhone: '613-555-0100',
        message: 'Good morning Alice',
        recipientName: 'Alice Driver',
        shiftId: 'DS-001',
      }),
    });
    expect(result).toEqual(mockResponse);
  });

  it('calls GET /api/sms/history with normalized query parameters', async () => {
    const mockHistory = [
      {
        id: 'sms-1',
        toPhone: '+16135550100',
        body: 'Check-in reminder',
        direction: 'outbound',
      },
      {
        id: 'sms-2',
        fromPhone: '+16135550100',
        body: 'On my way',
        direction: 'inbound',
      },
    ];
    vi.mocked(apiRequest).mockResolvedValueOnce(mockHistory);

    const result = await SmsService.getDailyHistory('613-555-0100', '2026-11-10');

    expect(apiRequest).toHaveBeenCalledWith(
      '/api/sms/history?phone=613-555-0100&date=2026-11-10',
      { method: 'GET' }
    );
    expect(result).toEqual(mockHistory);
  });

  it('returns empty array if apiRequest returns non-array or null', async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce(null);

    const result = await SmsService.getDailyHistory('613-555-0100');
    expect(result).toEqual([]);
  });
});
