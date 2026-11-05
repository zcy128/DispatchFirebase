import { apiRequest } from './api';
import {
  CheckInReminderSettings,
  SimulationRunResult,
  SimulationSettings,
} from '../types/dispatch';

export function getCheckInReminderSettings(): Promise<CheckInReminderSettings> {
  return apiRequest<CheckInReminderSettings>('/api/dispatch/check-in-reminder-settings');
}

export function saveCheckInReminderSettings(
  settings: CheckInReminderSettings
): Promise<CheckInReminderSettings> {
  return apiRequest<CheckInReminderSettings>('/api/dispatch/check-in-reminder-settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

export function getSimulationSettings(): Promise<SimulationSettings> {
  return apiRequest<SimulationSettings>('/api/dispatch/simulation-settings');
}

export function saveSimulationSettings(settings: SimulationSettings): Promise<SimulationSettings> {
  return apiRequest<SimulationSettings>('/api/dispatch/simulation-settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

export function runSimulation(date?: string, forceOverwrite: boolean = true): Promise<SimulationRunResult> {
  return apiRequest<SimulationRunResult>('/api/dispatch/simulation/run', {
    method: 'POST',
    body: JSON.stringify({ date: date || '', forceOverwrite }),
  });
}
