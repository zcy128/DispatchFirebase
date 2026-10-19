import ExcelJS from 'exceljs';
import { BiweeklyEmployeeGroup } from '../views/BiweeklyPayrollView';
import { Employee } from '../types/employee';
import { addDaysToDateString } from './dateUtils';

/**
 * Format date string (YYYY-MM-DD) to "Sunday, June 7, 2026"
 */
export function formatLongPayPeriodDate(dateStr: string): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const weekday = dt.toLocaleDateString('en-US', { weekday: 'long' });
  const month = dt.toLocaleDateString('en-US', { month: 'long' });
  const day = dt.getDate();
  const year = dt.getFullYear();
  return `${weekday}, ${month} ${day}, ${year}`;
}

/**
 * Format date range (YYYY-MM-DD, YYYY-MM-DD) to "(06/07 to 06/13)"
 */
export function formatShortPayPeriodRange(d1: string, d2: string): string {
  if (!d1 || !d2) return '';
  const [, m1, day1] = d1.split('-').map(Number);
  const [, m2, day2] = d2.split('-').map(Number);
  const s1 = `${String(m1).padStart(2, '0')}/${String(day1).padStart(2, '0')}`;
  const s2 = `${String(m2).padStart(2, '0')}/${String(day2).padStart(2, '0')}`;
  return `${s1} to ${s2}`;
}

export interface ExportBiweeklyExcelOptions {
  startDate: string;
  endDate: string;
  groupedData: BiweeklyEmployeeGroup[];
  employees: Employee[];
  includeExpenses?: boolean;
}

/**
 * Generates and downloads a Microsoft Excel (.xlsx) workbook strictly matching
 * the user's template:
 * - Row 1: "FOR PAY PERIOD Sunday, June 7, 2026 To Saturday, June 20, 2026 "
 * - Row 2: Headers (Name, Position, Route, Rate, Week 1 Runs, Week 2 Runs, Total Runs, Sub Total, Total, Hourly Rate, Hours, Week 1 Hours, Week 2 Hours, Total Hours, Total Amount, Total Paid)
 * - Employee rows with License Class on line 2, multiple routes, subtotals, and blank separators.
 * - Sheet 2: Approved Expense Claims breakdown (if expenses exist)
 * - Sheet 3: Statutory Holiday Route Assignment credits (if holidays exist)
 */
export async function exportBiweeklyPayrollToExcel({
  startDate,
  endDate,
  groupedData,
  employees,
  includeExpenses = true,
}: ExportBiweeklyExcelOptions): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'School Bus Dispatch PWA';
  workbook.created = new Date();

  // Compute sub-period dates
  const week1EndDate = addDaysToDateString(startDate, 6);
  const week2StartDate = addDaysToDateString(startDate, 7);

  const longStartDate = formatLongPayPeriodDate(startDate);
  const longEndDate = formatLongPayPeriodDate(endDate);
  const week1RangeStr = formatShortPayPeriodRange(startDate, week1EndDate);
  const week2RangeStr = formatShortPayPeriodRange(week2StartDate, endDate);

  // =========================================================================
  // SHEET 1: BI-WEEKLY PAYROLL (Matching user template exactly)
  // =========================================================================
  const ws = workbook.addWorksheet('Bi-Weekly Payroll', {
    views: [{ showGridLines: true }],
  });

  // Set column widths
  ws.columns = [
    { key: 'name', width: 28 }, // A: Name
    { key: 'position', width: 18 }, // B: Position
    { key: 'route', width: 16 }, // C: Route
    { key: 'rate', width: 10 }, // D: Rate
    { key: 'w1Runs', width: 26 }, // E: Week 1 Runs (MM/DD to MM/DD)
    { key: 'w2Runs', width: 26 }, // F: Week 2 Runs (MM/DD to MM/DD)
    { key: 'totalRuns', width: 12 }, // G: Total Runs
    { key: 'subTotal', width: 12 }, // H: Sub Total
    { key: 'total', width: 13 }, // I: Total
    { key: 'hourlyRate', width: 12 }, // J: Hourly Rate
    { key: 'hours', width: 12 }, // K: Hours
    { key: 'w1Hours', width: 26 }, // L: Week 1 Hours (MM/DD to MM/DD)
    { key: 'w2Hours', width: 26 }, // M: Week 2 Hours (MM/DD to MM/DD)
    { key: 'totalHours', width: 13 }, // N: Total Hours
    { key: 'totalAmount', width: 14 }, // O: Total Amount
    { key: 'totalPaid', width: 14 }, // P: Total Paid
  ];

  // Row 1: Title Banner
  const titleText = `FOR PAY PERIOD ${longStartDate} To ${longEndDate} `;
  const titleRow = ws.addRow([titleText]);
  titleRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1E293B' } };
  titleRow.alignment = { vertical: 'middle' };
  titleRow.height = 24;

  // Row 2: Headers (Exact header names from attachment)
  const headerRow = ws.addRow([
    'Name',
    'Position',
    'Route',
    'Rate',
    `Week 1 Runs (${week1RangeStr})`,
    `Week 2 Runs (${week2RangeStr})`,
    'Total Runs',
    'Sub Total',
    'Total',
    'Hourly Rate',
    'Hours',
    `Week 1 Hours (${week1RangeStr})`,
    `Week 2 Hours (${week2RangeStr})`,
    'Total Hours',
    'Total Amount',
    'Total Paid',
  ]);

  headerRow.height = 26;
  headerRow.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.eachCell((cell, colNumber) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };
    if (colNumber <= 3) {
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    }
  });

  // Employee Map lookup for Job Position & License Class
  const empLookupMap = new Map<string, Employee>();
  employees.forEach((e) => {
    empLookupMap.set(String(e.id), e);
    if (e.employeeNumber) empLookupMap.set(String(e.employeeNumber), e);
  });

  // Populate Employee Blocks
  groupedData.forEach((empGroup) => {
    const empMeta = empLookupMap.get(empGroup.employeeId);
    const position = empMeta?.jobPosition || 'Driver';
    const licenseClass = empMeta?.driverLicense?.licenseClass
      ? empMeta.driverLicense.licenseClass
      : 'Class 2';

    const rowsCount = empGroup.rows.length;

    if (rowsCount === 0) {
      // Employee has no route runs (e.g. only expenses)
      const r = ws.addRow([
        `${empGroup.employeeName} (${empGroup.employeeId})`,
        position,
        '-',
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        empGroup.totalPayout,
      ]);
      r.getCell(16).numFmt = '$#,##0.00';
      return;
    }

    empGroup.rows.forEach((row, idx) => {
      let nameColVal = '';
      let posColVal = '';

      if (idx === 0) {
        // Line 1: Employee Name (ID) & Position
        nameColVal = `${empGroup.employeeName} (${empGroup.employeeId})`;
        posColVal = position;
      } else if (idx === 1) {
        // Line 2: License Class (e.g. "Class 2" or "Class 4")
        nameColVal = licenseClass;
        posColVal = '';
      } else {
        nameColVal = '';
        posColVal = '';
      }

      const totalRuns = row.totalRuns;
      const subTotal = row.subTotalPay;
      const hourlyRate = row.hourlyRate;
      const hours = row.eiHours;
      const w1Hours = row.week1Hours;
      const w2Hours = row.week2Hours;
      const totalHours = row.subTotalHours;

      // In the last row of employee, populate Total, Total Amount, and Total Paid
      const isLastRow = idx === rowsCount - 1;
      const empTotalPay = isLastRow ? empGroup.grandTotalPay : '';
      const empTotalHours = isLastRow ? empGroup.grandTotalHours : '';
      const empTotalAmount = isLastRow ? empGroup.grandTotalPay : '';
      const empTotalPaid = isLastRow ? empGroup.totalPayout : '';

      const dataRow = ws.addRow([
        nameColVal,
        posColVal,
        row.routeNo,
        row.payRate,
        row.week1Runs,
        row.week2Runs,
        totalRuns,
        subTotal,
        empTotalPay,
        hourlyRate > 0 ? hourlyRate : '',
        hours > 0 ? hours : '',
        w1Hours,
        w2Hours,
        empTotalHours !== '' ? empTotalHours : totalHours,
        empTotalAmount,
        empTotalPaid,
      ]);

      dataRow.font = { name: 'Arial', size: 9.5 };
      dataRow.alignment = { vertical: 'middle' };

      // Number formatting
      dataRow.getCell(4).numFmt = '$#,##0.00'; // Rate
      dataRow.getCell(5).numFmt = '#,##0'; // W1 Runs
      dataRow.getCell(6).numFmt = '#,##0'; // W2 Runs
      dataRow.getCell(7).numFmt = '#,##0'; // Total Runs
      dataRow.getCell(8).numFmt = '$#,##0.00'; // Sub Total
      if (empTotalPay !== '') dataRow.getCell(9).numFmt = '$#,##0.00'; // Total
      if (hourlyRate > 0) dataRow.getCell(10).numFmt = '$#,##0.00'; // Hourly Rate
      if (hours > 0) dataRow.getCell(11).numFmt = '0.00000'; // Hours
      dataRow.getCell(12).numFmt = '0.00'; // W1 Hours
      dataRow.getCell(13).numFmt = '0.00'; // W2 Hours
      dataRow.getCell(14).numFmt = '0.00'; // Total Hours
      if (empTotalAmount !== '') dataRow.getCell(15).numFmt = '$#,##0.00'; // Total Amount
      if (empTotalPaid !== '') dataRow.getCell(16).numFmt = '$#,##0.00'; // Total Paid

      // Alignments
      dataRow.getCell(4).alignment = { horizontal: 'right' };
      dataRow.getCell(5).alignment = { horizontal: 'center' };
      dataRow.getCell(6).alignment = { horizontal: 'center' };
      dataRow.getCell(7).alignment = { horizontal: 'center' };
      dataRow.getCell(8).alignment = { horizontal: 'right' };
      dataRow.getCell(9).alignment = { horizontal: 'right' };
      dataRow.getCell(10).alignment = { horizontal: 'right' };
      dataRow.getCell(11).alignment = { horizontal: 'right' };
      dataRow.getCell(12).alignment = { horizontal: 'right' };
      dataRow.getCell(13).alignment = { horizontal: 'right' };
      dataRow.getCell(14).alignment = { horizontal: 'right' };
      dataRow.getCell(15).alignment = { horizontal: 'right' };
      dataRow.getCell(16).alignment = { horizontal: 'right' };

      // Highlight totals in the last line of employee
      if (isLastRow) {
        dataRow.getCell(9).font = { bold: true, name: 'Arial', size: 9.5 };
        dataRow.getCell(14).font = { bold: true, name: 'Arial', size: 9.5 };
        dataRow.getCell(15).font = { bold: true, name: 'Arial', size: 9.5 };
        dataRow.getCell(16).font = {
          bold: true,
          name: 'Arial',
          size: 10,
          color: { argb: 'FF047857' }, // Emerald green
        };
      }
    });

    // If employee has approved expenses, add an expense breakdown line
    if (includeExpenses && empGroup.expenses.totalAmount > 0) {
      const catDescriptions = Object.values(empGroup.expenses.byCategory)
        .map((c) => `${c.label}: $${c.amount.toFixed(2)}`)
        .join(', ');

      const expRow = ws.addRow([
        '',
        'Approved Expenses',
        'EXPENSES',
        '',
        '',
        '',
        '',
        empGroup.expenses.totalAmount,
        '',
        '',
        '',
        '',
        '',
        '',
        empGroup.expenses.totalAmount,
        empGroup.totalPayout,
      ]);

      expRow.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF047857' } };
      expRow.getCell(8).numFmt = '$#,##0.00';
      expRow.getCell(15).numFmt = '$#,##0.00';
      expRow.getCell(16).numFmt = '$#,##0.00';
      expRow.getCell(3).note = catDescriptions;
    }

    // Blank separator rows between employees (strictly matching template)
    for (let b = 0; b < 2; b++) {
      ws.addRow([]);
    }
  });

  // Grand Total Row at bottom
  let grandTotalW1Pay = 0;
  let grandTotalW2Pay = 0;
  let grandTotalPay = 0;
  let grandTotalW1Hours = 0;
  let grandTotalW2Hours = 0;
  let grandTotalHours = 0;
  let grandTotalRuns = 0;
  let grandTotalPayout = 0;

  groupedData.forEach((g) => {
    grandTotalW1Pay += g.totalWeek1Pay;
    grandTotalW2Pay += g.totalWeek2Pay;
    grandTotalPay += g.grandTotalPay;
    grandTotalW1Hours += g.totalWeek1Hours;
    grandTotalW2Hours += g.totalWeek2Hours;
    grandTotalHours += g.grandTotalHours;
    grandTotalRuns += g.grandTotalRuns;
    grandTotalPayout += g.totalPayout;
  });

  const grandRow = ws.addRow([
    'TOTAL / SUMMARY',
    `${groupedData.length} Staff`,
    '',
    '',
    '',
    '',
    grandTotalRuns,
    grandTotalPay,
    grandTotalPay,
    '',
    '',
    grandTotalW1Hours,
    grandTotalW2Hours,
    grandTotalHours,
    grandTotalPay,
    grandTotalPayout,
  ]);

  grandRow.height = 24;
  grandRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
  grandRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF475569' } },
      bottom: { style: 'double', color: { argb: 'FF0F172A' } },
    };
  });
  grandRow.getCell(7).numFmt = '#,##0';
  grandRow.getCell(8).numFmt = '$#,##0.00';
  grandRow.getCell(9).numFmt = '$#,##0.00';
  grandRow.getCell(12).numFmt = '0.00';
  grandRow.getCell(13).numFmt = '0.00';
  grandRow.getCell(14).numFmt = '0.00';
  grandRow.getCell(15).numFmt = '$#,##0.00';
  grandRow.getCell(16).numFmt = '$#,##0.00';

  // =========================================================================
  // SHEET 2: APPROVED EXPENSES BREAKDOWN
  // =========================================================================
  const allApprovedClaims = groupedData.flatMap((g) => g.expenses.claims);
  if (allApprovedClaims.length > 0) {
    const expSheet = workbook.addWorksheet('Approved Expenses', {
      views: [{ showGridLines: true }],
    });

    expSheet.columns = [
      { key: 'claimId', width: 22 },
      { key: 'empId', width: 14 },
      { key: 'empName', width: 24 },
      { key: 'date', width: 14 },
      { key: 'route', width: 14 },
      { key: 'category', width: 22 },
      { key: 'amount', width: 14 },
      { key: 'notes', width: 36 },
      { key: 'status', width: 12 },
    ];

    const expHeader = expSheet.addRow([
      'Claim ID',
      'Employee ID',
      'Employee Name',
      'Claim Date',
      'Route No',
      'Expense Category',
      'Amount',
      'Notes / Reason',
      'Status',
    ]);
    expHeader.height = 24;
    expHeader.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    expHeader.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDCFCE7' }, // Light emerald
      };
      cell.border = {
        bottom: { style: 'medium', color: { argb: 'FF16A34A' } },
      };
    });

    allApprovedClaims.forEach((claim) => {
      if (Array.isArray(claim.lines) && claim.lines.length > 0) {
        claim.lines.forEach((l) => {
          const r = expSheet.addRow([
            claim.id,
            claim.employeeId,
            claim.employeeName,
            claim.claimDate,
            claim.routeNo || '-',
            l.categoryDisplayName || l.categoryCode,
            l.amount,
            l.note || '',
            'Approved',
          ]);
          r.getCell(7).numFmt = '$#,##0.00';
          r.font = { name: 'Arial', size: 9.5 };
        });
      } else {
        const r = expSheet.addRow([
          claim.id,
          claim.employeeId,
          claim.employeeName,
          claim.claimDate,
          claim.routeNo || '-',
          'General Expense',
          claim.totalAmount,
          claim.approvalNotes || '',
          'Approved',
        ]);
        r.getCell(7).numFmt = '$#,##0.00';
        r.font = { name: 'Arial', size: 9.5 };
      }
    });
  }

  // =========================================================================
  // WRITE FILE & TRIGGER BROWSER DOWNLOAD
  // =========================================================================
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Biweekly_Payroll_${startDate}_to_${endDate}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
