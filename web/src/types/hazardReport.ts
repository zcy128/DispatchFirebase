export interface HazardReport {
  id: string;
  reportedBy: string;
  reportedByEmployeeId?: string;
  personInvolved?: string;
  unitId?: string;
  unitNumber?: string;
  routeId?: string;
  routeName?: string;
  phone?: string;
  supervisor?: string;
  eventTime?: string;
  eventLocation?: string;
  witnesses?: string;
  eventDescription: string;

  // Type of Hazard
  trippingHazard?: boolean;
  trafficHazard?: boolean;
  equipmentHazard?: boolean;
  performanceHazard?: boolean;
  snowHazard?: boolean;
  spillHazard?: boolean;
  otherHazard?: boolean;

  // Type of Close Call / Near Miss
  unsafeAction?: boolean;
  unsafeCondition?: boolean;
  happenedtoMe?: boolean;
  happenedtoSomeone?: boolean;
  ofanarea?: boolean;
  ofEquipment?: boolean;

  // Evaluation of Risk Potential (Completed by Safety / Dispatch)
  moderate?: boolean;
  serious?: boolean;
  minor?: boolean;
  probableRecurrence?: boolean;
  occasional?: boolean;
  rare?: boolean;
  suggestion?: string;
  actionTaken?: string;
  assignedTo?: string;
  isCompleted?: boolean;
  officeHazardType?: string;
  employeeIdError?: string;
  employeeNameError?: string;
  safetySignedBy?: string;
  safetySignedDate?: string;

  // Status
  statusInt: number; // 0 = Open, 1 = Investigating, 2 = Resolved
  statusStr: string;

  // Attachments
  attachmentUrls?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface CreateHazardReportPayload {
  reportedBy: string;
  reportedByEmployeeId?: string;
  personInvolved?: string;
  unitId?: string;
  unitNumber?: string;
  routeId?: string;
  routeName?: string;
  phone?: string;
  supervisor?: string;
  eventTime?: string;
  eventLocation?: string;
  witnesses?: string;
  eventDescription: string;
  trippingHazard?: boolean;
  trafficHazard?: boolean;
  equipmentHazard?: boolean;
  performanceHazard?: boolean;
  snowHazard?: boolean;
  spillHazard?: boolean;
  otherHazard?: boolean;
  unsafeAction?: boolean;
  unsafeCondition?: boolean;
  happenedtoMe?: boolean;
  happenedtoSomeone?: boolean;
  ofanarea?: boolean;
  ofEquipment?: boolean;
  suggestion?: string;
  attachmentUrls?: string[];
}

export interface UpdateHazardReportOfficePayload {
  moderate: boolean;
  serious: boolean;
  minor: boolean;
  probableRecurrence: boolean;
  occasional: boolean;
  rare: boolean;
  suggestion?: string;
  actionTaken?: string;
  assignedTo?: string;
  isCompleted: boolean;
  officeHazardType?: string;
  employeeIdError?: string;
  employeeNameError?: string;
  safetySignedBy?: string;
  statusInt: number;
  statusStr?: string;
}

export const HAZARD_TYPE_DEFINITIONS = [
  { key: 'trippingHazard', label: 'Tripping Hazard', color: 'amber' },
  { key: 'trafficHazard', label: 'Traffic Hazard', color: 'rose' },
  { key: 'equipmentHazard', label: 'Equipment Hazard', color: 'orange' },
  { key: 'performanceHazard', label: 'Performance Hazard', color: 'indigo' },
  { key: 'snowHazard', label: 'Snow, Ice or Road', color: 'blue' },
  { key: 'spillHazard', label: 'Spill', color: 'cyan' },
  { key: 'otherHazard', label: 'Other Hazard', color: 'purple' },
] as const;

export const CLOSE_CALL_DEFINITIONS = [
  { key: 'unsafeAction', label: 'Unsafe Action' },
  { key: 'unsafeCondition', label: 'Unsafe Condition' },
  { key: 'happenedtoMe', label: 'Happened to Me' },
  { key: 'ofanarea', label: 'Of an Area' },
  { key: 'ofEquipment', label: 'Of Equipment' },
  { key: 'happenedtoSomeone', label: 'Happened to Someone Else' },
] as const;

export const OFFICE_HAZARD_TYPES = [
  'All',
  'Collision',
  'Hazard',
  'Incident report',
  'Road Condition',
  'Equipment Issue',
] as const;

export const HAZARD_STATUS_CONFIG: Record<
  number,
  { label: string; badge: string; iconColor: string; bg: string; border: string; text: string }
> = {
  0: {
    label: 'Open',
    badge: 'Open / Pending',
    iconColor: 'text-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-300',
  },
  1: {
    label: 'Investigating',
    badge: 'Under Investigation',
    iconColor: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-300',
  },
  2: {
    label: 'Resolved',
    badge: 'Resolved / Completed',
    iconColor: 'text-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
};
