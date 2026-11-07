import React, { useEffect, useMemo, useState } from 'react';
import { Mail, X } from 'lucide-react';
import { BusRoute, BusRouteShift } from '../../types/route';
import { Employee } from '../../types/employee';
import { School } from '../../types/school';
import { Student } from '../../types/student';
import { apiRequest } from '../../services/api';
import {
  CompanyContact,
  CompanyContactsService,
  INITIAL_COMPANY_CONTACTS,
} from '../../services/companyContactsService';
import { StudentService } from '../../services/studentService';
import {
  buildRouteSheetPdf,
  collectAssignedStudentIds,
  routeSheetFileName,
  routeSheetPdfBase64,
  studentHasContactDetails,
} from '../../utils/routeSheetPdf';

interface RouteSheetShareModalProps {
  route: BusRoute;
  shifts: BusRouteShift[];
  studentsMap: Record<number, Student>;
  schools: School[];
  employees: Employee[];
  onClose: () => void;
}

type RecipientKind = 'driver' | 'office';

interface RecipientChoice {
  kind: RecipientKind;
  name: string;
  email: string;
  detail: string;
}

function employeeEmail(employee: Employee): string {
  return (employee.preferredEmail || employee.workEmail || employee.personalEmail || '').trim();
}

function isDriver(employee: Employee, route: BusRoute): boolean {
  const role = (employee.role || '').toLowerCase();
  const job = (employee.jobPosition || '').toLowerCase();
  if (role === 'driver' || job.includes('driver')) return true;
  const id = String(employee.employeeId ?? employee.employeeNumber ?? employee.id);
  return id === route.driverId || employee.fullName === route.driverName;
}

export const RouteSheetShareModal: React.FC<RouteSheetShareModalProps> = ({
  route,
  shifts,
  studentsMap,
  schools,
  employees,
  onClose,
}) => {
  const [kind, setKind] = useState<RecipientKind>('driver');
  const [officeContacts, setOfficeContacts] = useState<CompanyContact[]>(INITIAL_COMPANY_CONTACTS);
  const [selectedEmail, setSelectedEmail] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  useEffect(() => {
    const unsubscribe = CompanyContactsService.subscribeToCompanyContacts((contacts) => {
      if (contacts.length > 0) setOfficeContacts(contacts);
    });
    return unsubscribe;
  }, []);

  const recipients = useMemo(() => {
    if (kind === 'driver') {
      const choices: RecipientChoice[] = employees
        .filter((employee) => employee.isActive !== false && isDriver(employee, route))
        .map((employee) => ({
          kind: 'driver' as const,
          name: employee.fullName || `${employee.firstName} ${employee.lastName}`.trim(),
          email: employeeEmail(employee),
          detail: employee.fullName === route.driverName ? 'Assigned driver' : 'Driver',
        }));
      if (
        route.driverName &&
        !choices.some((choice) => choice.name === route.driverName)
      ) {
        choices.unshift({
          kind: 'driver',
          name: route.driverName,
          email: '',
          detail: 'Assigned driver',
        });
      }
      return choices;
    }
    return officeContacts
      .filter((contact) => contact.email?.includes('@'))
      .map((contact) => ({
        kind: 'office' as const,
        name: contact.name,
        email: contact.email.trim(),
        detail: contact.department,
      }));
  }, [employees, kind, officeContacts, route.driverName]);

  useEffect(() => {
    const first = recipients.find((choice) => choice.email);
    setSelectedEmail(first?.email || '');
    setError('');
    setResult('');
  }, [recipients]);

  const selected = recipients.find((choice) => choice.email === selectedEmail);

  const send = async () => {
    if (!selected?.email) {
      setError('Choose a recipient with an email address.');
      return;
    }
    setSending(true);
    setError('');
    setResult('');
    try {
      const fileName = routeSheetFileName(route.routeNo);
      const response = await apiRequest<{ ok: boolean; simulated: boolean }>(
        `/routes/${encodeURIComponent(route.id)}/share-sheet`,
        {
          method: 'POST',
          body: JSON.stringify({
            to: selected.email,
            recipientName: selected.name,
            recipientKind: selected.kind,
            subject: `Route sheet ${route.routeNo}`,
            note: note.trim(),
            fileName,
            pdfBase64: routeSheetPdfBase64({
              route,
              shifts,
              studentsMap: await ensureRouteSheetStudents(shifts, studentsMap, route.routeNo),
              schools,
            }),
          }),
        },
      );
      setResult(
        response.simulated
          ? `The route sheet for ${selected.name} was recorded. Mail delivery is not configured on this server, so it was not sent to an inbox.`
          : `Route sheet emailed to ${selected.name}.`,
      );
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : 'Could not send the route sheet.';
      setError(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-white">Share route sheet</h2>
            <p className="text-xs text-slate-400">Email the CCSD-style PDF for {route.routeNo}.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-2 gap-2">
            {(['driver', 'office'] as RecipientKind[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setKind(option)}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                  kind === option
                    ? 'border-amber-400 bg-amber-500/15 text-amber-200'
                    : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {option === 'driver' ? 'Driver' : 'Office'}
              </button>
            ))}
          </div>

          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Recipient
            <select
              value={selectedEmail}
              onChange={(event) => setSelectedEmail(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              {recipients.length === 0 && <option value="">No recipients found</option>}
              {recipients.map((choice) => (
                <option key={`${choice.kind}-${choice.email}-${choice.name}`} value={choice.email} disabled={!choice.email}>
                  {choice.name} · {choice.detail}{choice.email ? ` · ${choice.email}` : ' · no email'}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Note
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Optional note for the driver or office."
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </label>

          {error && <p className="text-sm text-rose-300">{error}</p>}
          {result && <p className="text-sm text-emerald-300">{result}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-800 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
            Close
          </button>
          <button
            type="button"
            onClick={send}
            disabled={sending || !selected?.email}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50"
          >
            <Mail className="h-4 w-4" />
            {sending ? 'Sending...' : 'Send email'}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Route sheets print guardian lines from student master records.
 * The routes page often has an empty studentsMap until Students is opened,
 * so fill missing riders (and any rider without contacts) before export.
 */
export async function ensureRouteSheetStudents(
  shifts: BusRouteShift[],
  existing: Record<number, Student> = {},
  routeNo?: string,
): Promise<Record<number, Student>> {
  const needed = collectAssignedStudentIds(shifts);
  const map: Record<number, Student> = { ...existing };
  if (needed.length === 0) return map;

  const missing = needed.filter((id) => !studentHasContactDetails(map[id]));
  if (missing.length === 0) return map;

  if (routeNo?.trim()) {
    try {
      const listed = await StudentService.list({ route: routeNo.trim() });
      for (const student of listed) {
        if (student.studentId > 0) map[student.studentId] = student;
      }
    } catch (error) {
      console.warn('Failed to load route students for the sheet:', error);
    }
  }

  const stillMissing = needed.filter((id) => !studentHasContactDetails(map[id]));
  await Promise.all(
    stillMissing.map(async (studentId) => {
      try {
        map[studentId] = await StudentService.getByStudentId(studentId);
      } catch (error) {
        console.warn(`Failed to load student ${studentId} for the sheet:`, error);
      }
    }),
  );

  return map;
}

export async function downloadRouteSheet(input: {
  route: BusRoute;
  shifts: BusRouteShift[];
  studentsMap: Record<number, Student>;
  schools: School[];
}) {
  const studentsMap = await ensureRouteSheetStudents(
    input.shifts,
    input.studentsMap,
    input.route.routeNo,
  );
  const doc = buildRouteSheetPdf({ ...input, studentsMap });
  doc.save(routeSheetFileName(input.route.routeNo));
}
