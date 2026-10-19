import { DispatchService } from '../services/dispatchService';
import { DispatchShift } from '../types/dispatch';

interface LogActionParams {
  date: string;
  type: string;
  detail: string;
  shift?: DispatchShift | { id?: string; routeNo?: string; shiftType?: string } | null;
  user?: string;
}

export const logDispatchAction = async ({
  date,
  type,
  detail,
  shift,
  user,
}: LogActionParams): Promise<void> => {
  try {
    const now = new Date();
    // Formats as "2026-04-02 10:58:24 a.m." matching screenshot format
    const timeStr =
      now.toLocaleDateString('en-CA') +
      ' ' +
      now
        .toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
        .toLowerCase();

    let actor = user;
    if (!actor) {
      try {
        const storedMock = localStorage.getItem('dispatch_mock_user');
        if (storedMock) {
          const parsed = JSON.parse(storedMock);
          actor = parsed.name || parsed.displayName || parsed.email;
        }
      } catch {
        // ignore
      }
    }
    if (!actor) {
      actor = 'Dispatcher';
    }

    await DispatchService.createChangeLog({
      dispatchDate: date,
      shiftId: shift?.id || '',
      routeNo: shift?.routeNo || '',
      shiftType: shift?.shiftType || '',
      type,
      detail,
      time: timeStr,
      user: actor,
    });
  } catch (err) {
    console.warn('[dispatchLogger] Failed to record change log:', err);
  }
};
