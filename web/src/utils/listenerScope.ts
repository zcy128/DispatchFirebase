export function listenerOwnEmployeeId(): string {
  try {
    const raw = localStorage.getItem('dispatch_auth_user');
    if (!raw) return '';
    const user = JSON.parse(raw) as { role?: string; employeeId?: string };
    const role = String(user?.role || '').toLowerCase();
    const employeeId = String(user?.employeeId || '');
    if ((role === 'driver' || role === 'helper') && employeeId) {
      return employeeId;
    }
  } catch {
    return '';
  }
  return '';
}
