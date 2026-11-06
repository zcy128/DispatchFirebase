import React from 'react';
import { BusRoute, BusRouteShift, formatOpDays } from '../../types/route';
import { School } from '../../types/school';
import { Student } from '../../types/student';
import { PCY_TECH_LOGO_DATA_URL } from '../../assets/logoDataUrl';
import {
  boardCountsForStops,
  routeRunFields,
  sortRouteSheetShifts,
  studentSheetLines,
} from '../../utils/routeSheetPdf';

interface RouteSheetPreviewProps {
  route: BusRoute;
  shifts: BusRouteShift[];
  studentsMap: Record<number, Student>;
  schools: School[];
}

export const RouteSheetPreview: React.FC<RouteSheetPreviewProps> = ({
  route,
  shifts,
  studentsMap,
  schools,
}) => {
  const ordered = sortRouteSheetShifts(shifts);

  return (
    <div className="overflow-x-auto">
      <div className="mx-auto w-full max-w-[820px] space-y-6">
        {ordered.length === 0 ? (
          <p className="text-sm text-slate-400">No runs are assigned to this route.</p>
        ) : (
          ordered.map((shift) => {
            const stops = [...shift.stops].sort((a, b) => a.sequence - b.sequence);
            const loads = boardCountsForStops(
              stops.map((stop) => ({
                stopType: stop.stopType,
                studentCount: stop.assignedStudents?.length ?? 0,
              })),
            );
            const fields = routeRunFields(route, shift, schools);
            return (
              <article key={shift.id} className="rounded-xl bg-white text-slate-900 shadow-xl">
                <header className="flex items-start justify-between gap-4 border-b-2 border-slate-900 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={PCY_TECH_LOGO_DATA_URL}
                      alt="PCY Tech"
                      className="h-12 w-12 rounded-xl bg-slate-950 object-cover"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-lg font-black tracking-tight">PCY TECH</span>
                        <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-950">
                          Fleet Cloud
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                        School Bus Fleet Operations
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black tracking-wide">ROUTE SHEET</p>
                    <p className="font-mono text-xs text-slate-600">
                      {route.routeNo} · {shift.shiftType} · {formatOpDays(shift.runDays)}
                    </p>
                  </div>
                </header>

                <div className="space-y-4 px-5 py-4 text-sm">
                  <h3 className="text-base font-bold">
                    Run {route.routeNo}-{shift.shiftType}
                  </h3>
                  <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                    {fields.map((field) => (
                      <div key={field.label} className="grid grid-cols-[7.5rem_1fr] gap-2">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{field.label}</span>
                        <span className="text-slate-900">{field.value || '—'}</span>
                      </div>
                    ))}
                  </div>
                  {route.instructions?.trim() && (
                    <p className="text-sm">
                      <span className="mr-2 text-xs font-bold uppercase tracking-wide text-slate-500">Driver Notes</span>
                      {route.instructions.trim()}
                    </p>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600">
                          <th className="px-2 py-1.5">#</th>
                          <th className="px-2 py-1.5">Time</th>
                          <th className="px-2 py-1.5">Description (Crossing)</th>
                          <th className="px-2 py-1.5">Stop Ld</th>
                          <th className="px-2 py-1.5">Run Ld</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stops.map((stop, index) => (
                          <tr key={stop.stopId || index} className="border-t border-slate-200 align-top">
                            <td className="px-2 py-2 font-bold">{index + 1}</td>
                            <td className="px-2 py-2 font-mono">{stop.pullawayTime}</td>
                            <td className="px-2 py-2">
                              <p className="font-semibold">{stop.stopLocation}</p>
                              {(stop.comment || stop.instruction) && (
                                <p className="mt-1 italic text-slate-600">
                                  NOTE: {[stop.comment, stop.instruction].filter(Boolean).join(' ')}
                                </p>
                              )}
                              <div className="mt-2 space-y-2">
                                {(stop.assignedStudents ?? []).map((assigned) => {
                                  const lines = studentSheetLines(
                                    studentsMap[assigned.studentId],
                                    assigned.studentName || assigned.studentNo,
                                  );
                                  return (
                                    <div key={assigned.studentId || assigned.studentNo}>
                                      {lines.map((line, lineIndex) => (
                                        <p key={`${line.text}-${lineIndex}`} className={line.bold ? 'font-bold' : 'text-slate-700'}>
                                          {line.text}
                                        </p>
                                      ))}
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="px-2 py-2">{loads[index]?.stopLoad ?? 0}</td>
                            <td className="px-2 py-2">{loads[index]?.runLoad ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
};
