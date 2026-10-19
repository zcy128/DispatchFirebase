export type DefectStatus =
  | 'submitted'
  | 'under_assessment'
  | 'under_repair'
  | 'resolved';

export type DefectItemStatus = 'ok' | 'defect' | 'na';

export interface DefectItem {
  id: string;
  name: string;
  category: string;
  status: DefectItemStatus;
  notes?: string;
}

export interface DefectAssessment {
  assessedBy?: string;
  assessedAt?: string;
  assessmentNotes?: string;
  repairLocation?: string;
  estimatedRepairDays?: number;
  estimatedStartDate?: string;
  estimatedCompletionDate?: string;
  actualCompletionDate?: string;
  repairCost?: number;
  mechanicNotes?: string;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface VehicleDefectReport {
  id: string;
  vehicleId: number;
  vehicleUnitNumber: string;
  odometer: number;
  reportedByUserId: string;
  reportedByName: string;
  reportDate: string; // YYYY-MM-DD
  reportTime: string; // HH:mm
  items: DefectItem[];
  defectNotes?: string;
  noDefectsFound: boolean;
  confirmedAccurate: boolean;
  status: DefectStatus;
  assessment?: DefectAssessment;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateDefectAssessmentPayload {
  status: DefectStatus;
  assessedBy: string;
  assessmentNotes?: string;
  repairLocation?: string;
  estimatedRepairDays?: number;
  estimatedStartDate?: string;
  estimatedCompletionDate?: string;
  actualCompletionDate?: string;
  repairCost?: number;
  mechanicNotes?: string;
  resolvedBy?: string;
}

export const DEFECT_STATUS_LABELS: Record<DefectStatus, string> = {
  submitted: 'Submitted',
  under_assessment: 'Under Assessment',
  under_repair: 'Under Repair',
  resolved: 'Resolved',
};

export const DEFECT_STATUS_COLORS: Record<
  DefectStatus,
  { bg: string; text: string; border: string; badge: string }
> = {
  submitted: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/20',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-300 dark:border-amber-700/50',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  },
  under_assessment: {
    bg: 'bg-blue-500/10 dark:bg-blue-500/20',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-300 dark:border-blue-700/50',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  },
  under_repair: {
    bg: 'bg-purple-500/10 dark:bg-purple-500/20',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-300 dark:border-purple-700/50',
    badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  },
  resolved: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-300 dark:border-emerald-700/50',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
};
