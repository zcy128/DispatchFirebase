import jsPDF from 'jspdf';
import { BiweeklyEmployeeGroup } from '../views/BiweeklyPayrollView';
import { PCY_TECH_LOGO_DATA_URL } from '../assets/logoDataUrl';

export interface ExportDriverTimesheetPdfOptions {
  empGroup: BiweeklyEmployeeGroup;
  startDate: string;
  endDate: string;
  week1EndDate: string;
  week2StartDate: string;
}

const formatWeekdayShort = (dateStr: string): string => {
  try {
    const d = new Date(`${dateStr}T00:00:00`);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
};

export const exportDriverTimesheetToPDF = ({
  empGroup,
  startDate,
  endDate,
  week1EndDate,
  week2StartDate,
}: ExportDriverTimesheetPdfOptions): void => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  let y = 12;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 18) {
      doc.addPage();
      y = 14;
      return true;
    }
    return false;
  };

  // ─── 1. Top Header Banner ─────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(margin, y, contentWidth, 24, 3, 3, 'F');

  try {
    if (PCY_TECH_LOGO_DATA_URL) {
      doc.addImage(PCY_TECH_LOGO_DATA_URL, 'PNG', margin + 4, y + 4, 16, 16);
    }
  } catch {
    // Fallback if logo fails to render
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('DRIVER BI-WEEKLY TIMESHEET & PAYROLL STATEMENT', margin + 23, y + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(
    `Pay Period: ${startDate} to ${endDate}  |  Week 1: ${startDate} - ${week1EndDate}  |  Week 2: ${week2StartDate} - ${endDate}`,
    margin + 23,
    y + 16.5
  );

  y += 28;

  // ─── 2. Driver Information Strip ──────────────────────────────────────────
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Driver: ${empGroup.employeeName}`, margin + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Employee ID: ${empGroup.employeeId}   |   School Board: ${empGroup.schoolBoardCode || 'Standard'}   |   Total Dispatch Shifts: ${empGroup.grandTotalRuns}`,
    margin + 4,
    y + 11.2
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(180, 83, 9); // amber-700
  doc.text(
    `Net Payout: $${empGroup.totalPayout.toFixed(2)}`,
    pageWidth - margin - 4,
    y + 8.8,
    { align: 'right' }
  );

  y += 18;

  // ─── 3. Five Summary KPI Cards ────────────────────────────────────────────
  const cardGap = 2.5;
  const cardWidth = (contentWidth - cardGap * 4) / 5;
  const cardHeight = 18;

  const kpis = [
    {
      label: '2-WEEK WAGES',
      value: `$${empGroup.grandTotalPay.toFixed(2)}`,
      sub: `${empGroup.grandTotalRuns} total shifts`,
      highlight: false,
    },
    {
      label: '2-WEEK HOURS',
      value: `${empGroup.grandTotalHours.toFixed(2)} hrs`,
      sub: 'Insurable EI hours',
      highlight: false,
    },
    {
      label: `WEEK 1 (${startDate.slice(5)}-${week1EndDate.slice(5)})`,
      value: `$${empGroup.totalWeek1Pay.toFixed(2)}`,
      sub: `${empGroup.totalWeek1Runs} runs · ${empGroup.totalWeek1Hours.toFixed(2)} hrs`,
      highlight: false,
    },
    {
      label: `WEEK 2 (${week2StartDate.slice(5)}-${endDate.slice(5)})`,
      value: `$${empGroup.totalWeek2Pay.toFixed(2)}`,
      sub: `${empGroup.totalWeek2Runs} runs · ${empGroup.totalWeek2Hours.toFixed(2)} hrs`,
      highlight: false,
    },
    {
      label: 'NET TOTAL PAYOUT',
      value: `$${empGroup.totalPayout.toFixed(2)}`,
      sub:
        empGroup.expenses.totalAmount > 0
          ? `Incl. +$${empGroup.expenses.totalAmount.toFixed(2)} exp.`
          : 'Wages + Expenses',
      highlight: true,
    },
  ];

  kpis.forEach((kpi, idx) => {
    const cx = margin + idx * (cardWidth + cardGap);
    if (kpi.highlight) {
      doc.setFillColor(254, 243, 199); // amber-100
      doc.setDrawColor(245, 158, 11); // amber-500
    } else {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
    }
    doc.roundedRect(cx, y, cardWidth, cardHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(kpi.highlight ? 180 : 100, kpi.highlight ? 83 : 116, kpi.highlight ? 9 : 139);
    doc.text(kpi.label, cx + 2.5, y + 4.8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(kpi.value, cx + 2.5, y + 11.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.sub, cx + 2.5, y + 15.6);
  });

  y += cardHeight + 6;

  // ─── 4. Route & Rate Summary Section ──────────────────────────────────────
  if (empGroup.rows.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('1. Bi-Weekly Route & Rate Summary', margin, y);
    y += 2.5;

    // Header row
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, contentWidth, 6.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);
    doc.text('Route', margin + 2, y + 4.5);
    doc.text('Rate/Run', margin + 38, y + 4.5, { align: 'right' });
    doc.text('W1 Runs', margin + 56, y + 4.5, { align: 'center' });
    doc.text('W1 Pay', margin + 78, y + 4.5, { align: 'right' });
    doc.text('W2 Runs', margin + 96, y + 4.5, { align: 'center' });
    doc.text('W2 Pay', margin + 118, y + 4.5, { align: 'right' });
    doc.text('Total Runs', margin + 136, y + 4.5, { align: 'center' });
    doc.text('EI Hrs/Run', margin + 158, y + 4.5, { align: 'right' });
    doc.text('Total Hrs', margin + 172, y + 4.5, { align: 'right' });
    doc.text('SubTotal Pay', pageWidth - margin - 2, y + 4.5, { align: 'right' });
    y += 6.5;

    empGroup.rows.forEach((r, idx) => {
      checkPageBreak(6.5);
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentWidth, 6, 'F');
      }
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y + 6, pageWidth - margin, y + 6);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      const routeLabel = r.holidayRuns > 0 ? `${r.routeNo} (+${r.holidayRuns} Hol)` : r.routeNo;
      doc.text(routeLabel, margin + 2, y + 4.2);

      doc.setFont('helvetica', 'normal');
      doc.text(`$${r.payRate.toFixed(2)}`, margin + 38, y + 4.2, { align: 'right' });
      doc.text(`${r.week1Runs}`, margin + 56, y + 4.2, { align: 'center' });
      doc.text(`$${r.week1Pay.toFixed(2)}`, margin + 78, y + 4.2, { align: 'right' });
      doc.text(`${r.week2Runs}`, margin + 96, y + 4.2, { align: 'center' });
      doc.text(`$${r.week2Pay.toFixed(2)}`, margin + 118, y + 4.2, { align: 'right' });
      doc.text(`${r.totalRuns}`, margin + 136, y + 4.2, { align: 'center' });
      doc.text(`${r.eiHours.toFixed(2)}`, margin + 158, y + 4.2, { align: 'right' });
      doc.text(`${r.subTotalHours.toFixed(2)}`, margin + 172, y + 4.2, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.text(`$${r.subTotalPay.toFixed(2)}`, pageWidth - margin - 2, y + 4.2, { align: 'right' });
      y += 6;
    });

    y += 5;
  }

  // ─── 5. Daily Dispatch Shifts Table ───────────────────────────────────────
  checkPageBreak(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`2. Daily Dispatch Shifts Breakdown (${empGroup.dailyRecords.length} Shifts)`, margin, y);
  y += 2.5;

  const drawDailyTableHeader = () => {
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(margin, y, contentWidth, 6.8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text('Date / Day', margin + 2, y + 4.6);
    doc.text('Week', margin + 36, y + 4.6);
    doc.text('Route', margin + 52, y + 4.6);
    doc.text('Shift', margin + 84, y + 4.6, { align: 'center' });
    doc.text('Check-In / Out', margin + 95, y + 4.6);
    doc.text('Option', margin + 132, y + 4.6);
    doc.text('Hours', margin + 154, y + 4.6, { align: 'right' });
    doc.text('Amount', margin + 171, y + 4.6, { align: 'right' });
    doc.text('Status', pageWidth - margin - 2, y + 4.6, { align: 'right' });
    y += 6.8;
  };

  drawDailyTableHeader();

  empGroup.dailyRecords.forEach((rec, idx) => {
    if (checkPageBreak(6.5)) {
      drawDailyTableHeader();
    }

    const d = rec.dispatchDate || '';
    const isWeek1 = d >= startDate && d <= week1EndDate;
    const payAmt = Number(rec.payAmount || rec.originalPayRate || 0);
    const hrs = Number(rec.eiHours || rec.originalEiHours || 0);
    const isHol = rec.rateSource === 'holiday_route_assignment' || rec.id.startsWith('HOLIDAY-');
    const shiftUpper = (rec.shiftType || 'AM').toUpperCase();

    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, 6.2, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y + 6.2, pageWidth - margin, y + 6.2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);
    doc.text(`${d} (${formatWeekdayShort(d).split(',')[0]})`, margin + 2, y + 4.3);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(isWeek1 ? 'Week 1' : 'Week 2', margin + 36, y + 4.3);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text((rec.routeNo || '').slice(0, 16), margin + 52, y + 4.3);

    doc.text(shiftUpper, margin + 84, y + 4.3, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const checkInOutText = isHol
      ? 'Statutory Holiday'
      : rec.checkInTime || rec.checkOutTime
      ? `${rec.checkInTime || '--'} - ${rec.checkOutTime || '--'}`
      : 'Standard Shift';
    doc.text(checkInOutText.slice(0, 22), margin + 95, y + 4.3);

    doc.text((rec.payOption || 'STANDARD').slice(0, 10), margin + 132, y + 4.3);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235); // blue-600
    doc.text(`${hrs.toFixed(2)}`, margin + 154, y + 4.3, { align: 'right' });

    doc.setTextColor(15, 23, 42);
    doc.text(`$${payAmt.toFixed(2)}`, margin + 171, y + 4.3, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    if (isHol) {
      doc.setTextColor(180, 83, 9);
      doc.text('Holiday', pageWidth - margin - 2, y + 4.3, { align: 'right' });
    } else if (rec.status === 'pending_approval') {
      doc.setTextColor(217, 119, 6);
      doc.text('Pending', pageWidth - margin - 2, y + 4.3, { align: 'right' });
    } else {
      doc.setTextColor(5, 150, 105);
      doc.text('Approved', pageWidth - margin - 2, y + 4.3, { align: 'right' });
    }

    y += 6.2;
  });

  // Totals Footer Row
  checkPageBreak(18);
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, y, contentWidth, 7, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`Total Route Wages (${empGroup.grandTotalRuns} Shifts):`, margin + 125, y + 4.8, {
    align: 'right',
  });
  doc.setTextColor(37, 99, 235);
  doc.text(`${empGroup.grandTotalHours.toFixed(2)} hrs`, margin + 154, y + 4.8, {
    align: 'right',
  });
  doc.setTextColor(15, 23, 42);
  doc.text(`$${empGroup.grandTotalPay.toFixed(2)}`, margin + 171, y + 4.8, {
    align: 'right',
  });
  y += 7;

  if (empGroup.expenses.totalAmount > 0) {
    doc.setFillColor(236, 253, 245); // emerald-50
    doc.rect(margin, y, contentWidth, 6.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(6, 95, 70);
    doc.text(
      `Approved Expense Reimbursements (${empGroup.expenses.claimsCount} Claims):`,
      margin + 125,
      y + 4.5,
      { align: 'right' }
    );
    doc.text(`+$${empGroup.expenses.totalAmount.toFixed(2)}`, margin + 171, y + 4.5, {
      align: 'right',
    });
    y += 6.5;
  }

  doc.setFillColor(254, 243, 199); // amber-100
  doc.rect(margin, y, contentWidth, 7.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(146, 64, 14);
  doc.text('NET BI-WEEKLY PAYOUT:', margin + 125, y + 5.2, { align: 'right' });
  doc.text(`$${empGroup.totalPayout.toFixed(2)}`, margin + 171, y + 5.2, { align: 'right' });
  y += 14;

  // ─── 6. Signatures & Page Numbers ─────────────────────────────────────────
  checkPageBreak(20);
  doc.setDrawColor(148, 163, 184);
  doc.line(margin, y + 8, margin + 75, y + 8);
  doc.line(pageWidth - margin - 75, y + 8, pageWidth - margin, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Driver Signature & Date', margin, y + 12.5);
  doc.text('Payroll / Operations Approval & Date', pageWidth - margin - 75, y + 12.5);

  const generatedDateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);

    // Left: Generated date
    doc.text(`Generated: ${generatedDateStr}`, margin, pageHeight - 6);

    // Center: Document title & employee reference
    doc.text(
      `PCY Transportation Bi-Weekly Timesheet · ${empGroup.employeeName} (${empGroup.employeeId})`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );

    // Right: Page numbering
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 6, {
      align: 'right',
    });
  }

  doc.save(`Timesheet_${empGroup.employeeId}_${startDate}_to_${endDate}.pdf`);
};
