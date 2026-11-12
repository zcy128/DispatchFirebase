import { Employee } from '../types/employee';
import { normalizeRole } from './permissions';

export type CrewTargetRole = 'driver' | 'attendant';

/**
 * Priority tier when querying eligible regular & relief crew:
 * - Tier 1: Primary regular staff for the target role (Drivers / Attendants)
 * - Tier 2: Relief-eligible backups — Supervisors and Staff (e.g. Office Staff) with recorded cover experience
 * - Tier 3: Other active staff without prior cover experience for the target role
 */
export type CrewPriorityTier = 1 | 2 | 3;

export type CrewCandidateCategory =
  | 'regular_driver'
  | 'regular_attendant'
  | 'supervisor'
  | 'experienced_office'
  | 'experienced_staff'
  | 'office_unverified'
  | 'other';

export interface CrewCandidateClassification {
  tier: CrewPriorityTier;
  category: CrewCandidateCategory;
  isRegularRole: boolean;
  isSupervisor: boolean;
  isOfficeStaff: boolean;
  hasCoverExperience: boolean;
  isQualifiedRelief: boolean;
  groupKey: 'primary' | 'relief_qualified' | 'other_staff';
  badgeTextEn: string;
  badgeTextFr: string;
  optionTagEn: string;
  optionTagFr: string;
}

export function isSupervisorEmployee(emp?: Employee | null): boolean {
  if (!emp) return false;
  if (normalizeRole(emp.role) === 'supervisor') return true;
  const pos = (emp.jobPosition || '').toLowerCase();
  return pos.includes('supervisor');
}

export function isRegularDriverEmployee(emp?: Employee | null): boolean {
  if (!emp) return false;
  const r = normalizeRole(emp.role);
  if (r === 'driver') return true;
  const pos = (emp.jobPosition || '').toLowerCase();
  return (
    pos.includes('driver') &&
    !pos.includes('office') &&
    !pos.includes('supervisor') &&
    !pos.includes('admin')
  );
}

export function isRegularAttendantEmployee(emp?: Employee | null): boolean {
  if (!emp) return false;
  const r = normalizeRole(emp.role);
  if (r === 'helper') return true;
  const rawRole = (emp.role || '').trim().toLowerCase();
  if (rawRole === 'attendant' || rawRole === 'monitor') return true;
  const pos = (emp.jobPosition || '').toLowerCase();
  return pos.includes('attendant') || pos.includes('helper') || pos.includes('monitor');
}

export function isOfficeStaffEmployee(emp?: Employee | null): boolean {
  if (!emp) return false;
  return (
    !isRegularDriverEmployee(emp) &&
    !isRegularAttendantEmployee(emp) &&
    !isSupervisorEmployee(emp)
  );
}

/**
 * Classifies an employee's eligibility and dispatch selection priority for a target crew role.
 */
export function classifyEmployeeForRole(
  emp: Employee,
  targetRole: CrewTargetRole
): CrewCandidateClassification {
  const isDriverTarget = targetRole === 'driver';
  const isRegularRole = isDriverTarget
    ? isRegularDriverEmployee(emp)
    : isRegularAttendantEmployee(emp);
  const isSupervisor = isSupervisorEmployee(emp);
  const isOfficeStaff = isOfficeStaffEmployee(emp);
  const hasCoverExperience = isDriverTarget
    ? Boolean(emp.hasCoveredAsDriver)
    : Boolean(emp.hasCoveredAsAttendant);

  if (isRegularRole) {
    return {
      tier: 1,
      category: isDriverTarget ? 'regular_driver' : 'regular_attendant',
      isRegularRole: true,
      isSupervisor,
      isOfficeStaff: false,
      hasCoverExperience,
      isQualifiedRelief: true,
      groupKey: 'primary',
      badgeTextEn: isDriverTarget ? 'Driver' : 'Attendant',
      badgeTextFr: isDriverTarget ? 'Chauffeur' : 'Accompagnateur',
      optionTagEn: '',
      optionTagFr: '',
    };
  }

  if (hasCoverExperience) {
    const labelEn = isDriverTarget ? 'Exp. Cover Driver' : 'Exp. Cover Attendant';
    const labelFr = isDriverTarget ? 'Relève chauffeur exp.' : 'Relève accomp. exp.';
    return {
      tier: 2,
      category: isSupervisor
        ? 'supervisor'
        : isOfficeStaff
          ? 'experienced_office'
          : 'experienced_staff',
      isRegularRole: false,
      isSupervisor,
      isOfficeStaff,
      hasCoverExperience: true,
      isQualifiedRelief: true,
      groupKey: 'relief_qualified',
      badgeTextEn: isSupervisor
        ? `Supervisor • ${labelEn}`
        : isOfficeStaff
          ? `Office • ${labelEn}`
          : labelEn,
      badgeTextFr: isSupervisor
        ? `Superviseur • ${labelFr}`
        : isOfficeStaff
          ? `Bureau • ${labelFr}`
          : labelFr,
      optionTagEn: isSupervisor ? `★ Supervisor / ${labelEn}` : `★ ${labelEn}`,
      optionTagFr: isSupervisor ? `★ Superviseur / ${labelFr}` : `★ ${labelFr}`,
    };
  }

  if (isSupervisor) {
    return {
      tier: 2,
      category: 'supervisor',
      isRegularRole: false,
      isSupervisor: true,
      isOfficeStaff: false,
      hasCoverExperience: false,
      isQualifiedRelief: true,
      groupKey: 'relief_qualified',
      badgeTextEn: 'Supervisor • Can Cover',
      badgeTextFr: 'Superviseur • Relève autorisée',
      optionTagEn: '★ Supervisor (Relief)',
      optionTagFr: '★ Superviseur (Relève)',
    };
  }

  if (isOfficeStaff) {
    return {
      tier: 3,
      category: 'office_unverified',
      isRegularRole: false,
      isSupervisor: false,
      isOfficeStaff: true,
      hasCoverExperience: false,
      isQualifiedRelief: false,
      groupKey: 'other_staff',
      badgeTextEn: 'Office • No Cover Exp.',
      badgeTextFr: 'Bureau • Sans exp. relève',
      optionTagEn: 'Office (No Cover Exp.)',
      optionTagFr: 'Bureau (Sans exp.)',
    };
  }

  return {
    tier: 3,
    category: 'other',
    isRegularRole: false,
    isSupervisor: false,
    isOfficeStaff: false,
    hasCoverExperience: false,
    isQualifiedRelief: false,
    groupKey: 'other_staff',
    badgeTextEn: isDriverTarget ? 'Attendant / Other' : 'Driver / Other',
    badgeTextFr: isDriverTarget ? 'Accomp. / Autre' : 'Chauffeur / Autre',
    optionTagEn: 'No Cover Exp.',
    optionTagFr: 'Sans exp. relève',
  };
}

/**
 * Compares two employees by relief priority tier for the target role,
 * then sub-prioritizes experienced cover staff over unverified backups, then by name.
 */
export function compareCrewPriority(
  aEmp: Employee,
  bEmp: Employee,
  targetRole: CrewTargetRole
): number {
  const aClass = classifyEmployeeForRole(aEmp, targetRole);
  const bClass = classifyEmployeeForRole(bEmp, targetRole);
  if (aClass.tier !== bClass.tier) {
    return aClass.tier - bClass.tier;
  }
  if (aClass.hasCoverExperience !== bClass.hasCoverExperience) {
    return aClass.hasCoverExperience ? -1 : 1;
  }
  const aName = `${aEmp.firstName || ''} ${aEmp.lastName || ''}`.trim() || aEmp.fullName || '';
  const bName = `${bEmp.firstName || ''} ${bEmp.lastName || ''}`.trim() || bEmp.fullName || '';
  return aName.localeCompare(bName);
}

/**
 * Sorts mapped candidate items by CrewPriorityTier first (Tier 1 -> Tier 2 -> Tier 3),
 * then by shortest deadhead distance within the same tier, then alphabetically.
 */
export function sortCrewCandidatesWithPriority<T extends { employee: Employee }>(
  items: T[],
  targetRole: CrewTargetRole,
  getMetric?: (item: T) => number | null
): T[] {
  return [...items].sort((a, b) => {
    const aClass = classifyEmployeeForRole(a.employee, targetRole);
    const bClass = classifyEmployeeForRole(b.employee, targetRole);
    if (aClass.tier !== bClass.tier) {
      return aClass.tier - bClass.tier;
    }

    if (getMetric) {
      const aMetric = getMetric(a);
      const bMetric = getMetric(b);
      if (aMetric !== null && bMetric !== null) {
        if (aMetric !== bMetric) return aMetric - bMetric;
      } else if (aMetric !== null && bMetric === null) {
        return -1;
      } else if (aMetric === null && bMetric !== null) {
        return 1;
      }
    }

    return compareCrewPriority(a.employee, b.employee, targetRole);
  });
}

export interface GroupedCrewCandidates<T> {
  primary: T[];
  relief: T[];
  other: T[];
}

/**
 * Splits a sorted list of crew candidates into three display groups:
 * primary regular role, qualified relief (supervisors + experienced cover staff), and other staff.
 */
export function groupCrewCandidates<T extends { employee: Employee }>(
  items: T[],
  targetRole: CrewTargetRole
): GroupedCrewCandidates<T> {
  const primary: T[] = [];
  const relief: T[] = [];
  const other: T[] = [];
  for (const item of items) {
    const cls = classifyEmployeeForRole(item.employee, targetRole);
    if (cls.tier === 1) {
      primary.push(item);
    } else if (cls.tier === 2) {
      relief.push(item);
    } else {
      other.push(item);
    }
  }
  return { primary, relief, other };
}

export function getOptGroupLabels(targetRole: CrewTargetRole, isFrench: boolean) {
  if (targetRole === 'driver') {
    return {
      primary: isFrench ? 'Chauffeurs réguliers' : 'Regular & Relief Drivers',
      relief: isFrench
        ? 'Relève qualifiée — Superviseurs & Bureau expérimentés'
        : 'Qualified Relief — Supervisors & Experienced Cover Staff',
      other: isFrench
        ? 'Autres employés (sans expérience de conduite)'
        : 'Other Staff (No Driver Cover Experience)',
    };
  }
  return {
    primary: isFrench ? 'Accompagnateurs réguliers' : 'Regular Attendants / Monitors',
    relief: isFrench
      ? 'Relève qualifiée — Superviseurs & Bureau expérimentés'
      : 'Qualified Relief — Supervisors & Experienced Cover Staff',
    other: isFrench
      ? 'Autres employés (sans expérience d’accompagnement)'
      : 'Other Staff (No Attendant Cover Experience)',
  };
}
