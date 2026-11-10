export interface SMSMessage {
  id: string;
  direction: 'outbound' | 'inbound';
  fromPhone: string;
  toPhone: string;
  normalizedPhone: string;
  message: string;
  recipientName?: string;
  senderName?: string;
  shiftId?: string;
  routeNo?: string;
  status: 'sent' | 'delivered' | 'received' | 'failed';
  createdAt: string;
  dateStr: string;
}

export interface SendSMSPayload {
  toPhone: string;
  message: string;
  recipientName?: string;
  shiftId?: string;
  routeNo?: string;
}
