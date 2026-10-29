import { BiweeklyEmployeeGroup } from '../views/BiweeklyPayrollView';

export type QuickBooksExportFormat =
  | 'qbo_time_activity_csv'
  | 'qbo_summary_csv'
  | 'qbd_iif'
  | 'canadian_payroll_csv';

export interface QuickBooksExportParams {
  format: QuickBooksExportFormat;
  startDate: string;
  endDate: string;
  groupedData: BiweeklyEmployeeGroup[];
  includeExpenses?: boolean;
  singleEmployeeSuffix?: string;
}

const triggerDownload = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const escapeCsv = (val: string | number | undefined | null): string => {
  const s = String(val ?? '').replace(/"/g, '""');
  return `"${s}"`;
};

/**
 * Converts YYYY-MM-DD to MM/DD/YYYY for QuickBooks Desktop IIF compatibility.
 */
const toQbDate = (dateStr: string): string => {
  const parts = (dateStr || '').split('-');
  if (parts.length === 3) {
    return `${parts[1]}/${parts[2]}/${parts[0]}`;
  }
  return dateStr;
};

/**
 * Converts decimal hours (e.g. 2.5) to QuickBooks Desktop TIMEACT H:MM format (e.g. 2:30).
 */
const toQbDuration = (decimalHours: number): string => {
  const safeHours = Math.max(0, Number(decimalHours || 0));
  const wholeHours = Math.floor(safeHours);
  const minutes = Math.round((safeHours - wholeHours) * 60);
  if (minutes === 60) {
    return `${wholeHours + 1}:00`;
  }
  return `${wholeHours}:${String(minutes).padStart(2, '0')}`;
};

/**
 * Exports Bi-Weekly Payroll data into the selected QuickBooks / Canadian Payroll format.
 */
export const exportPayrollForQuickBooks = ({
  format,
  startDate,
  endDate,
  groupedData,
  includeExpenses = true,
  singleEmployeeSuffix = '',
}: QuickBooksExportParams): void => {
  const suffix = singleEmployeeSuffix
    ? `_${singleEmployeeSuffix}_${startDate}_to_${endDate}`
    : `_${startDate}_to_${endDate}`;

  // ─── 1. QuickBooks Online (QBO) TimeActivity Import CSV ───────────────────
  if (format === 'qbo_time_activity_csv') {
    const rows: string[] = [];
    rows.push(
      [
        'TxnDate',
        'EmployeeName',
        'EmployeeID',
        'Customer',
        'ServiceItem',
        'PayrollItem',
        'Hours',
        'HourlyRate',
        'Amount',
        'BillableStatus',
        'Description',
      ]
        .map(escapeCsv)
        .join(',')
    );

    groupedData.forEach((grp) => {
      grp.dailyRecords.forEach((rec) => {
        const d = rec.dispatchDate || startDate;
        const payAmt = Number(rec.payAmount || rec.originalPayRate || 0);
        const hrs = Number(rec.eiHours || rec.originalEiHours || 0);
        const effHourly = hrs > 0 ? Number((payAmt / hrs).toFixed(4)) : payAmt;
        const isHol =
          rec.rateSource === 'holiday_route_assignment' || rec.id.startsWith('HOLIDAY-');
        const shiftUpper = (rec.shiftType || 'AM').toUpperCase();
        const customer = rec.schoolBoardCode || grp.schoolBoardCode || 'School Board';
        const serviceItem = rec.isCharter || shiftUpper === 'CHARTER'
          ? 'Charter Transportation'
          : 'School Bus Route Driving';
        const payrollItem = isHol ? 'Statutory Holiday Pay' : 'Regular Route Pay';
        const desc = isHol
          ? `${rec.routeNo} (${shiftUpper}) - ${rec.rateDescription || 'Statutory Holiday Credit'}`
          : `Route ${rec.routeNo} (${shiftUpper} Shift)${
              rec.checkInTime || rec.checkOutTime
                ? ` [${rec.checkInTime || '--'}-${rec.checkOutTime || '--'}]`
                : ''
            }`;

        rows.push(
          [
            d,
            grp.employeeName,
            grp.employeeId,
            customer,
            serviceItem,
            payrollItem,
            hrs.toFixed(2),
            effHourly.toFixed(4),
            payAmt.toFixed(2),
            'NotBillable',
            desc,
          ]
            .map(escapeCsv)
            .join(',')
        );
      });

      if (includeExpenses && grp.expenses.totalAmount > 0) {
        Object.values(grp.expenses.byCategory).forEach((cat) => {
          rows.push(
            [
              endDate,
              grp.employeeName,
              grp.employeeId,
              grp.schoolBoardCode || 'Fleet Operations',
              'Employee Reimbursement',
              `Expense - ${cat.label}`,
              '0.00',
              '0.0000',
              cat.amount.toFixed(2),
              'NotBillable',
              `Approved Expense Reimbursement: ${cat.label} (${cat.count} claim(s))`,
            ]
              .map(escapeCsv)
              .join(',')
          );
        });
      }
    });

    triggerDownload(
      rows.join('\n'),
      `QBO_TimeActivities${suffix}.csv`,
      'text/csv;charset=utf-8;'
    );
    return;
  }

  // ─── 2. QuickBooks Online (QBO) Bi-Weekly Payroll Summary CSV ─────────────
  if (format === 'qbo_summary_csv') {
    const rows: string[] = [];
    rows.push(
      [
        'PayPeriodStart',
        'PayPeriodEnd',
        'EmployeeID',
        'EmployeeName',
        'SchoolBoard',
        'RegularShifts',
        'RegularHours_EI',
        'RegularWages',
        'StatHolidayShifts',
        'StatHolidayHours_EI',
        'StatHolidayPay',
        'TotalInsurableHours_EI',
        'GrossWages',
        'Expense_Fuel',
        'Expense_Parking',
        'Expense_Other',
        'TotalApprovedExpenses',
        'NetTotalPayout',
      ]
        .map(escapeCsv)
        .join(',')
    );

    groupedData.forEach((grp) => {
      const regRuns = Math.max(0, grp.grandTotalRuns - grp.totalHolidayRuns);
      const regPay = Number(Math.max(0, grp.grandTotalPay - grp.totalHolidayPay).toFixed(2));
      const holHours = grp.dailyRecords
        .filter((r) => r.rateSource === 'holiday_route_assignment' || r.id.startsWith('HOLIDAY-'))
        .reduce((sum, r) => sum + Number(r.eiHours || r.originalEiHours || 0), 0);
      const regHours = Number(Math.max(0, grp.grandTotalHours - holHours).toFixed(2));

      const fuelAmt = includeExpenses ? grp.expenses.byCategory['fuel']?.amount || 0 : 0;
      const parkAmt = includeExpenses ? grp.expenses.byCategory['parking']?.amount || 0 : 0;
      const totalExp = includeExpenses ? grp.expenses.totalAmount : 0;
      const otherAmt = Math.max(0, totalExp - fuelAmt - parkAmt);
      const netPayout = Number((grp.grandTotalPay + totalExp).toFixed(2));

      rows.push(
        [
          startDate,
          endDate,
          grp.employeeId,
          grp.employeeName,
          grp.schoolBoardCode || '',
          regRuns,
          regHours.toFixed(2),
          regPay.toFixed(2),
          grp.totalHolidayRuns,
          holHours.toFixed(2),
          grp.totalHolidayPay.toFixed(2),
          grp.grandTotalHours.toFixed(2),
          grp.grandTotalPay.toFixed(2),
          fuelAmt.toFixed(2),
          parkAmt.toFixed(2),
          otherAmt.toFixed(2),
          totalExp.toFixed(2),
          netPayout.toFixed(2),
        ]
          .map(escapeCsv)
          .join(',')
      );
    });

    triggerDownload(
      rows.join('\n'),
      `QBO_Payroll_Summary${suffix}.csv`,
      'text/csv;charset=utf-8;'
    );
    return;
  }

  // ─── 3. QuickBooks Desktop Canada Native .IIF Timesheet File ──────────────
  if (format === 'qbd_iif') {
    const iifLines: string[] = [];
    // Official Intuit TIMEACT header definition
    iifLines.push(
      ['!TIMEACT', 'DATE', 'JOB', 'EMP', 'ITEM', 'PITEM', 'DURATION', 'PROJ', 'NOTE', 'BILLINGSTATUS'].join(
        '\t'
      )
    );

    groupedData.forEach((grp) => {
      grp.dailyRecords.forEach((rec) => {
        const d = toQbDate(rec.dispatchDate || startDate);
        const payAmt = Number(rec.payAmount || rec.originalPayRate || 0);
        const hrs = Number(rec.eiHours || rec.originalEiHours || 0);
        const duration = toQbDuration(hrs);
        const isHol =
          rec.rateSource === 'holiday_route_assignment' || rec.id.startsWith('HOLIDAY-');
        const shiftUpper = (rec.shiftType || 'AM').toUpperCase();
        const job = rec.schoolBoardCode || grp.schoolBoardCode || 'School Board';
        const serviceItem = rec.isCharter || shiftUpper === 'CHARTER'
          ? 'Charter Driving'
          : 'Route Driving';
        const payrollItem = isHol ? 'Stat Holiday Pay' : 'Regular Pay';
        const note = `Route ${rec.routeNo} (${shiftUpper}) - Rate $${payAmt.toFixed(2)} [ID:${grp.employeeId}]`.replace(
          /[\t\r\n]/g,
          ' '
        );

        iifLines.push(
          [
            'TIMEACT',
            d,
            job,
            grp.employeeName,
            serviceItem,
            payrollItem,
            duration,
            rec.routeNo || '',
            note,
            '0',
          ].join('\t')
        );
      });
    });

    triggerDownload(
      iifLines.join('\r\n'),
      `QuickBooks_Desktop_Timesheet${suffix}.iif`,
      'text/plain;charset=utf-8;'
    );
    return;
  }

  // ─── 4. Wagepoint / ADP / Ceridian Powerpay (Canada) Batch CSV ────────────
  if (format === 'canadian_payroll_csv') {
    const rows: string[] = [];
    rows.push(
      [
        'Employee ID',
        'Employee Name',
        'Pay Period Start',
        'Pay Period End',
        'Regular Hours (EI)',
        'Regular Earnings ($)',
        'Stat Holiday Hours (EI)',
        'Stat Holiday Pay ($)',
        'Total Insurable Hours (ROE/EI)',
        'Total Gross Wages ($)',
        'Non-Taxable Expense Reimbursement ($)',
        'Net Total Payout ($)',
      ]
        .map(escapeCsv)
        .join(',')
    );

    groupedData.forEach((grp) => {
      const regPay = Number(Math.max(0, grp.grandTotalPay - grp.totalHolidayPay).toFixed(2));
      const holHours = grp.dailyRecords
        .filter((r) => r.rateSource === 'holiday_route_assignment' || r.id.startsWith('HOLIDAY-'))
        .reduce((sum, r) => sum + Number(r.eiHours || r.originalEiHours || 0), 0);
      const regHours = Number(Math.max(0, grp.grandTotalHours - holHours).toFixed(2));
      const expAmt = includeExpenses ? grp.expenses.totalAmount : 0;
      const netPayout = Number((grp.grandTotalPay + expAmt).toFixed(2));

      rows.push(
        [
          grp.employeeId,
          grp.employeeName,
          startDate,
          endDate,
          regHours.toFixed(2),
          regPay.toFixed(2),
          holHours.toFixed(2),
          grp.totalHolidayPay.toFixed(2),
          grp.grandTotalHours.toFixed(2),
          grp.grandTotalPay.toFixed(2),
          expAmt.toFixed(2),
          netPayout.toFixed(2),
        ]
          .map(escapeCsv)
          .join(',')
      );
    });

    triggerDownload(
      rows.join('\n'),
      `Canadian_Payroll_Wagepoint_ADP${suffix}.csv`,
      'text/csv;charset=utf-8;'
    );
  }
};
