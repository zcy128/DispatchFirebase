import ExcelJS from 'exceljs';
import { Vehicle } from '../types/vehicle';

export interface VehicleExportFieldDef {
  key: string;
  labelEn: string;
  labelFr: string;
  category: 'identification' | 'specifications' | 'operations' | 'assignment' | 'system';
  categoryLabelEn: string;
  categoryLabelFr: string;
  defaultWidth: number;
  getValue: (v: Vehicle, isFrench?: boolean) => string | number | boolean;
}

export const ALL_VEHICLE_EXPORT_FIELDS: VehicleExportFieldDef[] = [
  // Identification
  {
    key: 'unitNumber',
    labelEn: 'Unit Number',
    labelFr: 'Numéro d\'unité',
    category: 'identification',
    categoryLabelEn: 'Core Identification',
    categoryLabelFr: 'Identification principale',
    defaultWidth: 14,
    getValue: (v) => v.unitNumber || '',
  },
  {
    key: 'plateNumber',
    labelEn: 'License Plate',
    labelFr: 'Plaque d\'immatriculation',
    category: 'identification',
    categoryLabelEn: 'Core Identification',
    categoryLabelFr: 'Identification principale',
    defaultWidth: 16,
    getValue: (v) => v.plateNumber || '',
  },
  {
    key: 'vin',
    labelEn: 'VIN (Vehicle Identification Number)',
    labelFr: 'NIV (Numéro d\'identification du véhicule)',
    category: 'identification',
    categoryLabelEn: 'Core Identification',
    categoryLabelFr: 'Identification principale',
    defaultWidth: 24,
    getValue: (v) => v.vin || '',
  },
  {
    key: 'vehicleId',
    labelEn: 'Vehicle Database ID',
    labelFr: 'ID base de données véhicule',
    category: 'identification',
    categoryLabelEn: 'Core Identification',
    categoryLabelFr: 'Identification principale',
    defaultWidth: 16,
    getValue: (v) => (v.vehicleId != null ? v.vehicleId : ''),
  },
  {
    key: 'id',
    labelEn: 'Record Key ID',
    labelFr: 'Clé d\'enregistrement (ID)',
    category: 'identification',
    categoryLabelEn: 'Core Identification',
    categoryLabelFr: 'Identification principale',
    defaultWidth: 16,
    getValue: (v) => v.id || '',
  },

  // Specifications
  {
    key: 'unitType',
    labelEn: 'Vehicle Type',
    labelFr: 'Type de véhicule',
    category: 'specifications',
    categoryLabelEn: 'Specifications & Capacities',
    categoryLabelFr: 'Spécifications et capacités',
    defaultWidth: 16,
    getValue: (v) => v.unitType || '',
  },
  {
    key: 'manufacturer',
    labelEn: 'Manufacturer / Make',
    labelFr: 'Fabricant / Marque',
    category: 'specifications',
    categoryLabelEn: 'Specifications & Capacities',
    categoryLabelFr: 'Spécifications et capacités',
    defaultWidth: 20,
    getValue: (v) => v.manufacturer || '',
  },
  {
    key: 'model',
    labelEn: 'Model',
    labelFr: 'Modèle',
    category: 'specifications',
    categoryLabelEn: 'Specifications & Capacities',
    categoryLabelFr: 'Spécifications et capacités',
    defaultWidth: 18,
    getValue: (v) => v.model || '',
  },
  {
    key: 'year',
    labelEn: 'Model Year',
    labelFr: 'Année du modèle',
    category: 'specifications',
    categoryLabelEn: 'Specifications & Capacities',
    categoryLabelFr: 'Spécifications et capacités',
    defaultWidth: 12,
    getValue: (v) => v.year || '',
  },
  {
    key: 'color',
    labelEn: 'Vehicle Color',
    labelFr: 'Couleur du véhicule',
    category: 'specifications',
    categoryLabelEn: 'Specifications & Capacities',
    categoryLabelFr: 'Spécifications et capacités',
    defaultWidth: 16,
    getValue: (v) => v.color || '',
  },
  {
    key: 'seatCap',
    labelEn: 'Passenger Seating Capacity',
    labelFr: 'Capacité de sièges passagers',
    category: 'specifications',
    categoryLabelEn: 'Specifications & Capacities',
    categoryLabelFr: 'Spécifications et capacités',
    defaultWidth: 18,
    getValue: (v) => (v.seatCap != null ? v.seatCap : 0),
  },
  {
    key: 'wheelchairCap',
    labelEn: 'Wheelchair Capacity (WC)',
    labelFr: 'Capacité fauteuil roulant (FR)',
    category: 'specifications',
    categoryLabelEn: 'Specifications & Capacities',
    categoryLabelFr: 'Spécifications et capacités',
    defaultWidth: 18,
    getValue: (v) => (v.wheelchairCap != null ? v.wheelchairCap : 0),
  },
  {
    key: 'fuelType',
    labelEn: 'Fuel Type',
    labelFr: 'Type de carburant',
    category: 'specifications',
    categoryLabelEn: 'Specifications & Capacities',
    categoryLabelFr: 'Spécifications et capacités',
    defaultWidth: 14,
    getValue: (v) => v.fuelType || '',
  },
  {
    key: 'odometer',
    labelEn: 'Odometer Reading (km)',
    labelFr: 'Odomètre actuel (km)',
    category: 'specifications',
    categoryLabelEn: 'Specifications & Capacities',
    categoryLabelFr: 'Spécifications et capacités',
    defaultWidth: 18,
    getValue: (v) => (v.odometer != null ? v.odometer : ''),
  },

  // Operations & Terminal
  {
    key: 'status',
    labelEn: 'Fleet Operational Status',
    labelFr: 'Statut opérationnel de la flotte',
    category: 'operations',
    categoryLabelEn: 'Operations & Maintenance',
    categoryLabelFr: 'Opérations et maintenance',
    defaultWidth: 20,
    getValue: (v) => v.status || '',
  },
  {
    key: 'active',
    labelEn: 'Active in Fleet Flag',
    labelFr: 'Véhicule actif dans la flotte',
    category: 'operations',
    categoryLabelEn: 'Operations & Maintenance',
    categoryLabelFr: 'Opérations et maintenance',
    defaultWidth: 16,
    getValue: (v, isFrench) => (v.active ? (isFrench ? 'Oui' : 'Yes') : (isFrench ? 'Non' : 'No')),
  },
  {
    key: 'yardName',
    labelEn: 'Terminal / Yard',
    labelFr: 'Garage / Terminal d\'attache',
    category: 'operations',
    categoryLabelEn: 'Operations & Maintenance',
    categoryLabelFr: 'Opérations et maintenance',
    defaultWidth: 22,
    getValue: (v) => v.yardName || '',
  },
  {
    key: 'licenseExpiry',
    labelEn: 'Annual Safety / Inspection Expiry Date',
    labelFr: 'Date d\'expiration de sécurité / inspection',
    category: 'operations',
    categoryLabelEn: 'Operations & Maintenance',
    categoryLabelFr: 'Opérations et maintenance',
    defaultWidth: 22,
    getValue: (v) => (v.licenseExpiry ? v.licenseExpiry.substring(0, 10) : ''),
  },
  {
    key: 'lastInspectionDate',
    labelEn: 'Last Semi-Annual Inspection Date',
    labelFr: 'Date de la dernière vérification semestrielle',
    category: 'operations',
    categoryLabelEn: 'Operations & Maintenance',
    categoryLabelFr: 'Opérations et maintenance',
    defaultWidth: 22,
    getValue: (v) => (v.lastInspectionDate ? v.lastInspectionDate.substring(0, 10) : ''),
  },
  {
    key: 'nextInspectionDue',
    labelEn: 'Next Inspection Due Date',
    labelFr: 'Date d\'échéance vérification mécanique',
    category: 'operations',
    categoryLabelEn: 'Operations & Maintenance',
    categoryLabelFr: 'Opérations et maintenance',
    defaultWidth: 22,
    getValue: (v) => (v.nextInspectionDue ? v.nextInspectionDue.substring(0, 10) : ''),
  },
  {
    key: 'inspectionCertificateNumber',
    labelEn: 'Safety Certificate # (DriveON / CVM)',
    labelFr: 'N° Certificat de sécurité (DriveON / CVM)',
    category: 'operations',
    categoryLabelEn: 'Operations & Maintenance',
    categoryLabelFr: 'Opérations et maintenance',
    defaultWidth: 24,
    getValue: (v) => v.inspectionCertificateNumber || '',
  },
  {
    key: 'inspectionStickerNumber',
    labelEn: 'Inspection Sticker / Vignette #',
    labelFr: 'N° Vignette d\'inspection SAAQ / DriveON',
    category: 'operations',
    categoryLabelEn: 'Operations & Maintenance',
    categoryLabelFr: 'Opérations et maintenance',
    defaultWidth: 22,
    getValue: (v) => v.inspectionStickerNumber || '',
  },
  {
    key: 'hasInVehicleCertificate',
    labelEn: 'In-Cab Glovebox Certificate Present',
    labelFr: 'Certificat présent dans boîte à gants',
    category: 'operations',
    categoryLabelEn: 'Operations & Maintenance',
    categoryLabelFr: 'Opérations et maintenance',
    defaultWidth: 22,
    getValue: (v, isFrench) => (v.hasInVehicleCertificate !== false ? (isFrench ? 'Oui' : 'Yes') : (isFrench ? 'Non' : 'No')),
  },
  {
    key: 'hasDetailedMeasurementsArchived',
    labelEn: 'Brake & Tire Measurements Archived',
    labelFr: 'Rapport de mesures archivé (freins/pneus)',
    category: 'operations',
    categoryLabelEn: 'Operations & Maintenance',
    categoryLabelFr: 'Opérations et maintenance',
    defaultWidth: 24,
    getValue: (v, isFrench) => (v.hasDetailedMeasurementsArchived !== false ? (isFrench ? 'Oui' : 'Yes') : (isFrench ? 'Non' : 'No')),
  },
  {
    key: 'hasProofOfRepairsAttached',
    labelEn: 'Repair Work Orders & Invoices Attached',
    labelFr: 'Bons de travail et factures de réparation joints',
    category: 'operations',
    categoryLabelEn: 'Operations & Maintenance',
    categoryLabelFr: 'Opérations et maintenance',
    defaultWidth: 24,
    getValue: (v, isFrench) => (v.hasProofOfRepairsAttached !== false ? (isFrench ? 'Oui' : 'Yes') : (isFrench ? 'Non' : 'No')),
  },
  {
    key: 'notes',
    labelEn: 'Maintenance & Dispatch Notes',
    labelFr: 'Notes d\'entretien et de régulation',
    category: 'operations',
    categoryLabelEn: 'Operations & Maintenance',
    categoryLabelFr: 'Opérations et maintenance',
    defaultWidth: 32,
    getValue: (v) => v.notes || '',
  },

  // Route & Crew Assignment
  {
    key: 'assignedRouteNo',
    labelEn: 'Assigned Route Number',
    labelFr: 'Numéro de trajet assigné',
    category: 'assignment',
    categoryLabelEn: 'Route & Driver Assignment',
    categoryLabelFr: 'Affectation de trajet et chauffeur',
    defaultWidth: 18,
    getValue: (v) => v.assignedRouteNo || '',
  },
  {
    key: 'assignedRouteName',
    labelEn: 'Assigned Route Name',
    labelFr: 'Nom du trajet assigné',
    category: 'assignment',
    categoryLabelEn: 'Route & Driver Assignment',
    categoryLabelFr: 'Affectation de trajet et chauffeur',
    defaultWidth: 26,
    getValue: (v) => v.assignedRouteName || '',
  },
  {
    key: 'assignedRouteId',
    labelEn: 'Assigned Route ID',
    labelFr: 'Identifiant du trajet assigné',
    category: 'assignment',
    categoryLabelEn: 'Route & Driver Assignment',
    categoryLabelFr: 'Affectation de trajet et chauffeur',
    defaultWidth: 18,
    getValue: (v) => v.assignedRouteId || '',
  },
  {
    key: 'driverName',
    labelEn: 'Assigned Driver Name',
    labelFr: 'Nom du chauffeur assigné',
    category: 'assignment',
    categoryLabelEn: 'Route & Driver Assignment',
    categoryLabelFr: 'Affectation de trajet et chauffeur',
    defaultWidth: 22,
    getValue: (v) => v.driverName || '',
  },
  {
    key: 'driverId',
    labelEn: 'Driver Employee ID / Code',
    labelFr: 'Code / Matricule du chauffeur',
    category: 'assignment',
    categoryLabelEn: 'Route & Driver Assignment',
    categoryLabelFr: 'Affectation de trajet et chauffeur',
    defaultWidth: 20,
    getValue: (v) => v.driverId || '',
  },
  {
    key: 'driverPhone',
    labelEn: 'Driver Contact Phone',
    labelFr: 'Téléphone du chauffeur',
    category: 'assignment',
    categoryLabelEn: 'Route & Driver Assignment',
    categoryLabelFr: 'Affectation de trajet et chauffeur',
    defaultWidth: 18,
    getValue: (v) => v.driverPhone || '',
  },
  {
    key: 'employeeId',
    labelEn: 'Assigned Employee Number',
    labelFr: 'Numéro d\'employé assigné',
    category: 'assignment',
    categoryLabelEn: 'Route & Driver Assignment',
    categoryLabelFr: 'Affectation de trajet et chauffeur',
    defaultWidth: 18,
    getValue: (v) => (v.employeeId != null ? v.employeeId : ''),
  },

  // Timestamps & Audit
  {
    key: 'createdAt',
    labelEn: 'Record Created Timestamp',
    labelFr: 'Date / Heure de création',
    category: 'system',
    categoryLabelEn: 'System & Audit',
    categoryLabelFr: 'Système et audit',
    defaultWidth: 22,
    getValue: (v) => formatTimestampValue(v.createdAt),
  },
  {
    key: 'updatedAt',
    labelEn: 'Record Last Updated Timestamp',
    labelFr: 'Dernière mise à jour',
    category: 'system',
    categoryLabelEn: 'System & Audit',
    categoryLabelFr: 'Système et audit',
    defaultWidth: 22,
    getValue: (v) => formatTimestampValue(v.updatedAt),
  },
];

/**
 * Formats any Firestore Timestamp, serialized JSON timestamp, Date instance,
 * or date/time string into a human-readable "YYYY-MM-DD HH:mm:ss" string.
 */
export function formatTimestampValue(value: unknown): string {
  if (value == null || value === '') return '';

  try {
    let date: Date | null = null;

    if (value instanceof Date) {
      date = value;
    } else if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      if (typeof obj.toDate === 'function') {
        date = (obj.toDate as () => Date)();
      } else if (typeof obj.seconds === 'number') {
        date = new Date(obj.seconds * 1000 + Math.floor(((obj.nanoseconds as number) || 0) / 1000000));
      } else if (typeof obj._seconds === 'number') {
        date = new Date(obj._seconds * 1000 + Math.floor(((obj._nanoseconds as number) || 0) / 1000000));
      }
    } else if (typeof value === 'string') {
      const trimmed = value.trim();
      // Check if string contains serialized JSON (e.g., Firestore Timestamp JSON)
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed && typeof parsed === 'object') {
            if (typeof parsed.seconds === 'number') {
              date = new Date(parsed.seconds * 1000 + Math.floor((parsed.nanoseconds || 0) / 1000000));
            } else if (typeof parsed._seconds === 'number') {
              date = new Date(parsed._seconds * 1000 + Math.floor((parsed._nanoseconds || 0) / 1000000));
            }
          }
        } catch {
          // If JSON parsing fails, continue to Date parsing
        }
      }

      if (!date) {
        const parsedMs = Date.parse(trimmed);
        if (!isNaN(parsedMs)) {
          date = new Date(parsedMs);
        }
      }
    } else if (typeof value === 'number') {
      date = new Date(value > 1e11 ? value : value * 1000);
    }

    if (date && !isNaN(date.getTime())) {
      const pad = (n: number) => String(n).padStart(2, '0');
      const year = date.getFullYear();
      const month = pad(date.getMonth() + 1);
      const day = pad(date.getDate());
      const hours = pad(date.getHours());
      const minutes = pad(date.getMinutes());
      const seconds = pad(date.getSeconds());
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
  } catch {
    // Return empty string on parsing failure
  }

  return typeof value === 'string' ? value : String(value);
}

export interface ExportVehiclesToExcelOptions {
  vehicles: Vehicle[];
  selectedFieldKeys: string[];
  isFrench?: boolean;
  filterSummaryText?: string;
}

/**
 * Generates and downloads a formatted Microsoft Excel (.xlsx) file
 * with the user-selected vehicle fields.
 */
export async function exportVehiclesToExcel({
  vehicles,
  selectedFieldKeys,
  isFrench = false,
  filterSummaryText,
}: ExportVehiclesToExcelOptions): Promise<void> {
  const selectedKeySet = new Set(selectedFieldKeys);
  const activeFields = ALL_VEHICLE_EXPORT_FIELDS.filter((f) => selectedKeySet.has(f.key));

  if (activeFields.length === 0) {
    throw new Error(isFrench ? 'Veuillez sélectionner au moins un champ à exporter.' : 'Please select at least one field to export.');
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'School Bus Dispatch PWA';
  workbook.created = new Date();

  const sheetName = isFrench ? 'Flotte de véhicules' : 'Fleet Inventory';
  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 3 }],
  });

  // Title Banner (Row 1)
  const titleText = isFrench
    ? `INVENTAIRE DU PARC DE VÉHICULES (${vehicles.length} VÉHICULES)`
    : `FLEET VEHICLE INVENTORY REPORT (${vehicles.length} VEHICLES)`;

  const titleRow = worksheet.addRow([titleText]);
  titleRow.height = 26;
  titleRow.getCell(1).font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF0F172A' } };

  // Subtitle / Filter Info (Row 2)
  const todayStr = new Date().toISOString().slice(0, 10);
  const subtitleText = isFrench
    ? `Généré le: ${todayStr} | Total exporté: ${vehicles.length} ${filterSummaryText ? `| Filtre: ${filterSummaryText}` : ''}`
    : `Generated on: ${todayStr} | Total Exported: ${vehicles.length} ${filterSummaryText ? `| Filter: ${filterSummaryText}` : ''}`;

  const subtitleRow = worksheet.addRow([subtitleText]);
  subtitleRow.height = 20;
  subtitleRow.getCell(1).font = { name: 'Arial', size: 9.5, italic: true, color: { argb: 'FF64748B' } };

  // Column Headers (Row 3)
  const headers = activeFields.map((f) => (isFrench ? f.labelFr : f.labelEn));
  const headerRow = worksheet.addRow(headers);
  headerRow.height = 28;

  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F766E' }, // Emerald / Teal header
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF0D5F58' } },
      left: { style: 'thin', color: { argb: 'FF0D5F58' } },
      bottom: { style: 'medium', color: { argb: 'FF0D5F58' } },
      right: { style: 'thin', color: { argb: 'FF0D5F58' } },
    };
  });

  // Populate Data Rows
  vehicles.forEach((vehicle, rowIndex) => {
    const rowValues = activeFields.map((field) => field.getValue(vehicle, isFrench));
    const dataRow = worksheet.addRow(rowValues);
    dataRow.height = 22;

    const isEven = rowIndex % 2 === 0;
    const rowBgColor = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

    dataRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF1E293B' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: rowBgColor },
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      const field = activeFields[colNumber - 1];
      if (typeof cell.value === 'number') {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        if (field.key === 'odometer') {
          cell.numFmt = '#,##0';
        } else if (field.key === 'year') {
          cell.numFmt = '0000';
        }
      } else if (typeof cell.value === 'boolean' || field.key === 'active' || field.key === 'year' || field.key === 'unitNumber') {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
  });

  // Enable Auto-Filter on Row 3
  worksheet.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3, column: activeFields.length },
  };

  // Configure Column Widths
  activeFields.forEach((field, colIndex) => {
    let maxContentLength = (isFrench ? field.labelFr : field.labelEn).length;
    vehicles.forEach((v) => {
      const val = field.getValue(v, isFrench);
      if (val != null) {
        const len = String(val).length;
        if (len > maxContentLength) maxContentLength = len;
      }
    });
    const colWidth = Math.max(field.defaultWidth, Math.min(maxContentLength + 4, 45));
    worksheet.getColumn(colIndex + 1).width = colWidth;
  });

  // Write and trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fileName = isFrench
    ? `Inventaire_Flotte_${todayStr}.xlsx`
    : `Fleet_Inventory_${todayStr}.xlsx`;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
