import { apiRequest } from './api';
import type { SMSMessage, SendSMSPayload } from '../types/sms';

export const SmsService = {
  sendSMS: async (payload: SendSMSPayload): Promise<SMSMessage> => {
    return apiRequest<SMSMessage>('/api/sms/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getDailyHistory: async (phone: string, date?: string): Promise<SMSMessage[]> => {
    const params = new URLSearchParams();
    if (phone) params.set('phone', phone);
    if (date) params.set('date', date);
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await apiRequest<SMSMessage[]>(`/api/sms/history${query}`, {
      method: 'GET',
    });
    return Array.isArray(res) ? res : [];
  },
};
