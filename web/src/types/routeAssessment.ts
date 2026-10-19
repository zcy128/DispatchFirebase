export interface RouteAssessment {
  id: string;
  assessmentType: string; // "0" = New Route, "1" = Change in Route
  routeId: string;
  schoolBoardId?: number;
  schoolBoard?: string;
  schoolId?: number;
  school?: string;
  schoolYear?: string;
  assessmentDate?: string;
  conductedByDriver: string;
  conductedByOperator?: string;
  conductedByEmployeeId?: string;
  driverEmail?: string;
  driverPhone?: string;
  summary?: string;

  // 11 Core Assessment Safety Checklist Questions
  visibilityProblemCheck: boolean;
  visibilityProblem?: string;

  highwayStopConcernCheck: boolean;
  highwayStopConcern?: string;

  locationProblemCheck: boolean;
  locationProblem?: string;

  unsafeTurnaroundCheck: boolean;
  unsafeTurnaround?: string;

  intersectionCheck: boolean;
  intersection?: string;

  roadwayCheck: boolean;
  roadway?: string;

  nonweatherRiskCheck: boolean;
  nonweatherRisk?: string;

  weatherRiskCheck: boolean;
  weatherRisk?: string;

  companyPolicyCheck: boolean;
  companyPolicyFamiliar: boolean;
  routeAdjustCheck: boolean;
  routeAdjust?: string;

  safetyConcernCheck: boolean;
  safetyConcern?: string;

  // Office Processing Section (as shown in reference image)
  assignedTo?: string;
  isCompleted: boolean;
  isSubmitted: boolean;

  // Status mapping: 0/1 = Working, 2 = Completed, 3 = Submitted
  statusInt: number;
  statusStr: string;

  // Attachments (e.g. photos of stops, turns, or obstacles)
  attachmentUrls?: string[];
  createdAt: string;
  updatedAt: string;
}

export type RouteAssessmentStatus = 'working' | 'completed' | 'submitted';

export interface CreateRouteAssessmentPayload {
  assessmentType: string;
  routeId: string;
  schoolBoardId?: number;
  schoolBoard?: string;
  schoolId?: number;
  school?: string;
  schoolYear?: string;
  assessmentDate?: string;
  conductedByDriver: string;
  conductedByOperator?: string;
  conductedByEmployeeId?: string;
  driverEmail?: string;
  driverPhone?: string;
  summary?: string;

  visibilityProblemCheck?: boolean;
  visibilityProblem?: string;
  highwayStopConcernCheck?: boolean;
  highwayStopConcern?: string;
  locationProblemCheck?: boolean;
  locationProblem?: string;
  unsafeTurnaroundCheck?: boolean;
  unsafeTurnaround?: string;
  intersectionCheck?: boolean;
  intersection?: string;
  roadwayCheck?: boolean;
  roadway?: string;
  nonweatherRiskCheck?: boolean;
  nonweatherRisk?: string;
  weatherRiskCheck?: boolean;
  weatherRisk?: string;
  companyPolicyCheck?: boolean;
  companyPolicyFamiliar?: boolean;
  routeAdjustCheck?: boolean;
  routeAdjust?: string;
  safetyConcernCheck?: boolean;
  safetyConcern?: string;

  assignedTo?: string;
  isCompleted?: boolean;
  isSubmitted?: boolean;
  attachmentUrls?: string[];
}

export interface UpdateRouteAssessmentOfficePayload {
  assignedTo?: string;
  isCompleted?: boolean;
  isSubmitted?: boolean;
}

export interface UpdateRouteAssessmentPayload extends Partial<CreateRouteAssessmentPayload> {}

export const ASSESSMENT_TYPES = [
  {
    value: '0',
    label: 'New Route (Dry Run)',
    description:
      'Completed prior to the beginning of the school year while performing the route "Dry Run". Submitted on your first day on the route.',
  },
  {
    value: '1',
    label: 'Change in Route',
    description:
      'Completed whenever a change occurs on the route (new student added, change in address, stop order change). Submitted within 3 days.',
  },
];

export const ROUTE_ASSESSMENT_QUESTIONS = [
  {
    id: 1,
    key: 'visibilityProblem',
    checkKey: 'visibilityProblemCheck',
    textKey: 'visibilityProblem',
    title: '1. Sight Lines & Blind Spots',
    question:
      'Are there poor sight lines, blind spots, or visual obstructions on this route or at stop locations? (e.g., hill crests, sharp curves, dense foliage, buildings, or heavy fog)',
  },
  {
    id: 2,
    key: 'highwayStopConcern',
    checkKey: 'highwayStopConcernCheck',
    textKey: 'highwayStopConcern',
    title: '2. Highway & High-Speed Stops',
    question:
      'Are there any student stops located on primary or secondary highways and high-speed roads? (e.g., high traffic volume, high approach speeds, poor deceleration visibility, or frequent red light infractions)',
  },
  {
    id: 3,
    key: 'locationProblem',
    checkKey: 'locationProblemCheck',
    textKey: 'locationProblem',
    title: '3. Student Loading & School Zones',
    question:
      'Do any pick-up, drop-off, or school sites have insufficient physical space or unsafe conditions for loading and unloading? (e.g., overcrowded stops, lack of sidewalks, poor signage, or traffic congestion)',
  },
  {
    id: 4,
    key: 'unsafeTurnaround',
    checkKey: 'unsafeTurnaroundCheck',
    textKey: 'unsafeTurnaround',
    title: '4. Unsafe Turnarounds & Maneuvers',
    question:
      'Are there any turnaround locations that present hazards as defined in school bus operating standards? (e.g., backing across traffic lanes, blind turns, narrow driveways, or physical obstacles)',
  },
  {
    id: 5,
    key: 'intersection',
    checkKey: 'intersectionCheck',
    textKey: 'intersection',
    title: '5. Complex Intersections & Railway Crossings',
    question:
      'Are there roadway crossings of concern along this route, such as uncontrolled intersections, blind merges, or active railway crossings? (e.g., difficult left turns, high-speed cross-traffic, or obstructed signals)',
  },
  {
    id: 6,
    key: 'roadway',
    checkKey: 'roadwayCheck',
    textKey: 'roadway',
    title: '6. Roadway Width, Surface & Clearance',
    question:
      'Are there any roadways where road structure, width, or overhead height is inadequate for the safe passage of the bus? (e.g., severe heaves, unpaved or rutted surfaces, narrow bridges, soft shoulders, or low branches)',
  },
  {
    id: 7,
    key: 'nonweatherRisk',
    checkKey: 'nonweatherRiskCheck',
    textKey: 'nonweatherRisk',
    title: '7. Non-Weather Environmental Hazards',
    question:
      'Are there non-weather variable hazards encountered along this route? (e.g., frequent wildlife crossing zones, long-term construction projects, agricultural equipment, or heavy commercial traffic)',
  },
  {
    id: 8,
    key: 'weatherRisk',
    checkKey: 'weatherRiskCheck',
    textKey: 'weatherRisk',
    title: '8. Weather & Seasonal Road Hazards',
    question:
      'Are there sections prone to severe weather or seasonal driving hazards? (e.g., wind-blown drifting snow, unplowed rural stretches, ice-prone bridge decks, steep slippery grades, or localized flash flooding)',
  },
  {
    id: 9,
    key: 'safetyConcern',
    checkKey: 'safetyConcernCheck',
    textKey: 'safetyConcern',
    title: '9. General Safety Concerns & Notes',
    question:
      'Do you have any other safety concerns, operational difficulties, or route adjustment recommendations regarding this route?',
  },
];
