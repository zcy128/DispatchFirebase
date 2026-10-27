import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Compass,
  Plus,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  CheckCircle2,
  GraduationCap,
  Truck,
  Users,
  Phone,
  Mail,
  MapPin,
  Pencil,
  Trash2,
  X,
  RotateCcw,
  ArrowRight,
  Megaphone,
  Award,
  Clock
} from 'lucide-react';
import {
  CharterClient,
  CharterTrip,
  CharterAssignment,
  CharterStop,
  CharterStopType,
  CharterTripType,
  CharterTripStatus,
  getCharterTripTypeLabel,
  getCharterTripStatusLabel,
  buildCharterSimpleStops,
  formatCharterStopTime,
  addMinutesToCharterTime,
  extractAssignedEmployeeIds,
} from '../types/charter';
import { RouteOpening, RouteOpeningRole } from '../types/routeOpening';
import { RouteOpeningService } from '../services/routeOpeningService';
import { RouteOpeningApplicantsDrawer } from '../components/dispatch/RouteOpeningApplicantsDrawer';
import { Employee } from '../types/employee';
import { Vehicle } from '../types/vehicle';
import { School } from '../types/school';
import { CharterService } from '../services/charterService';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { getLocalTodayString, addDaysToDateString } from '../utils/dateUtils';
import { logDispatchAction } from '../utils/dispatchLogger';

interface CharterManagementViewProps {
  employees?: Employee[];
  vehicles?: Vehicle[];
  schools?: School[];
  onNavigateToPayroll?: () => void;
}

export const CharterManagementView: React.FC<CharterManagementViewProps> = ({
  employees = [],
  vehicles = [],
  schools = [],
  onNavigateToPayroll,
}) => {
  const { currentUser } = useAuth();
  const { isFrench } = useI18n();
  const actorName = currentUser?.displayName || currentUser?.email || 'Dispatcher';

  // Sub-tab navigation: 'trips' | 'clients'
  const [subTab, setSubTab] = useState<'trips' | 'clients'>('trips');

  // Trips state
  const [trips, setTrips] = useState<CharterTrip[]>([]);
  const [clients, setClients] = useState<CharterClient[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDate, setSelectedDate] = useState<string>(getLocalTodayString());
  const [showAllDates, setShowAllDates] = useState<boolean>(true);
  const [tripSearch, setTripSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Selected Trip Drawer / Modal
  const [selectedTrip, setSelectedTrip] = useState<CharterTrip | null>(null);

  // New Trip Modal
  const [isTripModalOpen, setIsTripModalOpen] = useState<boolean>(false);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);

  // Trip form fields
  const [formClientId, setFormClientId] = useState<string>('');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formTripType, setFormTripType] = useState<CharterTripType>(0);
  const [formDepartsAt, setFormDepartsAt] = useState<string>(`${getLocalTodayString()}T08:00`);
  const [formReturnsAt, setFormReturnsAt] = useState<string>(`${getLocalTodayString()}T15:00`);
  const [formPassengerCount, setFormPassengerCount] = useState<number>(35);
  const [formVehiclesNeeded, setFormVehiclesNeeded] = useState<number>(1);
  const [formNeedsAttendant, setFormNeedsAttendant] = useState<boolean>(false);
  const [formFromAddress, setFormFromAddress] = useState<string>('');
  const [formToAddress, setFormToAddress] = useState<string>('');
  const [formRoundTrip, setFormRoundTrip] = useState<boolean>(true);
  const [formStops, setFormStops] = useState<CharterStop[]>([]);
  const [formQuotedAmount, setFormQuotedAmount] = useState<number>(450);
  const [formBillableHours, setFormBillableHours] = useState<number>(6);
  const [formDriverPayRate, setFormDriverPayRate] = useState<number>(150);
  const [formAttendantPayRate, setFormAttendantPayRate] = useState<number>(100);
  const [formBillingNotes, setFormBillingNotes] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formSpecialRequirements, setFormSpecialRequirements] = useState<string>('');

  // Assignment Modal
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState<boolean>(false);
  const [editingAssignment, setEditingAssignment] = useState<CharterAssignment | null>(null);
  const [asgVehicleId, setAsgVehicleId] = useState<number>(0);
  const [asgUnitNumber, setAsgUnitNumber] = useState<string>('');
  const [asgPlateNumber, setAsgPlateNumber] = useState<string>('');
  const [asgDriverId, setAsgDriverId] = useState<string>('');
  const [asgDriverName, setAsgDriverName] = useState<string>('');
  const [asgDriverPhone, setAsgDriverPhone] = useState<string>('');
  const [asgDriverPayRate, setAsgDriverPayRate] = useState<number>(150);
  const [asgDriverEiHours, setAsgDriverEiHours] = useState<number>(5);
  const [asgAttendantId, setAsgAttendantId] = useState<string>('');
  const [asgAttendantName, setAsgAttendantName] = useState<string>('');
  const [asgAttendantPhone, setAsgAttendantPhone] = useState<string>('');
  const [asgAttendantPayRate, setAsgAttendantPayRate] = useState<number>(100);
  const [asgAttendantEiHours, setAsgAttendantEiHours] = useState<number>(5);
  const [asgNotes, setAsgNotes] = useState<string>('');
  const [asgDriverDropdownOpen, setAsgDriverDropdownOpen] = useState<boolean>(false);
  const [asgDriverSearchQuery, setAsgDriverSearchQuery] = useState<string>('');
  const asgDriverDropdownRef = useRef<HTMLDivElement>(null);
  const [asgAttendantDropdownOpen, setAsgAttendantDropdownOpen] = useState<boolean>(false);
  const [asgAttendantSearchQuery, setAsgAttendantSearchQuery] = useState<string>('');
  const asgAttendantDropdownRef = useRef<HTMLDivElement>(null);

  // Client Modal
  const [isClientModalOpen, setIsClientModalOpen] = useState<boolean>(false);
  const [editingClient, setEditingClient] = useState<CharterClient | null>(null);
  const [clientSchoolId, setClientSchoolId] = useState<number | null>(null);
  const [schoolDropdownOpen, setSchoolDropdownOpen] = useState<boolean>(false);
  const [schoolSearchQuery, setSchoolSearchQuery] = useState<string>('');
  const schoolDropdownRef = useRef<HTMLDivElement>(null);
  const [clientName, setClientName] = useState<string>('');
  const [clientContactName, setClientContactName] = useState<string>('');
  const [clientContactPhone, setClientContactPhone] = useState<string>('');
  const [clientContactEmail, setClientContactEmail] = useState<string>('');
  const [clientBillingAddress, setClientBillingAddress] = useState<string>('');
  const [clientNotes, setClientNotes] = useState<string>('');
  const [clientActive, setClientActive] = useState<boolean>(true);
  const [clientSearch, setClientSearch] = useState<string>('');

  // Charter Openings (Bidding / Driver Applications) state
  const [routeOpenings, setRouteOpenings] = useState<RouteOpening[]>([]);
  const [publishingTrip, setPublishingTrip] = useState<CharterTrip | null>(null);
  const [pubRoleNeeded, setPubRoleNeeded] = useState<RouteOpeningRole>('driver');
  const [pubDeadline, setPubDeadline] = useState<string>('');
  const [pubDriverPayRate, setPubDriverPayRate] = useState<number>(150);
  const [pubAttendantPayRate, setPubAttendantPayRate] = useState<number>(100);
  const [pubStopTimes, setPubStopTimes] = useState<Record<string, string>>({});
  const [pubStops, setPubStops] = useState<CharterStop[]>([]);
  const [pubCompensation, setPubCompensation] = useState<string>('');
  const [pubDescription, setPubDescription] = useState<string>('');
  const [pubPostToChat, setPubPostToChat] = useState<boolean>(true);
  const [isPublishingOpening, setIsPublishingOpening] = useState<boolean>(false);
  const [reviewingCharterOpening, setReviewingCharterOpening] = useState<RouteOpening | null>(null);

  // Subscribe to trips, clients, and route_openings
  useEffect(() => {
    CharterService.seedSampleDataIfEmpty();

    const unsubTrips = CharterService.subscribeToTrips(
      (list) => {
        setTrips(list);
        setLoading(false);
      },
      (err) => {
        console.error('Trips subscription error:', err);
        setLoading(false);
      }
    );

    const unsubClients = CharterService.subscribeToClients(
      (list) => {
        setClients(list);
      },
      (err) => {
        console.error('Clients subscription error:', err);
      }
    );

    const unsubOpenings = RouteOpeningService.subscribeToOpenings(
      (list) => {
        setRouteOpenings(list);
      },
      (err) => {
        console.error('Charter openings subscription error:', err);
      }
    );

    return () => {
      unsubTrips();
      unsubClients();
      unsubOpenings();
    };
  }, []);

  // Map charterTripId -> RouteOpening
  const charterOpeningsByTripId = useMemo(() => {
    const map: Record<string, RouteOpening> = {};
    for (const op of routeOpenings) {
      if (op.postingType === 'charter' && op.charterTripId) {
        map[op.charterTripId] = op;
      } else if (op.id.startsWith('RO-CHARTER-')) {
        const tId = op.id.replace('RO-CHARTER-', '');
        map[tId] = op;
      } else if (op.postingType === 'charter' && op.routeId) {
        map[op.routeId] = op;
      }
    }
    return map;
  }, [routeOpenings]);

  // Keep reviewingCharterOpening fresh when routeOpenings updates
  useEffect(() => {
    if (reviewingCharterOpening) {
      const updated = routeOpenings.find((o) => o.id === reviewingCharterOpening.id);
      if (updated) setReviewingCharterOpening(updated);
    }
  }, [routeOpenings]);

  // Update selectedTrip if trips array updates
  useEffect(() => {
    if (selectedTrip) {
      const updated = trips.find((t) => t.id === selectedTrip.id);
      if (updated) setSelectedTrip(updated);
    }
  }, [trips]);

  // Normalizes a trip's stops so legacy 3-stop round trips upgrade to the 4-stop itinerary:
  // #1 Pickup (e.g. School @ 08:00), #2 Dropoff (e.g. Museum @ 08:30),
  // #3 Return Pickup (e.g. Library/Museum @ 15:00), #4 Return Dropoff (e.g. School @ 15:30)
  const normalizeCharterTripStops = (trip: CharterTrip, existingOp?: RouteOpening): CharterStop[] => {
    const rawStops = trip.stops || [];
    const dateStr = trip.dispatchDate || trip.departsAt?.slice(0, 10) || getLocalTodayString();
    const depTime = formatCharterStopTime(trip.departsAt) || '08:00';
    const retTime = formatCharterStopTime(trip.returnsAt) || '15:00';

    if (
      trip.roundTrip !== false &&
      rawStops.length === 3 &&
      rawStops[0]?.stopType === 0 &&
      rawStops[1]?.stopType === 1 &&
      rawStops[2]?.stopType === 2
    ) {
      const s1Time = formatCharterStopTime(rawStops[0].scheduledAt) || depTime;
      const s2Time = addMinutesToCharterTime(s1Time, 30);
      const s3Time = formatCharterStopTime(rawStops[2].scheduledAt) || retTime;
      const s4Time = addMinutesToCharterTime(s3Time, 30);

      return [
        {
          ...rawStops[0],
          id: rawStops[0].id || `ST-${trip.id}-1`,
          sequenceOrder: 1,
          stopType: 0,
          locationName: 'Pickup',
          address: rawStops[0].address || 'School',
          scheduledAt: `${dateStr}T${s1Time}`,
        },
        {
          ...rawStops[1],
          id: rawStops[1].id || `ST-${trip.id}-2`,
          sequenceOrder: 2,
          stopType: 1,
          locationName: 'Dropoff',
          address: rawStops[1].address || 'Destination',
          scheduledAt: `${dateStr}T${s2Time}`,
        },
        {
          id: `ST-${trip.id}-3`,
          charterTripId: trip.id,
          sequenceOrder: 3,
          stopType: 3,
          locationName: 'Return Pickup',
          address: rawStops[1].address || 'Destination',
          scheduledAt: `${dateStr}T${s3Time}`,
        },
        {
          ...rawStops[2],
          id: `ST-${trip.id}-4`,
          sequenceOrder: 4,
          stopType: 2,
          locationName: 'Return Dropoff',
          address: rawStops[2].address || rawStops[0].address || 'School',
          scheduledAt: `${dateStr}T${s4Time}`,
        },
      ];
    }

    if (rawStops.length === 0) {
      return buildCharterSimpleStops({
        tripId: trip.id || 'temp',
        fromAddress: 'School',
        toAddress: 'Destination',
        roundTrip: trip.roundTrip !== false,
        departsAt: `${dateStr}T${depTime}`,
        returnsAt: `${dateStr}T${retTime}`,
      });
    }

    return rawStops.map((s, idx) => {
      const fromOp = existingOp?.sanitizedStops?.find(
        (ss) => String(ss.stopId) === String(s.id) || ss.sequence === (s.sequenceOrder || idx + 1)
      )?.stopScheduleTime;
      const resolvedTime =
        formatCharterStopTime(fromOp) ||
        formatCharterStopTime(s.scheduledAt) ||
        (idx === 0
          ? depTime
          : idx === 1
          ? addMinutesToCharterTime(depTime, 30)
          : idx === 2
          ? retTime
          : addMinutesToCharterTime(retTime, 30));
      return {
        ...s,
        sequenceOrder: idx + 1,
        scheduledAt: `${dateStr}T${resolvedTime}`,
      };
    });
  };

  // Auto-upgrade any legacy 3-stop round-trip charter_trips and route_openings in Firestore to the 4-stop itinerary
  const migratedIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    trips.forEach((tr) => {
      // Auto-populate redundant assignedEmployeeIds for Firestore index-level driver queries
      if (!migratedIdsRef.current.has(`empIds:${tr.id}`)) {
        migratedIdsRef.current.add(`empIds:${tr.id}`);
        const expectedIds = extractAssignedEmployeeIds(tr.assignments);
        const currentIds = tr.assignedEmployeeIds || [];
        const isMatch = currentIds.length === expectedIds.length && currentIds.every((id) => expectedIds.includes(id));
        if (!isMatch) {
          CharterService.updateTrip(tr.id, { assignedEmployeeIds: expectedIds }, actorName).catch(() => {});
        }
      }

      if (
        tr.roundTrip !== false &&
        tr.stops &&
        tr.stops.length === 3 &&
        !migratedIdsRef.current.has(`trip:${tr.id}`)
      ) {
        migratedIdsRef.current.add(`trip:${tr.id}`);
        const upgradedStops = normalizeCharterTripStops(tr, charterOpeningsByTripId[tr.id]);
        const upgradedAssignments = (tr.assignments || []).map((a) => ({
          ...a,
          stops: upgradedStops.map((us, idx) => ({
            ...us,
            arrivedAt: a.stops?.[idx]?.arrivedAt,
            departedAt: a.stops?.[idx]?.departedAt,
          })),
        }));
        CharterService.updateTrip(
          tr.id,
          { stops: upgradedStops, assignments: upgradedAssignments },
          actorName
        ).catch(() => {});
      }
    });

    routeOpenings.forEach((op) => {
      if (
        op.postingType === 'charter' &&
        op.sanitizedStops &&
        op.sanitizedStops.length === 3 &&
        !migratedIdsRef.current.has(`op:${op.id}`)
      ) {
        migratedIdsRef.current.add(`op:${op.id}`);
        const linkedTrip = trips.find((t) => t.id === (op.charterTripId || op.routeId));
        const upgradedStops = linkedTrip
          ? normalizeCharterTripStops(linkedTrip, op)
          : buildCharterSimpleStops({
              tripId: op.charterTripId || op.routeId,
              fromAddress: op.sanitizedStops[0]?.stopLocation.replace(/^Pickup\s*[:(]?\s*/i, '').replace(/\)$/, '') || 'School',
              toAddress: op.sanitizedStops[1]?.stopLocation.replace(/^Destination\s*[:(]?\s*/i, '').replace(/\)$/, '') || 'Museum',
              returnPickupAddress: op.sanitizedStops[1]?.stopLocation.replace(/^Destination\s*[:(]?\s*/i, '').replace(/\)$/, '') || 'Library',
              returnDropoffAddress: op.sanitizedStops[2]?.stopLocation.replace(/^Return\s*[:(]?\s*/i, '').replace(/\)$/, '') || 'School',
              roundTrip: true,
              departsAt: op.departsAt || `${op.effectiveStartDate}T08:00`,
              returnsAt: op.returnsAt || `${op.effectiveStartDate}T15:00`,
            });
        const newSanitized = upgradedStops.map((s, idx) => {
          const actionLabel =
            s.stopType === 0
              ? 'Pickup'
              : s.stopType === 1
              ? 'Dropoff'
              : s.stopType === 3
              ? 'Return Pickup'
              : 'Return Dropoff';
          return {
            stopId: s.id || `stop-${idx + 1}`,
            sequence: idx + 1,
            stopLocation: `${actionLabel}: ${s.address}`,
            stopScheduleTime: formatCharterStopTime(s.scheduledAt) || '08:00',
            stopType:
              s.stopType === 0 || s.stopType === 3
                ? 'CharterPickup'
                : s.stopType === 1
                ? 'CharterDestination'
                : 'CharterReturn',
            schoolName: op.charterClientName || linkedTrip?.clientName,
          };
        });
        RouteOpeningService.updateOpening(op.id, {
          sanitizedStops: newSanitized,
        }).catch(() => {});
      }
    });
  }, [trips, routeOpenings]);

  // Drivers and attendants from employees list
  const driverOptions = useMemo(() => {
    return employees.filter(
      (e) => (e.jobPosition || '').toLowerCase().includes('driver') || (e.jobPosition || '').toLowerCase().includes('chauffeur')
    );
  }, [employees]);

  const attendantOptions = useMemo(() => {
    return employees.filter(
      (e) =>
        (e.jobPosition || '').toLowerCase().includes('helper') ||
        (e.jobPosition || '').toLowerCase().includes('attendant') ||
        (e.jobPosition || '').toLowerCase().includes('accompagnateur')
    );
  }, [employees]);

  // Filtered trips
  const filteredTrips = useMemo(() => {
    return trips.filter((t) => {
      if (!showAllDates && t.dispatchDate !== selectedDate) return false;
      if (statusFilter !== 'all' && String(t.status) !== statusFilter) return false;
      if (typeFilter !== 'all' && String(t.tripType) !== typeFilter) return false;
      if (tripSearch.trim()) {
        const q = tripSearch.toLowerCase();
        const numMatch = (t.tripNumber || '').toLowerCase().includes(q);
        const titleMatch = (t.title || '').toLowerCase().includes(q);
        const clientMatch = (t.clientName || '').toLowerCase().includes(q);
        const crewMatch = t.assignments?.some(
          (a) =>
            a.driverName.toLowerCase().includes(q) ||
            (a.attendantName && a.attendantName.toLowerCase().includes(q)) ||
            a.vehicleUnitNumber.toLowerCase().includes(q)
        );
        if (!numMatch && !titleMatch && !clientMatch && !crewMatch) return false;
      }
      return true;
    });
  }, [trips, showAllDates, selectedDate, statusFilter, typeFilter, tripSearch]);

  // KPI Metrics
  const kpis = useMemo(() => {
    let totalQuoted = 0;
    let pendingCheckIn = 0;
    let checkedIn = 0;
    let completed = 0;

    for (const t of trips) {
      totalQuoted += t.quotedAmount || 0;
      if (t.status === 4) completed++;
      if (t.assignments && t.assignments.length > 0) {
        for (const a of t.assignments) {
          if (a.isDriverCheckedIn) {
            checkedIn++;
          } else {
            pendingCheckIn++;
          }
        }
      }
    }

    return {
      totalTrips: trips.length,
      totalQuoted,
      pendingCheckIn,
      checkedIn,
      completed,
    };
  }, [trips]);

  // Filtered clients
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      if (!clientSearch.trim()) return true;
      const q = clientSearch.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        (c.contactName && c.contactName.toLowerCase().includes(q)) ||
        (c.contactEmail && c.contactEmail.toLowerCase().includes(q)) ||
        (c.contactPhone && c.contactPhone.toLowerCase().includes(q))
      );
    });
  }, [clients, clientSearch]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (schoolDropdownRef.current && !schoolDropdownRef.current.contains(target)) {
        setSchoolDropdownOpen(false);
      }
      if (asgDriverDropdownRef.current && !asgDriverDropdownRef.current.contains(target)) {
        setAsgDriverDropdownOpen(false);
      }
      if (asgAttendantDropdownRef.current && !asgAttendantDropdownRef.current.contains(target)) {
        setAsgAttendantDropdownOpen(false);
      }
    };
    if (schoolDropdownOpen || asgDriverDropdownOpen || asgAttendantDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [schoolDropdownOpen, asgDriverDropdownOpen, asgAttendantDropdownOpen]);

  // Filtered and sorted drivers for assignment
  const filteredDrivers = useMemo(() => {
    const sorted = [...driverOptions].sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
    );
    if (!asgDriverSearchQuery.trim()) return sorted;
    const q = asgDriverSearchQuery.toLowerCase().trim();
    return sorted.filter((d) => {
      const fullName = `${d.firstName || ''} ${d.lastName || ''}`.toLowerCase();
      const empNum = (d.employeeNumber || '').toLowerCase();
      const phone = (d.mobilePhone || d.workPhonePhone || d.homePhone || '').toLowerCase();
      return fullName.includes(q) || empNum.includes(q) || phone.includes(q);
    });
  }, [driverOptions, asgDriverSearchQuery]);

  // Filtered and sorted attendants for assignment
  const filteredAttendants = useMemo(() => {
    const sorted = [...attendantOptions].sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
    );
    if (!asgAttendantSearchQuery.trim()) return sorted;
    const q = asgAttendantSearchQuery.toLowerCase().trim();
    return sorted.filter((a) => {
      const fullName = `${a.firstName || ''} ${a.lastName || ''}`.toLowerCase();
      const empNum = (a.employeeNumber || '').toLowerCase();
      const phone = (a.mobilePhone || a.workPhonePhone || a.homePhone || '').toLowerCase();
      return fullName.includes(q) || empNum.includes(q) || phone.includes(q);
    });
  }, [attendantOptions, asgAttendantSearchQuery]);

  // Filtered and sorted schools for the school selector combobox in New/Edit Client modal
  const filteredSchools = useMemo(() => {
    const sorted = [...schools].sort((a, b) => (a.schoolName || '').localeCompare(b.schoolName || ''));
    if (!schoolSearchQuery.trim()) return sorted;
    const q = schoolSearchQuery.toLowerCase().trim();
    return sorted.filter((s) => {
      return (
        (s.schoolName && s.schoolName.toLowerCase().includes(q)) ||
        (s.schoolBoardName && s.schoolBoardName.toLowerCase().includes(q)) ||
        (s.schoolBoardCode && s.schoolBoardCode.toLowerCase().includes(q)) ||
        (s.schoolAddress && s.schoolAddress.toLowerCase().includes(q)) ||
        (s.contactPerson && s.contactPerson.toLowerCase().includes(q))
      );
    });
  }, [schools, schoolSearchQuery]);

  const selectedSchool = useMemo(() => {
    if (!clientSchoolId) return null;
    return schools.find((s) => s.schoolId === clientSchoolId) || null;
  }, [schools, clientSchoolId]);

  // Open Create Trip Modal
  const handleOpenCreateTrip = () => {
    setEditingTripId(null);
    setFormClientId(clients[0]?.id || '');
    setFormTitle('');
    setFormTripType(0);
    const today = getLocalTodayString();
    const depIso = `${today}T08:00`;
    const retIso = `${today}T15:00`;
    setFormDepartsAt(depIso);
    setFormReturnsAt(retIso);
    setFormPassengerCount(35);
    setFormVehiclesNeeded(1);
    setFormNeedsAttendant(false);
    setFormFromAddress('School');
    setFormToAddress('Museum');
    setFormRoundTrip(true);
    setFormStops(
      buildCharterSimpleStops({
        tripId: 'new',
        fromAddress: 'School',
        toAddress: 'Museum',
        returnPickupAddress: 'Library',
        returnDropoffAddress: 'School',
        roundTrip: true,
        departsAt: depIso,
        returnsAt: retIso,
        outboundDropoffAt: `${today}T08:30`,
        returnDropoffAt: `${today}T15:30`,
      })
    );
    setFormQuotedAmount(450);
    setFormBillableHours(6);
    setFormDriverPayRate(150);
    setFormAttendantPayRate(100);
    setFormBillingNotes('');
    setFormNotes('');
    setFormSpecialRequirements('');
    setIsTripModalOpen(true);
  };

  // Open Edit Trip Modal
  const handleOpenEditTrip = (trip: CharterTrip) => {
    setEditingTripId(trip.id);
    setFormClientId(trip.charterClientId);
    setFormTitle(trip.title);
    setFormTripType(trip.tripType);
    setFormDepartsAt(trip.departsAt || `${trip.dispatchDate}T08:00`);
    setFormReturnsAt(trip.returnsAt || `${trip.dispatchDate}T15:00`);
    setFormPassengerCount(trip.passengerCount || 35);
    setFormVehiclesNeeded(trip.vehiclesNeeded || Math.max(1, trip.assignments?.length || 1));
    setFormNeedsAttendant(trip.needsAttendant || false);
    const normalizedStops = normalizeCharterTripStops(trip, charterOpeningsByTripId[trip.id]);
    setFormStops(normalizedStops);
    setFormFromAddress(normalizedStops[0]?.address || '');
    setFormToAddress(normalizedStops[1]?.address || '');
    setFormRoundTrip(trip.roundTrip ?? true);
    setFormQuotedAmount(trip.quotedAmount || 0);
    setFormBillableHours(trip.billableHours || 0);
    setFormDriverPayRate(trip.driverPayRate ?? trip.assignments?.[0]?.driverPayRate ?? 150);
    setFormAttendantPayRate(trip.attendantPayRate ?? trip.assignments?.[0]?.attendantPayRate ?? 100);
    setFormBillingNotes(trip.billingNotes || '');
    setFormNotes(trip.notes || '');
    setFormSpecialRequirements(trip.specialRequirements || '');
    setIsTripModalOpen(true);
  };

  // Handle Departure Time change: automatically adjusts return time, defaulting to the same day
  const handleDepartureTimeChange = (newDepartsAt: string) => {
    setFormDepartsAt(newDepartsAt);

    // Only auto-adjust when a valid full datetime-local string (YYYY-MM-DDTHH:mm) is present
    if (!newDepartsAt || newDepartsAt.length < 16) return;

    const newDepDate = newDepartsAt.slice(0, 10);
    const newDepTime = formatCharterStopTime(newDepartsAt) || '08:00';
    const oldDep = new Date(formDepartsAt);
    const oldRet = new Date(formReturnsAt);
    const newDep = new Date(newDepartsAt);

    let durationMs = 0;
    if (!isNaN(oldDep.getTime()) && !isNaN(oldRet.getTime()) && oldRet > oldDep) {
      durationMs = oldRet.getTime() - oldDep.getTime();
    } else {
      durationMs = (formBillableHours || 7) * 60 * 60 * 1000;
    }

    const calculatedRet = new Date(newDep.getTime() + durationMs);
    const calcYear = calculatedRet.getFullYear();
    const calcMonth = String(calculatedRet.getMonth() + 1).padStart(2, '0');
    const calcDay = String(calculatedRet.getDate()).padStart(2, '0');
    const calcDate = `${calcYear}-${calcMonth}-${calcDay}`;

    let nextRetIso = `${newDepDate}T15:00`;
    if (calcDate === newDepDate) {
      const hours = String(calculatedRet.getHours()).padStart(2, '0');
      const mins = String(calculatedRet.getMinutes()).padStart(2, '0');
      nextRetIso = `${newDepDate}T${hours}:${mins}`;
    } else {
      // Keep on the same day as departure (default is same day)
      nextRetIso = `${newDepDate}T15:00`;
    }
    setFormReturnsAt(nextRetIso);
    const nextRetTime = formatCharterStopTime(nextRetIso) || '15:00';

    setFormStops((prev) =>
      prev.map((s, idx) => {
        if (idx === 0) return { ...s, scheduledAt: `${newDepDate}T${newDepTime}` };
        if (idx === 1) return { ...s, scheduledAt: `${newDepDate}T${addMinutesToCharterTime(newDepTime, 30)}` };
        if (idx === 2) return { ...s, scheduledAt: `${newDepDate}T${nextRetTime}` };
        if (idx === 3) return { ...s, scheduledAt: `${newDepDate}T${addMinutesToCharterTime(nextRetTime, 30)}` };
        const existingT = formatCharterStopTime(s.scheduledAt) || newDepTime;
        return { ...s, scheduledAt: `${newDepDate}T${existingT}` };
      })
    );
  };

  // Helper to create an open shift slot with its own copy of stops
  const createOpenShiftSlot = (
    tripId: string,
    runNum: number,
    templateStops: CharterStop[],
    billableHrs: number,
    drvRate: number = 150,
    attRate: number = 100
  ): CharterAssignment => {
    const nowIso = new Date().toISOString();
    return {
      id: `ASG-${tripId}-${runNum}-${Math.random().toString(36).slice(2, 6)}`,
      charterTripId: tripId,
      runNumber: runNum,
      vehicleId: 0,
      vehicleUnitNumber: 'TBD',
      plateNumber: '',
      driverId: '',
      driverName: '',
      driverPhone: '',
      driverPayOption: 'STANDARD',
      driverPayRate: Number(drvRate) || 150,
      driverEiHours: Number(billableHrs) || 5,
      attendantPayOption: 'STANDARD',
      attendantPayRate: Number(attRate) || 100,
      attendantEiHours: Number(billableHrs) || 5,
      status: 0,
      isDriverCheckedIn: false,
      isAttendantCheckedIn: false,
      stops: templateStops.map((s) => {
        const copy: CharterStop = { ...s };
        delete copy.arrivedAt;
        delete copy.departedAt;
        return copy;
      }),
      notes: '',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  };

  // Save Trip
  const handleSaveTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    const client = clients.find((c) => c.id === formClientId);
    const clientNameStr = client ? client.name : 'General Charter Client';
    const dispatchDate = formDepartsAt.slice(0, 10);
    const neededCount = Math.max(1, Number(formVehiclesNeeded) || 1);
    const drvRateVal = Number(formDriverPayRate) || 150;
    const attRateVal = Number(formAttendantPayRate) || 100;

    const stops: CharterStop[] =
      formStops && formStops.length > 0
        ? formStops.map((s, idx) => {
            const hhmm = formatCharterStopTime(s.scheduledAt) || (idx === 0 ? '08:00' : idx === 1 ? '08:30' : idx === 2 ? '15:00' : '15:30');
            return {
              ...s,
              id: s.id || `ST-${editingTripId || 'temp'}-${idx + 1}`,
              charterTripId: editingTripId || 'temp',
              sequenceOrder: idx + 1,
              locationName:
                s.locationName ||
                (s.stopType === 0
                  ? 'Pickup'
                  : s.stopType === 1
                  ? 'Dropoff'
                  : s.stopType === 3
                  ? 'Return Pickup'
                  : 'Return Dropoff'),
              scheduledAt: `${dispatchDate}T${hhmm}`,
            };
          })
        : buildCharterSimpleStops({
            tripId: editingTripId || 'temp',
            fromAddress: formFromAddress || 'School',
            toAddress: formToAddress || 'Museum',
            roundTrip: formRoundTrip,
            departsAt: formDepartsAt,
            returnsAt: formReturnsAt,
          });

    try {
      if (editingTripId) {
        const existingTrip = trips.find((t) => t.id === editingTripId);
        let updatedAssignments: CharterAssignment[] = (existingTrip?.assignments || []).map((asg, idx) => {
          // Sync route stop addresses/scheduled times while preserving per-shift arrivedAt/departedAt
          const existingStops = asg.stops || [];
          const syncedStops: CharterStop[] = stops.map((tmplStop, sIdx) => {
            const prevStop = existingStops.find((es) => es.stopType === tmplStop.stopType) || existingStops[sIdx];
            const merged: CharterStop = { ...tmplStop };
            if (prevStop?.arrivedAt) merged.arrivedAt = prevStop.arrivedAt;
            if (prevStop?.departedAt) merged.departedAt = prevStop.departedAt;
            return merged;
          });
          return {
            ...asg,
            runNumber: asg.runNumber || idx + 1,
            driverPayRate: drvRateVal,
            attendantPayRate: attRateVal,
            stops: syncedStops,
          };
        });

        // If vehiclesNeeded increased, generate open shift slots up to neededCount
        while (updatedAssignments.length < neededCount) {
          const nextRun = updatedAssignments.length + 1;
          updatedAssignments.push(
            createOpenShiftSlot(
              editingTripId,
              nextRun,
              stops,
              Number(formBillableHours),
              drvRateVal,
              attRateVal
            )
          );
        }

        // If vehiclesNeeded decreased, remove trailing completely unassigned/unstarted shift slots
        while (updatedAssignments.length > neededCount) {
          const last = updatedAssignments[updatedAssignments.length - 1];
          const isUnassigned =
            !last.driverId &&
            !last.driverName &&
            (!last.vehicleId || last.vehicleUnitNumber === 'TBD') &&
            !last.isDriverCheckedIn &&
            !last.isAttendantCheckedIn;
          if (isUnassigned) {
            updatedAssignments.pop();
          } else {
            break;
          }
        }

        await CharterService.updateTrip(
          editingTripId,
          {
            charterClientId: formClientId,
            clientName: clientNameStr,
            title: formTitle,
            tripType: formTripType,
            dispatchDate,
            departsAt: formDepartsAt,
            returnsAt: formReturnsAt,
            passengerCount: Number(formPassengerCount),
            vehiclesNeeded: Math.max(neededCount, updatedAssignments.length),
            needsAttendant: formNeedsAttendant,
            stops,
            assignments: updatedAssignments,
            roundTrip: formRoundTrip,
            quotedAmount: Number(formQuotedAmount),
            billableHours: Number(formBillableHours),
            driverPayRate: drvRateVal,
            attendantPayRate: attRateVal,
            billingNotes: formBillingNotes,
            notes: formNotes,
            specialRequirements: formSpecialRequirements,
          },
          actorName
        );

        // If this Charter Trip is already published to Route Openings, sync the updated stops & schedule immediately
        const existingOp = charterOpeningsByTripId[editingTripId];
        if (existingOp) {
          const syncedSanitizedStops = stops.map((s, idx) => {
            const actionLabel =
              s.stopType === 0
                ? 'Pickup'
                : s.stopType === 1
                ? 'Dropoff'
                : s.stopType === 3
                ? 'Return Pickup'
                : 'Return Dropoff';
            return {
              stopId: s.id || `stop-${idx + 1}`,
              sequence: idx + 1,
              stopLocation: `${actionLabel}: ${s.address}`,
              stopScheduleTime: formatCharterStopTime(s.scheduledAt) || '08:00',
              stopType:
                s.stopType === 0 || s.stopType === 3
                  ? 'CharterPickup'
                  : s.stopType === 1
                  ? 'CharterDestination'
                  : 'CharterReturn',
              schoolName: clientNameStr,
              latitude: s.latitude,
              longitude: s.longitude,
            };
          });
          const firstT = formatCharterStopTime(stops[0]?.scheduledAt) || formatCharterStopTime(formDepartsAt) || '08:00';
          const lastT =
            formatCharterStopTime(stops[stops.length - 1]?.scheduledAt) ||
            formatCharterStopTime(formReturnsAt) ||
            '15:30';
          await RouteOpeningService.updateOpening(existingOp.id, {
            routeName: formTitle,
            charterClientName: clientNameStr,
            departsAt: formDepartsAt,
            returnsAt: formReturnsAt,
            passengerCount: Number(formPassengerCount),
            driverPayRate: drvRateVal,
            attendantPayRate: attRateVal,
            shiftType: `CHARTER (${firstT} - ${lastT})`,
            sanitizedStops: syncedSanitizedStops,
          });
        }
      } else {
        const tripNum = `CHR-${new Date().getFullYear()}-${String(trips.length + 1).padStart(3, '0')}`;
        const initialAssignments: CharterAssignment[] = Array.from({ length: neededCount }, (_, idx) =>
          createOpenShiftSlot(
            tripNum,
            idx + 1,
            stops,
            Number(formBillableHours),
            drvRateVal,
            attRateVal
          )
        );
        await CharterService.createTrip({
          tripNumber: tripNum,
          charterClientId: formClientId,
          clientName: clientNameStr,
          title: formTitle,
          tripType: formTripType,
          status: 1, // Confirmed / Open for Dispatch & Drivers
          dispatchDate,
          departsAt: formDepartsAt,
          returnsAt: formReturnsAt,
          passengerCount: Number(formPassengerCount),
          vehiclesNeeded: neededCount,
          needsAttendant: formNeedsAttendant,
          specialRequirements: formSpecialRequirements,
          quotedAmount: Number(formQuotedAmount),
          billableHours: Number(formBillableHours),
          driverPayRate: drvRateVal,
          attendantPayRate: attRateVal,
          billingNotes: formBillingNotes,
          notes: formNotes,
          roundTrip: formRoundTrip,
          stops,
          assignments: initialAssignments,
          createdByUserId: currentUser?.uid,
          createdByName: actorName,
        });
      }
      setIsTripModalOpen(false);
    } catch (err) {
      alert('Failed to save trip: ' + (err as Error).message);
    }
  };

  // Change Trip Status
  const handleUpdateTripStatus = async (trip: CharterTrip, newStatus: CharterTripStatus) => {
    try {
      await CharterService.updateTrip(trip.id, { status: newStatus }, actorName);
      await logDispatchAction({
        date: trip.dispatchDate,
        type: 'Charter Status Updated',
        detail: `Trip ${trip.tripNumber} status changed to ${getCharterTripStatusLabel(newStatus, false)}`,
        user: actorName,
      });
    } catch (err) {
      alert('Status update failed: ' + (err as Error).message);
    }
  };

  // Delete Trip
  const handleDeleteTrip = async (trip: CharterTrip) => {
    if (!window.confirm(`Delete charter trip ${trip.tripNumber} (${trip.title})?`)) return;
    try {
      await CharterService.deleteTrip(trip.id);
      if (selectedTrip?.id === trip.id) setSelectedTrip(null);
    } catch (err) {
      alert('Failed to delete trip: ' + (err as Error).message);
    }
  };

  // Open Assignment Modal
  const handleOpenAssignmentModal = (assignment?: CharterAssignment) => {
    setAsgDriverDropdownOpen(false);
    setAsgDriverSearchQuery('');
    setAsgAttendantDropdownOpen(false);
    setAsgAttendantSearchQuery('');

    if (assignment) {
      setEditingAssignment(assignment);
      setAsgVehicleId(assignment.vehicleId);
      setAsgUnitNumber(assignment.vehicleUnitNumber);
      setAsgPlateNumber(assignment.plateNumber || '');
      setAsgDriverId(assignment.driverId);
      setAsgDriverName(assignment.driverName);
      setAsgDriverPhone(assignment.driverPhone || '');
      setAsgDriverPayRate(assignment.driverPayRate);
      setAsgDriverEiHours(assignment.driverEiHours);
      setAsgAttendantId(assignment.attendantId || '');
      setAsgAttendantName(assignment.attendantName || '');
      setAsgAttendantPhone(assignment.attendantPhone || '');
      setAsgAttendantPayRate(assignment.attendantPayRate || 100);
      setAsgAttendantEiHours(assignment.attendantEiHours || 5);
      setAsgNotes(assignment.notes || '');
    } else {
      setEditingAssignment(null);
      const defaultVeh = vehicles[0];
      setAsgVehicleId(defaultVeh?.vehicleId || 101);
      setAsgUnitNumber(defaultVeh?.unitNumber || 'BUS-101');
      setAsgPlateNumber(defaultVeh?.plateNumber || '');
      const defaultDrv = driverOptions[0];
      setAsgDriverId(defaultDrv?.employeeNumber || defaultDrv?.id || '');
      setAsgDriverName(defaultDrv ? `${defaultDrv.firstName} ${defaultDrv.lastName}` : '');
      setAsgDriverPhone(defaultDrv?.mobilePhone || defaultDrv?.workPhonePhone || defaultDrv?.homePhone || '');
      setAsgDriverPayRate(selectedTrip?.driverPayRate ?? selectedTrip?.assignments?.[0]?.driverPayRate ?? 150);
      setAsgDriverEiHours(selectedTrip?.billableHours || 5);
      setAsgAttendantId('');
      setAsgAttendantName('');
      setAsgAttendantPhone('');
      setAsgAttendantPayRate(selectedTrip?.attendantPayRate ?? selectedTrip?.assignments?.[0]?.attendantPayRate ?? 100);
      setAsgAttendantEiHours(selectedTrip?.billableHours || 5);
      setAsgNotes('');
    }
    setIsAssignmentModalOpen(true);
  };

  const handleSelectDriver = (d: Employee) => {
    const dVal = String(d.employeeId || d.id || d.employeeNumber);
    setAsgDriverId(dVal);
    setAsgDriverName(`${d.firstName} ${d.lastName}`);
    setAsgDriverPhone(d.mobilePhone || d.workPhonePhone || d.homePhone || '');
    setAsgDriverDropdownOpen(false);
    setAsgDriverSearchQuery('');
  };

  const handleClearDriver = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setAsgDriverId('');
    setAsgDriverName('');
    setAsgDriverPhone('');
    setAsgDriverSearchQuery('');
  };

  const handleSelectAttendant = (a: Employee | null) => {
    if (!a) {
      setAsgAttendantId('');
      setAsgAttendantName('');
      setAsgAttendantPhone('');
    } else {
      const aVal = String(a.employeeId || a.id || a.employeeNumber);
      setAsgAttendantId(aVal);
      setAsgAttendantName(`${a.firstName} ${a.lastName}`);
      setAsgAttendantPhone(a.mobilePhone || a.workPhonePhone || a.homePhone || '');
    }
    setAsgAttendantDropdownOpen(false);
    setAsgAttendantSearchQuery('');
  };

  const handleClearAttendant = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setAsgAttendantId('');
    setAsgAttendantName('');
    setAsgAttendantPhone('');
    setAsgAttendantSearchQuery('');
  };

  // Save Assignment
  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrip) return;

    try {
      if (editingAssignment) {
        // Updating existing assignment: Automatically syncs dispatch_payrolls and payroll_logs!
        await CharterService.updateAssignmentCrew(
          selectedTrip.id,
          editingAssignment.id,
          {
            vehicleId: asgVehicleId,
            vehicleUnitNumber: asgVehicleId ? asgUnitNumber : 'TBD',
            plateNumber: asgVehicleId ? asgPlateNumber : '',
            driverId: asgDriverId,
            driverName: asgDriverName,
            driverPhone: asgDriverPhone,
            driverPayRate: Number(asgDriverPayRate),
            driverEiHours: Number(asgDriverEiHours),
            attendantId: asgAttendantId || '',
            attendantName: asgAttendantName || '',
            attendantPhone: asgAttendantPhone || '',
            attendantPayRate: Number(asgAttendantPayRate),
            attendantEiHours: Number(asgAttendantEiHours),
            notes: asgNotes,
          },
          actorName
        );

        await logDispatchAction({
          date: selectedTrip.dispatchDate,
          type: 'Charter Crew Modified',
          detail: `Modified crew assignment on ${selectedTrip.tripNumber}: Driver ${asgDriverName || 'TBD'}, Unit ${asgVehicleId ? asgUnitNumber : 'TBD'}`,
          user: actorName,
        });
      } else {
        // Add new assignment / shift
        const nextRunNum = (selectedTrip.assignments?.length || 0) + 1;
        const newAssignmentId = `ASG-${selectedTrip.id}-${nextRunNum}-${Date.now().toString().slice(-4)}`;
        const clonedStops: CharterStop[] = (selectedTrip.stops || []).map((s) => {
          const copy: CharterStop = { ...s };
          delete copy.arrivedAt;
          delete copy.departedAt;
          return copy;
        });
        const newAssignment: CharterAssignment = {
          id: newAssignmentId,
          charterTripId: selectedTrip.id,
          runNumber: nextRunNum,
          vehicleId: asgVehicleId,
          vehicleUnitNumber: asgVehicleId ? asgUnitNumber : 'TBD',
          plateNumber: asgVehicleId ? asgPlateNumber : '',
          driverId: asgDriverId,
          driverName: asgDriverName,
          driverPhone: asgDriverPhone,
          driverPayOption: 'STANDARD',
          driverPayRate: Number(asgDriverPayRate),
          driverEiHours: Number(asgDriverEiHours),
          attendantId: asgAttendantId || '',
          attendantName: asgAttendantName || '',
          attendantPhone: asgAttendantPhone || '',
          attendantPayOption: 'STANDARD',
          attendantPayRate: Number(asgAttendantPayRate),
          attendantEiHours: Number(asgAttendantEiHours),
          status: 0,
          isDriverCheckedIn: false,
          isAttendantCheckedIn: false,
          stops: clonedStops,
          notes: asgNotes,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const updatedAssignments = [...(selectedTrip.assignments || []), newAssignment];
        await CharterService.updateTrip(
          selectedTrip.id,
          {
            assignments: updatedAssignments,
            vehiclesNeeded: Math.max(selectedTrip.vehiclesNeeded || 1, updatedAssignments.length),
            status: selectedTrip.status === 0 ? 2 : selectedTrip.status,
          },
          actorName
        );
      }
      setIsAssignmentModalOpen(false);
    } catch (err) {
      alert('Assignment save error: ' + (err as Error).message);
    }
  };

  // Delete Assignment
  const handleDeleteAssignment = async (assignment: CharterAssignment) => {
    if (!selectedTrip) return;
    if (!window.confirm(`Remove vehicle ${assignment.vehicleUnitNumber} and crew from this trip?`)) return;

    try {
      await CharterService.removeAssignmentPayroll(selectedTrip.id, assignment.id, 'driver');
      await CharterService.removeAssignmentPayroll(selectedTrip.id, assignment.id, 'attendant');
      const updatedAssignments = (selectedTrip.assignments || []).filter((a) => a.id !== assignment.id);
      await CharterService.updateTrip(selectedTrip.id, { assignments: updatedAssignments }, actorName);
    } catch (err) {
      alert('Error removing assignment: ' + (err as Error).message);
    }
  };

  // Check In Crew
  const handleCheckInCrew = async (assignment: CharterAssignment, role: 'driver' | 'attendant') => {
    if (!selectedTrip) return;
    const timeStr = prompt(
      isFrench ? 'Heure de pointage (HH:MM) :' : 'Check-in Time (HH:MM):',
      new Date().toTimeString().slice(0, 5)
    );
    if (!timeStr) return;

    try {
      await CharterService.checkInCrew(selectedTrip.id, assignment.id, role, timeStr, actorName);
      await logDispatchAction({
        date: selectedTrip.dispatchDate,
        type: 'Charter Crew Check-In',
        detail: `Checked in ${role === 'driver' ? assignment.driverName : assignment.attendantName} for trip ${selectedTrip.tripNumber} at ${timeStr}. Payroll record generated.`,
        user: actorName,
      });
    } catch (err) {
      alert('Check-in error: ' + (err as Error).message);
    }
  };

  // Check Out Crew
  const handleCheckOutCrew = async (assignment: CharterAssignment, role: 'driver' | 'attendant') => {
    if (!selectedTrip) return;
    const timeStr = prompt(
      isFrench ? 'Heure de départ / fin (HH:MM) :' : 'Check-out Time (HH:MM):',
      new Date().toTimeString().slice(0, 5)
    );
    if (!timeStr) return;

    const comments = prompt(
      isFrench ? 'Commentaires sur la paie (optionnel) :' : 'Payroll Comments (optional):',
      ''
    );

    try {
      await CharterService.checkOutCrew(
        selectedTrip.id,
        assignment.id,
        role,
        timeStr,
        comments || undefined,
        actorName
      );
      await logDispatchAction({
        date: selectedTrip.dispatchDate,
        type: 'Charter Crew Check-Out',
        detail: `Checked out ${role === 'driver' ? assignment.driverName : assignment.attendantName} for trip ${selectedTrip.tripNumber} at ${timeStr}.`,
        user: actorName,
      });
    } catch (err) {
      alert('Check-out error: ' + (err as Error).message);
    }
  };

  // Undo Check-in
  const handleUndoCheckIn = async (assignment: CharterAssignment, role: 'driver' | 'attendant') => {
    if (!selectedTrip) return;
    if (!window.confirm(isFrench ? 'Annuler le pointage de ce membre d\'équipage ?' : 'Undo check-in for this crew member?')) return;

    try {
      await CharterService.undoCrewCheckIn(selectedTrip.id, assignment.id, role, actorName);
      await logDispatchAction({
        date: selectedTrip.dispatchDate,
        type: 'Charter Check-In Undone',
        detail: `Undid check-in for ${role} on trip ${selectedTrip.tripNumber}. Payroll record removed.`,
        user: actorName,
      });
    } catch (err) {
      alert('Error undoing check-in: ' + (err as Error).message);
    }
  };

  // Update per-shift stop arrival / departure time
  const handleUpdateShiftStopTime = async (
    assignment: CharterAssignment,
    stop: CharterStop,
    field: 'arrivedAt' | 'departedAt'
  ) => {
    if (!selectedTrip) return;
    const currentVal = field === 'arrivedAt' ? stop.arrivedAt : stop.departedAt;
    const defaultTime = currentVal || new Date().toTimeString().slice(0, 5);
    const labelStr =
      field === 'arrivedAt'
        ? isFrench
          ? 'Heure d\'arrivée à l\'arrêt (HH:MM, vide pour effacer) :'
          : 'Stop Arrival Time (HH:MM, leave blank to clear):'
        : isFrench
        ? 'Heure de départ de l\'arrêt (HH:MM, vide pour effacer) :'
        : 'Stop Departure Time (HH:MM, leave blank to clear):';

    const inputTime = prompt(labelStr, defaultTime);
    if (inputTime === null) return;

    const trimmed = inputTime.trim();
    try {
      await CharterService.updateAssignmentStopTime(
        selectedTrip.id,
        assignment.id,
        stop.id,
        { [field]: trimmed || undefined },
        actorName
      );
    } catch (err) {
      alert('Failed to update stop time: ' + (err as Error).message);
    }
  };

  // Helper to resolve default HH:MM for a charter stop
  const resolveDefaultStopTime = (trip: CharterTrip, stop: CharterStop, idx: number, existingOp?: RouteOpening): string => {
    const fromExistingOp = existingOp?.sanitizedStops?.find(
      (ss) => String(ss.stopId) === String(stop.id) || ss.sequence === (stop.sequenceOrder || idx + 1)
    )?.stopScheduleTime;
    if (fromExistingOp && formatCharterStopTime(fromExistingOp)) {
      return formatCharterStopTime(fromExistingOp);
    }
    const fromStop = formatCharterStopTime(stop.scheduledAt);
    if (fromStop) return fromStop;

    const depTime = formatCharterStopTime(trip.departsAt) || '08:00';
    const retTime = formatCharterStopTime(trip.returnsAt) || '15:00';
    if (idx === 0 || stop.stopType === 0) return depTime;
    if (idx === 1 || stop.stopType === 1) return addMinutesToCharterTime(depTime, 30);
    if (idx === 2 || stop.stopType === 3) return retTime;
    if (idx === 3 || stop.stopType === 2) return addMinutesToCharterTime(retTime, 30);
    return depTime;
  };

  // Update a stop's scheduled time or address in the master trip and assignments
  const handleUpdateStopScheduledTime = async (stop: CharterStop, idx: number) => {
    if (!selectedTrip) return;
    const existingOp = charterOpeningsByTripId[selectedTrip.id];
    const normalizedStops = normalizeCharterTripStops(selectedTrip, existingOp);
    const currentFormatted = resolveDefaultStopTime(selectedTrip, stop, idx, existingOp);
    const input = prompt(
      isFrench ? 'Heure prévue à cet arrêt (HH:MM) :' : 'Scheduled Stop Time (HH:MM):',
      currentFormatted
    );
    if (input === null || !input.trim()) return;
    const newTime = formatCharterStopTime(input.trim());
    const newScheduledAt = `${selectedTrip.dispatchDate}T${newTime}`;

    const updatedStops = normalizedStops.map((s, sIdx) =>
      sIdx === idx ? { ...s, scheduledAt: newScheduledAt } : s
    );
    const updatedAssignments = (selectedTrip.assignments || []).map((asg) => ({
      ...asg,
      stops: updatedStops.map((us, sIdx) => {
        const prev = asg.stops?.[sIdx];
        return {
          ...us,
          arrivedAt: prev?.arrivedAt,
          departedAt: prev?.departedAt,
        };
      }),
    }));

    try {
      await CharterService.updateTrip(
        selectedTrip.id,
        { stops: updatedStops, assignments: updatedAssignments },
        actorName
      );
      if (existingOp) {
        const updatedSanitized = updatedStops.map((us, sIdx) => ({
          stopId: us.id || `stop-${sIdx + 1}`,
          sequence: sIdx + 1,
          stopLocation: us.locationName ? `${us.locationName}: ${us.address}` : us.address,
          stopScheduleTime: formatCharterStopTime(us.scheduledAt),
          stopType:
            us.stopType === 0 || us.stopType === 3
              ? 'CharterPickup'
              : us.stopType === 1
              ? 'CharterDestination'
              : 'CharterReturn',
          schoolName: selectedTrip.clientName,
          latitude: us.latitude,
          longitude: us.longitude,
        }));
        await RouteOpeningService.updateOpening(existingOp.id, {
          sanitizedStops: updatedSanitized,
        });
      }
    } catch (err) {
      alert('Failed to update stop scheduled time: ' + (err as Error).message);
    }
  };

  // Open Publish Charter Assignment Open Modal (Bidding Board / Route Openings)
  const handleOpenPublishCharterModal = (trip: CharterTrip, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const existingOp = charterOpeningsByTripId[trip.id];
    setPublishingTrip(trip);
    setPubRoleNeeded(existingOp?.roleNeeded || (trip.needsAttendant ? 'driver_and_attendant' : 'driver'));

    const defaultDeadline = existingOp?.deadline
      ? existingOp.deadline.slice(0, 16)
      : trip.departsAt && trip.departsAt.length >= 16
      ? trip.departsAt.slice(0, 16)
      : `${trip.dispatchDate}T07:00`;
    setPubDeadline(defaultDeadline);

    const initDrvRate = existingOp?.driverPayRate ?? trip.driverPayRate ?? trip.assignments?.[0]?.driverPayRate ?? 150;
    const initAttRate = existingOp?.attendantPayRate ?? trip.attendantPayRate ?? trip.assignments?.[0]?.attendantPayRate ?? 100;
    setPubDriverPayRate(initDrvRate);
    setPubAttendantPayRate(initAttRate);

    const normalized = normalizeCharterTripStops(trip, existingOp);
    setPubStops(normalized);

    const initialTimes: Record<string, string> = {};
    normalized.forEach((s, idx) => {
      const key = s.id || `stop-${idx}`;
      initialTimes[key] = formatCharterStopTime(s.scheduledAt) || resolveDefaultStopTime(trip, s, idx, existingOp);
    });
    setPubStopTimes(initialTimes);

    const defaultComp =
      existingOp?.compensationNote ||
      (trip.needsAttendant
        ? `Driver: $${initDrvRate.toFixed(2)} | Attendant: $${initAttRate.toFixed(2)} (${trip.billableHours || 5}h EI)`
        : `Driver: $${initDrvRate.toFixed(2)} / shift (${trip.billableHours || 5}h EI)`);
    setPubCompensation(defaultComp);

    const pickupAddr = normalized[0]?.address || '';
    const destAddr = normalized[1]?.address || '';
    const defaultDesc =
      existingOp?.description ||
      [
        `Client: ${trip.clientName} (${trip.passengerCount} passengers)`,
        pickupAddr && destAddr ? `Route: ${pickupAddr} -> ${destAddr}` : '',
        trip.notes || '',
      ]
        .filter(Boolean)
        .join(' | ');
    setPubDescription(defaultDesc);
    setPubPostToChat(true);
  };

  const handlePublishCharterOpening = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publishingTrip) return;

    setIsPublishingOpening(true);
    try {
      const drvRateNum = Number(pubDriverPayRate) || 150;
      const attRateNum = Number(pubAttendantPayRate) || 100;

      const baseStops = pubStops.length > 0 ? pubStops : normalizeCharterTripStops(publishingTrip);

      const updatedTripStops: CharterStop[] = baseStops.map((s, idx) => {
        const key = s.id || `stop-${idx}`;
        const stopTime =
          pubStopTimes[key] || formatCharterStopTime(s.scheduledAt) || resolveDefaultStopTime(publishingTrip, s, idx);
        return {
          ...s,
          id: s.id || `ST-${publishingTrip.id}-${idx + 1}`,
          sequenceOrder: idx + 1,
          locationName:
            s.locationName ||
            (s.stopType === 0
              ? 'Pickup'
              : s.stopType === 1
              ? 'Dropoff'
              : s.stopType === 3
              ? 'Return Pickup'
              : 'Return Dropoff'),
          scheduledAt: `${publishingTrip.dispatchDate}T${stopTime}`,
        };
      });

      const firstTime = formatCharterStopTime(updatedTripStops[0]?.scheduledAt) || '08:00';
      const lastTime =
        formatCharterStopTime(updatedTripStops[updatedTripStops.length - 1]?.scheduledAt) || '15:30';

      const allShifts = (publishingTrip.assignments || []).map((a) => ({
        ...a,
        driverPayRate: drvRateNum,
        attendantPayRate: attRateNum,
        stops: updatedTripStops.map((matchingTripStop, idx) => {
          const prevStop = a.stops?.[idx];
          return {
            ...matchingTripStop,
            arrivedAt: prevStop?.arrivedAt,
            departedAt: prevStop?.departedAt,
          };
        }),
      }));
      const totalShifts = Math.max(publishingTrip.vehiclesNeeded || 1, allShifts.length);
      const filledDriverCount = allShifts.filter((a) => Boolean(a.driverId || a.driverName)).length;
      const openShiftsCount = Math.max(1, totalShifts - filledDriverCount);

      const sanitizedStops = updatedTripStops.map((s, idx) => {
        const stopTime = formatCharterStopTime(s.scheduledAt) || firstTime;
        const actionLabel =
          s.stopType === 0
            ? 'Pickup'
            : s.stopType === 1
            ? 'Dropoff'
            : s.stopType === 3
            ? 'Return Pickup'
            : 'Return Dropoff';
        return {
          stopId: s.id || `stop-${idx + 1}`,
          sequence: idx + 1,
          stopLocation: `${actionLabel}: ${s.address}`,
          stopScheduleTime: stopTime,
          stopType:
            s.stopType === 0 || s.stopType === 3
              ? 'CharterPickup'
              : s.stopType === 1
              ? 'CharterDestination'
              : 'CharterReturn',
          schoolName: publishingTrip.clientName,
          latitude: s.latitude,
          longitude: s.longitude,
        };
      });

      const autoCompNote =
        pubCompensation.trim() ||
        (pubRoleNeeded === 'attendant'
          ? `Attendant: $${attRateNum.toFixed(2)} (${publishingTrip.billableHours || 5}h EI)`
          : pubRoleNeeded === 'driver_and_attendant'
          ? `Driver: $${drvRateNum.toFixed(2)} | Attendant: $${attRateNum.toFixed(2)} (${publishingTrip.billableHours || 5}h EI)`
          : `Driver: $${drvRateNum.toFixed(2)} / shift (${publishingTrip.billableHours || 5}h EI)`);

      const createdOpening = await RouteOpeningService.createOpening({
        routeId: publishingTrip.id,
        routeNo: publishingTrip.tripNumber,
        routeName: publishingTrip.title,
        postingType: 'charter',
        roleNeeded: pubRoleNeeded,
        charterTripId: publishingTrip.id,
        charterClientName: publishingTrip.clientName,
        vehiclesNeeded: totalShifts,
        openShiftsCount,
        departsAt: `${publishingTrip.dispatchDate}T${firstTime}`,
        returnsAt: `${publishingTrip.dispatchDate}T${lastTime}`,
        passengerCount: publishingTrip.passengerCount,
        driverPayRate: drvRateNum,
        attendantPayRate: attRateNum,
        sanitizedStops,
        effectiveStartDate: publishingTrip.dispatchDate,
        effectiveEndDate: publishingTrip.returnsAt?.slice(0, 10) || publishingTrip.dispatchDate,
        shiftType: `CHARTER (${firstTime} - ${lastTime})`,
        deadline: pubDeadline,
        compensationNote: autoCompNote,
        description: pubDescription.trim() || undefined,
        requirements: publishingTrip.specialRequirements || undefined,
        postToChat: pubPostToChat,
        createdBy: actorName,
      });

      // Immediately update local state so "Published" status displays right away
      setRouteOpenings((prev) => [
        createdOpening,
        ...prev.filter((o) => o.id !== createdOpening.id),
      ]);

      const nowIso = new Date().toISOString();
      await CharterService.updateTrip(
        publishingTrip.id,
        {
          status: publishingTrip.status === 0 ? 1 : publishingTrip.status,
          driverPayRate: drvRateNum,
          attendantPayRate: attRateNum,
          isPublishedOpen: true,
          publishedOpeningId: createdOpening.id,
          publishedAt: nowIso,
          stops: updatedTripStops,
          assignments: allShifts,
        },
        actorName
      );

      await logDispatchAction({
        date: publishingTrip.dispatchDate,
        type: 'Charter Assignment Open Published',
        detail: `Published Charter Opening for ${publishingTrip.tripNumber} (${publishingTrip.title}) — ${openShiftsCount} shift(s) open`,
        user: actorName,
      });

      setPublishingTrip(null);
    } catch (err) {
      alert('Failed to publish charter opening: ' + (err as Error).message);
    } finally {
      setIsPublishingOpening(false);
    }
  };

  // Open Client Modal
  const handleOpenClientModal = (client?: CharterClient) => {
    setSchoolDropdownOpen(false);
    setSchoolSearchQuery('');
    if (client) {
      setEditingClient(client);
      setClientSchoolId(client.schoolId || null);
      setClientName(client.name);
      setClientContactName(client.contactName || '');
      setClientContactPhone(client.contactPhone || '');
      setClientContactEmail(client.contactEmail || '');
      setClientBillingAddress(client.billingAddress || '');
      setClientNotes(client.notes || '');
      setClientActive(client.active);
    } else {
      setEditingClient(null);
      setClientSchoolId(null);
      setClientName('');
      setClientContactName('');
      setClientContactPhone('');
      setClientContactEmail('');
      setClientBillingAddress('');
      setClientNotes('');
      setClientActive(true);
    }
    setIsClientModalOpen(true);
  };

  // Select school from combobox
  const handleSelectSchool = (sch: School) => {
    setClientSchoolId(sch.schoolId);
    setClientName(sch.schoolName);
    if (sch.contactPerson) setClientContactName(sch.contactPerson);
    if (sch.schoolPhone) setClientContactPhone(sch.schoolPhone);
    if (sch.contactPersonEmail) setClientContactEmail(sch.contactPersonEmail);
    if (sch.schoolAddress) setClientBillingAddress(sch.schoolAddress);
    setSchoolDropdownOpen(false);
    setSchoolSearchQuery('');
  };

  // Clear/unlink school
  const handleClearSchool = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setClientSchoolId(null);
    setSchoolSearchQuery('');
  };

  // Save Client
  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const linkedSchoolName = selectedSchool?.schoolName || (clientSchoolId ? schools.find((s) => s.schoolId === clientSchoolId)?.schoolName : undefined);
      if (editingClient) {
        await CharterService.updateClient(editingClient.id, {
          name: clientName,
          schoolId: clientSchoolId || undefined,
          schoolName: linkedSchoolName,
          contactName: clientContactName,
          contactPhone: clientContactPhone,
          contactEmail: clientContactEmail,
          billingAddress: clientBillingAddress,
          notes: clientNotes,
          active: clientActive,
        });
      } else {
        await CharterService.createClient({
          name: clientName,
          schoolId: clientSchoolId || undefined,
          schoolName: linkedSchoolName,
          contactName: clientContactName,
          contactPhone: clientContactPhone,
          contactEmail: clientContactEmail,
          billingAddress: clientBillingAddress,
          notes: clientNotes,
          active: clientActive,
        });
      }
      setIsClientModalOpen(false);
    } catch (err) {
      alert('Client save error: ' + (err as Error).message);
    }
  };

  // Delete Client
  const handleDeleteClient = async (client: CharterClient) => {
    if (!window.confirm(`Delete client "${client.name}"?`)) return;
    try {
      await CharterService.deleteClient(client.id);
    } catch (err) {
      alert('Delete client error: ' + (err as Error).message);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header & Sub-Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {isFrench ? 'Gestion des nolisés' : 'Charter Trip Management'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isFrench
                ? 'Réservations, affectation de flotte, pointage d\'équipage et intégration de la paie'
                : 'Charter contracts, vehicle allocation, crew check-in and automated payroll'}
            </p>
          </div>
        </div>

        {/* Sub-tab Pills */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setSubTab('trips')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                subTab === 'trips'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {isFrench ? 'Voyages nolisés' : 'Charter Trips'} ({trips.length})
            </button>
            <button
              onClick={() => setSubTab('clients')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                subTab === 'clients'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {isFrench ? 'Clients nolisés' : 'Charter Clients'} ({clients.length})
            </button>
          </div>

          {subTab === 'trips' ? (
            <button
              onClick={handleOpenCreateTrip}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>{isFrench ? 'Nouveau voyage' : 'New Charter Trip'}</span>
            </button>
          ) : (
            <button
              onClick={() => handleOpenClientModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>{isFrench ? 'Nouveau client' : 'New Client'}</span>
            </button>
          )}
        </div>
      </div>

      {subTab === 'trips' ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs text-slate-500 font-medium">{isFrench ? 'Total voyages' : 'Total Trips'}</span>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{kpis.totalTrips}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                {isFrench ? 'Pointage en attente' : 'Pending Check-In'}
              </span>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{kpis.pendingCheckIn}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                {isFrench ? 'Équipage pointé' : 'Crew Checked In'}
              </span>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{kpis.checkedIn}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                {isFrench ? 'Voyages terminés' : 'Completed Trips'}
              </span>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{kpis.completed}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                {isFrench ? 'Revenu total devis' : 'Quoted Revenue'}
              </span>
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                ${kpis.totalQuoted.toFixed(0)}
              </p>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setSelectedDate(addDaysToDateString(selectedDate, -1))}
                  className="p-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1.5 px-2">
                  <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setShowAllDates(false);
                    }}
                    className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-hidden cursor-pointer"
                  />
                </div>
                <button
                  onClick={() => setSelectedDate(addDaysToDateString(selectedDate, 1))}
                  className="p-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer ml-2">
                <input
                  type="checkbox"
                  checked={showAllDates}
                  onChange={(e) => setShowAllDates(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>{isFrench ? 'Tous les jours' : 'All Dates'}</span>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={tripSearch}
                  onChange={(e) => setTripSearch(e.target.value)}
                  placeholder={isFrench ? 'Rechercher voyage, client, chauffeur...' : 'Search trip, client, driver...'}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-hidden"
              >
                <option value="all">{isFrench ? 'Tous les statuts' : 'All Statuses'}</option>
                <option value="0">{isFrench ? 'Brouillon' : 'Draft'}</option>
                <option value="1">{isFrench ? 'Confirmé' : 'Confirmed'}</option>
                <option value="2">{isFrench ? 'Assigné' : 'Assigned'}</option>
                <option value="3">{isFrench ? 'En cours' : 'In Progress'}</option>
                <option value="4">{isFrench ? 'Terminé' : 'Completed'}</option>
                <option value="5">{isFrench ? 'Annulé' : 'Cancelled'}</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-hidden"
              >
                <option value="all">{isFrench ? 'Tous types' : 'All Types'}</option>
                <option value="0">{isFrench ? 'Sortie éducative' : 'Field Trip'}</option>
                <option value="1">{isFrench ? 'Sportif' : 'Athletic'}</option>
                <option value="2">{isFrench ? 'Académique' : 'Academic'}</option>
                <option value="3">{isFrench ? 'Autre' : 'Other'}</option>
              </select>
            </div>
          </div>

          {/* Trips Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/75 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">{isFrench ? 'Voyage & Date' : 'Trip & Date'}</th>
                    <th className="py-3 px-4">{isFrench ? 'Client' : 'Client'}</th>
                    <th className="py-3 px-4">{isFrench ? 'Type & Statut' : 'Type & Status'}</th>
                    <th className="py-3 px-4">{isFrench ? 'Départ / Retour' : 'Schedule'}</th>
                    <th className="py-3 px-4">{isFrench ? 'Équipage & Véhicules' : 'Fleet & Crew'}</th>
                    <th className="py-3 px-4 text-right">{isFrench ? 'Facturation' : 'Quoted'}</th>
                    <th className="py-3 px-4 text-center">{isFrench ? 'Actions' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        {isFrench ? 'Chargement des voyages nolisés...' : 'Loading charter trips...'}
                      </td>
                    </tr>
                  ) : filteredTrips.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        <Compass className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                        <p className="font-semibold">{isFrench ? 'Aucun voyage nolisé trouvé' : 'No charter trips found'}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {isFrench
                            ? 'Cliquez sur "Nouveau voyage" pour créer une réservation nolisée.'
                            : 'Click "New Charter Trip" to create a reservation.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredTrips.map((trip) => {
                      const departsTime = trip.departsAt ? trip.departsAt.replace('T', ' ').slice(11, 16) : '-';
                      const returnsTime = trip.returnsAt ? trip.returnsAt.replace('T', ' ').slice(11, 16) : '-';
                      const allShifts = trip.assignments || [];
                      const totalShifts = Math.max(trip.vehiclesNeeded || 1, allShifts.length);
                      const assignedShifts = allShifts.filter(
                        (a) => Boolean(a.driverId || a.driverName || (a.vehicleId && a.vehicleUnitNumber && a.vehicleUnitNumber !== 'TBD'))
                      );
                      const driverFilledCount = allShifts.filter((a) => Boolean(a.driverId || a.driverName)).length;
                      const openShiftsCount = Math.max(0, totalShifts - assignedShifts.length);

                      return (
                        <tr
                          key={trip.id}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                          onClick={() => setSelectedTrip(trip)}
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              {trip.tripNumber}
                            </div>
                            <div className="font-medium text-slate-900 dark:text-white truncate max-w-[200px]">
                              {trip.title}
                            </div>
                            <div className="text-xs text-slate-400 font-mono">
                              {trip.dispatchDate}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                              {trip.clientName}
                            </div>
                            <div className="text-xs text-slate-400">
                              {trip.passengerCount} {isFrench ? 'passagers' : 'passengers'}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 space-y-1">
                            <div>
                              <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {getCharterTripTypeLabel(trip.tripType, isFrench)}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1">
                              <span
                                className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                                  trip.status === 4
                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                                    : trip.status === 3
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                    : trip.status === 2
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                    : trip.status === 1
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                }`}
                              >
                                {getCharterTripStatusLabel(trip.status, isFrench)}
                              </span>
                            </div>
                            {(() => {
                              const charterOp = charterOpeningsByTripId[trip.id];
                              const isPublished = Boolean(
                                (charterOp && charterOp.status !== 'cancelled') || trip.isPublishedOpen
                              );
                              if (!isPublished) return null;
                              const isAwarded = charterOp?.status === 'awarded';
                              return (
                                <div>
                                  <span
                                    className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                      isAwarded
                                        ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-700'
                                    }`}
                                  >
                                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                                    <span>
                                      {isAwarded
                                        ? isFrench
                                          ? 'Offre attribuée'
                                          : 'Opening Awarded'
                                        : isFrench
                                        ? 'Publié (Open)'
                                        : 'Published (Open)'}
                                    </span>
                                  </span>
                                </div>
                              );
                            })()}
                          </td>

                          <td className="py-3.5 px-4 text-xs font-mono">
                            <div className="text-slate-700 dark:text-slate-300 font-semibold">
                              {isFrench ? 'Dép :' : 'Dep:'} {departsTime}
                            </div>
                            <div className="text-slate-400">
                              {isFrench ? 'Ret :' : 'Ret:'} {returnsTime}
                            </div>
                            {(() => {
                              const charterOp = charterOpeningsByTripId[trip.id];
                              const displayStops = normalizeCharterTripStops(trip, charterOp);
                              if (!displayStops.length) return null;
                              return (
                                <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 space-y-0.5">
                                  {displayStops.map((st, sIdx) => {
                                    const stTime =
                                      formatCharterStopTime(st.scheduledAt) ||
                                      resolveDefaultStopTime(trip, st, sIdx, charterOp);
                                    const isPickup = st.stopType === 0 || st.stopType === 3;
                                    const actionTag = isPickup ? 'Pick' : 'Drop';
                                    return (
                                      <div
                                        key={st.id || sIdx}
                                        className="flex items-center justify-between gap-2 text-[10px] text-slate-600 dark:text-slate-300"
                                        title={`#${sIdx + 1} ${actionTag}: ${st.address} @ ${stTime}`}
                                      >
                                        <span className="truncate max-w-[125px] font-sans">
                                          <span
                                            className={`font-bold ${
                                              isPickup
                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                : 'text-amber-600 dark:text-amber-400'
                                            }`}
                                          >
                                            {actionTag}
                                          </span>{' '}
                                          {st.address}
                                        </span>
                                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                                          {stTime || '--:--'}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  driverFilledCount >= totalShifts
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
                                    : assignedShifts.length > 0
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300'
                                    : 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300'
                                }`}
                              >
                                {driverFilledCount} / {totalShifts} {isFrench ? 'quarts assignés' : 'shifts assigned'}
                              </span>
                            </div>
                            {assignedShifts.length === 0 ? (
                              <span className="text-xs text-amber-500 font-semibold">
                                {totalShifts} {isFrench ? 'quarts ouverts (non assignés)' : 'open shifts (unassigned)'}
                              </span>
                            ) : (
                              <div className="space-y-1">
                                {assignedShifts.slice(0, 4).map((asg, sIdx) => (
                                  <div key={asg.id} className="text-xs flex items-center gap-1.5">
                                    <span className="text-[10px] font-mono px-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                                      #{asg.runNumber || sIdx + 1}
                                    </span>
                                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                                      {asg.vehicleUnitNumber || 'TBD'}
                                    </span>
                                    <span className="text-slate-400">•</span>
                                    <span className="text-slate-800 dark:text-slate-200">
                                      {asg.driverName || (isFrench ? 'Chauffeur à assigner' : 'Driver TBD')}
                                    </span>
                                    {asg.isDriverCheckedIn && (
                                      <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                        {isFrench ? 'Pointé' : 'Checked In'}
                                      </span>
                                    )}
                                  </div>
                                ))}
                                {assignedShifts.length > 4 && (
                                  <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                                    +{assignedShifts.length - 4} {isFrench ? 'autres assignés' : 'more assigned'}
                                  </div>
                                )}
                                {openShiftsCount > 0 && (
                                  <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                                    +{openShiftsCount} {isFrench ? 'quarts ouverts' : 'open shift(s)'}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              ${(trip.quotedAmount || 0).toFixed(2)}
                            </div>
                            <div className="text-xs text-slate-400">
                              {trip.billableHours || 0} hrs
                            </div>
                            <div className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
                              {isFrench ? 'Chauff:' : 'Drv:'} ${(trip.driverPayRate ?? trip.assignments?.[0]?.driverPayRate ?? 150).toFixed(0)}
                              {(trip.needsAttendant || trip.attendantPayRate) && (
                                <span>
                                  {' • '}
                                  {isFrench ? 'Acc:' : 'Att:'} ${(trip.attendantPayRate ?? trip.assignments?.[0]?.attendantPayRate ?? 100).toFixed(0)}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                            {(() => {
                              const charterOp = charterOpeningsByTripId[trip.id];
                              const isPublished = Boolean(
                                (charterOp && charterOp.status !== 'cancelled') || trip.isPublishedOpen
                              );
                              const applicantCount = charterOp?.applicants?.filter((a) => a.status !== 'withdrawn').length || 0;
                              return (
                                <div className="flex flex-col items-center gap-1.5">
                                  <div className="flex items-center justify-center gap-1 flex-wrap">
                                    <button
                                      onClick={(e) => handleOpenPublishCharterModal(trip, e)}
                                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                        isPublished
                                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-2xs'
                                          : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/60'
                                      }`}
                                      title={
                                        isPublished
                                          ? isFrench
                                            ? 'Déjà publié dans Route Openings — Cliquer pour modifier'
                                            : 'Already Published to Route Openings — Click to update'
                                          : isFrench
                                          ? 'Publier l\'offre aux chauffeurs (Route Openings)'
                                          : 'Publish Assignment Open to Driver App (Route Openings)'
                                      }
                                    >
                                      {isPublished ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                      ) : (
                                        <Megaphone className="w-3 h-3 shrink-0" />
                                      )}
                                      <span>
                                        {isPublished
                                          ? isFrench
                                            ? 'Publié ✓'
                                            : 'Published ✓'
                                          : isFrench
                                          ? 'Publier Open'
                                          : 'Publish Open'}
                                      </span>
                                    </button>
                                    {(charterOp || isPublished) && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (charterOp) {
                                            setReviewingCharterOpening(charterOp);
                                          } else {
                                            handleOpenPublishCharterModal(trip, e);
                                          }
                                        }}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-950/70 dark:text-purple-300 transition-all"
                                        title={isFrench ? 'Voir les candidats' : 'Review Applicants'}
                                      >
                                        <Users className="w-3 h-3" />
                                        <span>{applicantCount}</span>
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => setSelectedTrip(trip)}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                                      title={isFrench ? 'Détails & affectation' : 'Details & Crew'}
                                    >
                                      <ArrowRight className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleOpenEditTrip(trip)}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                                      title={isFrench ? 'Modifier' : 'Edit'}
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteTrip(trip)}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all"
                                      title={isFrench ? 'Supprimer' : 'Delete'}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Clients Sub-Tab */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="relative min-w-[260px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder={isFrench ? 'Rechercher client, contact, téléphone...' : 'Search client, contact, phone...'}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClients.map((client) => (
              <div
                key={client.id}
                className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">{client.name}</h3>
                    {client.contactName && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                        <Users className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{client.contactName}</span>
                      </p>
                    )}
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      client.active
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {client.active ? (isFrench ? 'Actif' : 'Active') : (isFrench ? 'Inactif' : 'Inactive')}
                  </span>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 pt-1">
                  {client.contactPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{client.contactPhone}</span>
                    </div>
                  )}
                  {client.contactEmail && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>{client.contactEmail}</span>
                    </div>
                  )}
                  {client.billingAddress && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{client.billingAddress}</span>
                    </div>
                  )}
                </div>

                {client.notes && (
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-500">
                    {client.notes}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-400">
                    {client.tripCount || 0} {isFrench ? 'voyages' : 'trips'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenClientModal(client)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteClient(client)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TRIP DETAIL & ASSIGNMENTS DRAWER */}
      {selectedTrip && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-lg text-indigo-600 dark:text-indigo-400">
                    {selectedTrip.tripNumber}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                    {getCharterTripTypeLabel(selectedTrip.tripType, isFrench)}
                  </span>
                  {(Boolean(
                    charterOpeningsByTripId[selectedTrip.id] &&
                      charterOpeningsByTripId[selectedTrip.id].status !== 'cancelled'
                  ) ||
                    selectedTrip.isPublishedOpen) && (
                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>
                        {charterOpeningsByTripId[selectedTrip.id]?.status === 'awarded'
                          ? isFrench
                            ? 'Offre attribuée'
                            : 'Opening Awarded'
                          : isFrench
                          ? 'Publié dans Route Openings'
                          : 'Published to Route Openings'}
                      </span>
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                  {selectedTrip.title}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{selectedTrip.clientName}</p>
              </div>

              <button
                onClick={() => setSelectedTrip(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Status Action Pills */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    {isFrench ? 'Statut du voyage :' : 'Trip Status:'}
                  </span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    {getCharterTripStatusLabel(selectedTrip.status, isFrench)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <button
                    onClick={() => handleUpdateTripStatus(selectedTrip, 1)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 transition-all"
                  >
                    {isFrench ? 'Confirmer' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => handleUpdateTripStatus(selectedTrip, 3)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-950 dark:text-amber-300 transition-all"
                  >
                    {isFrench ? 'En cours' : 'In Progress'}
                  </button>
                  <button
                    onClick={() => handleUpdateTripStatus(selectedTrip, 4)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-950 dark:text-purple-300 transition-all"
                  >
                    {isFrench ? 'Terminé' : 'Complete'}
                  </button>
                  <button
                    onClick={() => handleUpdateTripStatus(selectedTrip, 5)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-100 hover:bg-rose-200 text-rose-800 dark:bg-rose-950 dark:text-rose-300 transition-all"
                  >
                    {isFrench ? 'Annuler' : 'Cancel'}
                  </button>
                </div>
              </div>

              {/* Trip Schedule & Pricing */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400 uppercase font-bold">{isFrench ? 'Date & Heure' : 'Schedule'}</span>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {selectedTrip.departsAt?.replace('T', ' ')}
                  </p>
                  <p className="text-xs text-slate-500 font-mono">
                    {isFrench ? 'Retour :' : 'Returns:'} {selectedTrip.returnsAt?.replace('T', ' ')}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400 uppercase font-bold">{isFrench ? 'Facturation & Taux de paie' : 'Pricing & Payroll Rates'}</span>
                  <p className="text-base font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    ${(selectedTrip.quotedAmount || 0).toFixed(2)}{' '}
                    <span className="text-xs font-normal text-slate-500">
                      ({selectedTrip.billableHours || 0} {isFrench ? 'h fact.' : 'hrs'})
                    </span>
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs font-mono">
                    <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold">
                      {isFrench ? 'Chauffeur :' : 'Driver:'} ${(selectedTrip.driverPayRate ?? selectedTrip.assignments?.[0]?.driverPayRate ?? 150).toFixed(2)}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold">
                      {isFrench ? 'Accomp. :' : 'Attendant:'} ${(selectedTrip.attendantPayRate ?? selectedTrip.assignments?.[0]?.attendantPayRate ?? 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stops Itinerary */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {isFrench ? 'Itinéraire et horaires des arrêts' : 'Route Stops & Time Schedule'}
                  </h4>
                  <span className="text-[10px] text-slate-400">
                    {isFrench ? 'Cliquer sur l\'heure pour modifier' : 'Click time to edit schedule'}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                  {normalizeCharterTripStops(selectedTrip, charterOpeningsByTripId[selectedTrip.id]).map((stop, idx) => {
                    const existingOp = charterOpeningsByTripId[selectedTrip.id];
                    const scheduledTimeStr =
                      formatCharterStopTime(stop.scheduledAt) ||
                      resolveDefaultStopTime(selectedTrip, stop, idx, existingOp);
                    const isPickup = stop.stopType === 0 || stop.stopType === 3;
                    const stopTitle =
                      stop.locationName ||
                      (stop.stopType === 0
                        ? 'Pickup'
                        : stop.stopType === 1
                        ? 'Dropoff'
                        : stop.stopType === 3
                        ? 'Return Pickup'
                        : 'Return Dropoff');
                    return (
                      <div key={stop.id || idx} className="py-2.5 flex items-start justify-between gap-2.5 first:pt-0 last:pb-0">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                  isPickup
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300'
                                }`}
                              >
                                {isPickup ? 'Pick Up' : 'Drop Off'}
                              </span>
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                {stopTitle}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 break-words mt-0.5">{stop.address}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUpdateStopScheduledTime(stop, idx)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/70 dark:hover:bg-indigo-900/70 border border-indigo-200/70 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-mono text-xs font-bold shrink-0 transition-colors"
                          title={isFrench ? 'Modifier l\'heure prévue à cet arrêt' : 'Edit scheduled stop time'}
                        >
                          <Clock className="w-3 h-3 text-indigo-500" />
                          <span>{scheduledTimeStr || '--:--'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Assignments & Crew Check-In Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <span>{isFrench ? 'Quarts, Véhicules & Équipage' : 'Shifts, Vehicles & Crew'}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          (selectedTrip.assignments || []).filter((a) => Boolean(a.driverId || a.driverName)).length >=
                          Math.max(selectedTrip.vehiclesNeeded || 1, selectedTrip.assignments?.length || 0)
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300'
                        }`}
                      >
                        {(selectedTrip.assignments || []).filter((a) => Boolean(a.driverId || a.driverName)).length} /{' '}
                        {Math.max(selectedTrip.vehiclesNeeded || 1, selectedTrip.assignments?.length || 0)}{' '}
                        {isFrench ? 'quarts assignés' : 'shifts assigned'}
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {isFrench
                        ? 'Chaque quart suit son propre pointage (Check-in/out) et les heures d\'arrêt.'
                        : 'Each shift tracks its own crew check-in/out and stop arrival/departure times.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(() => {
                      const drawerOp = charterOpeningsByTripId[selectedTrip.id];
                      const isDrawerPublished = Boolean(
                        (drawerOp && drawerOp.status !== 'cancelled') || selectedTrip.isPublishedOpen
                      );
                      return (
                        <button
                          onClick={(e) => handleOpenPublishCharterModal(selectedTrip, e)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-all ${
                            isDrawerPublished
                              ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          }`}
                        >
                          {isDrawerPublished ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Megaphone className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {isDrawerPublished
                              ? isFrench
                                ? 'Publié ✓ (Modifier l\'offre)'
                                : 'Published ✓ (Edit Opening)'
                              : isFrench
                              ? 'Publier offre (Open)'
                              : 'Publish Assignment Open'}
                          </span>
                        </button>
                      );
                    })()}
                    {charterOpeningsByTripId[selectedTrip.id] && (
                      <button
                        onClick={() =>
                          setReviewingCharterOpening(charterOpeningsByTripId[selectedTrip.id])
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition-all"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>
                          {isFrench ? 'Candidats' : 'Applicants'} (
                          {charterOpeningsByTripId[selectedTrip.id].applicants?.filter(
                            (a) => a.status !== 'withdrawn'
                          ).length || 0}
                          )
                        </span>
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenAssignmentModal()}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isFrench ? 'Ajouter quart' : 'Add Shift'}</span>
                    </button>
                  </div>
                </div>

                {(!selectedTrip.assignments || selectedTrip.assignments.length === 0) ? (
                  <div className="p-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-slate-500">
                    <Truck className="w-8 h-8 mx-auto text-slate-400 mb-1" />
                    <p className="text-xs font-semibold">{isFrench ? 'Aucun véhicule assigné' : 'No shifts / vehicles assigned yet'}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {isFrench
                        ? 'Assignez un autobus et un chauffeur pour démarrer le voyage.'
                        : 'Assign a bus and driver to dispatch this trip.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedTrip.assignments.map((asg, idx) => {
                      const shiftNum = asg.runNumber || idx + 1;
                      const shiftStops =
                        asg.stops && asg.stops.length > 0 ? asg.stops : selectedTrip.stops || [];
                      const hasDriver = Boolean(asg.driverId || asg.driverName);
                      const hasVehicle = Boolean(asg.vehicleId && asg.vehicleUnitNumber && asg.vehicleUnitNumber !== 'TBD');

                      return (
                        <div
                          key={asg.id}
                          className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3"
                        >
                          {/* Vehicle & Assignment Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300">
                                {isFrench ? `Quart #${shiftNum}` : `Shift #${shiftNum}`}
                              </span>
                              <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                                {hasVehicle
                                  ? `Unit ${asg.vehicleUnitNumber}`
                                  : isFrench
                                  ? 'Véhicule à assigner (TBD)'
                                  : 'Vehicle TBD'}
                              </span>
                              {hasVehicle && asg.plateNumber && (
                                <span className="text-[11px] text-slate-400 font-mono">
                                  ({asg.plateNumber})
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleOpenAssignmentModal(asg)}
                                className="px-2 py-1 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 flex items-center gap-1"
                                title={isFrench ? 'Assigner / Modifier' : 'Assign / Edit Crew & Vehicle'}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>{isFrench ? 'Assigner' : 'Assign'}</span>
                              </button>
                              <button
                                onClick={() => handleDeleteAssignment(asg)}
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                title={isFrench ? 'Supprimer' : 'Delete'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Driver Card & Check-in Controls */}
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                                  {isFrench ? 'Chauffeur' : 'Driver'}
                                </span>
                                {hasDriver ? (
                                  <span className="font-semibold text-slate-900 dark:text-white text-xs">
                                    {asg.driverName}
                                  </span>
                                ) : (
                                  <span className="text-xs italic text-amber-600 dark:text-amber-400 font-medium">
                                    {isFrench ? 'Quart ouvert — Aucun chauffeur' : 'Open Shift — Unassigned'}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                ${asg.driverPayRate?.toFixed(2)} • {asg.driverEiHours}h EI
                                {asg.isDriverCheckedIn && ` • In: ${asg.driverCheckedInAt || '-'}`}
                                {asg.isDriverCheckedOut && ` • Out: ${asg.driverCheckedOutAt || '-'}`}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {!hasDriver ? (
                                <button
                                  onClick={() => handleOpenAssignmentModal(asg)}
                                  className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all"
                                >
                                  {isFrench ? 'Assigner chauffeur' : 'Assign Driver'}
                                </button>
                              ) : !asg.isDriverCheckedIn ? (
                                <button
                                  onClick={() => handleCheckInCrew(asg, 'driver')}
                                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all"
                                >
                                  {isFrench ? 'Pointage (In)' : 'Check In'}
                                </button>
                              ) : !asg.isDriverCheckedOut ? (
                                <>
                                  <button
                                    onClick={() => handleCheckOutCrew(asg, 'driver')}
                                    className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition-all"
                                  >
                                    {isFrench ? 'Départ (Out)' : 'Check Out'}
                                  </button>
                                  <button
                                    onClick={() => handleUndoCheckIn(asg, 'driver')}
                                    className="p-1 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                                    title="Undo check-in"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>{isFrench ? 'Complété' : 'Completed'}</span>
                                  </span>
                                  <button
                                    onClick={() => handleUndoCheckIn(asg, 'driver')}
                                    className="p-1 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 ml-1"
                                    title="Revert check-out"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Attendant Card & Check-in Controls (if assigned) */}
                          {asg.attendantName && (
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                    {isFrench ? 'Accompagnateur' : 'Attendant'}
                                  </span>
                                  <span className="font-semibold text-slate-900 dark:text-white text-xs">
                                    {asg.attendantName}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                  ${asg.attendantPayRate?.toFixed(2)} • {asg.attendantEiHours}h EI
                                  {asg.isAttendantCheckedIn && ` • In: ${asg.attendantCheckedInAt || '-'}`}
                                  {asg.isAttendantCheckedOut && ` • Out: ${asg.attendantCheckedOutAt || '-'}`}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                {!asg.isAttendantCheckedIn ? (
                                  <button
                                    onClick={() => handleCheckInCrew(asg, 'attendant')}
                                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all"
                                  >
                                    {isFrench ? 'Pointage (In)' : 'Check In'}
                                  </button>
                                ) : !asg.isAttendantCheckedOut ? (
                                  <>
                                    <button
                                      onClick={() => handleCheckOutCrew(asg, 'attendant')}
                                      className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition-all"
                                    >
                                      {isFrench ? 'Départ (Out)' : 'Check Out'}
                                    </button>
                                    <button
                                      onClick={() => handleUndoCheckIn(asg, 'attendant')}
                                      className="p-1 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                                      title="Undo check-in"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>{isFrench ? 'Complété' : 'Completed'}</span>
                                    </span>
                                    <button
                                      onClick={() => handleUndoCheckIn(asg, 'attendant')}
                                      className="p-1 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 ml-1"
                                      title="Revert check-out"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Per-Shift Stop Arrival & Departure Times */}
                          {shiftStops.length > 0 && (
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                {isFrench ? 'Heures aux arrêts (Ce quart)' : 'Stop Times (This Shift)'}
                              </div>
                              <div className="space-y-1.5">
                                {shiftStops.map((stop, sIdx) => {
                                  const stopLabel =
                                    stop.locationName ||
                                    (stop.stopType === 0
                                      ? isFrench
                                        ? 'Prise en charge'
                                        : 'Pickup'
                                      : stop.stopType === 1
                                      ? 'Destination'
                                      : isFrench
                                      ? 'Retour'
                                      : 'Return');
                                  return (
                                    <div
                                      key={`${asg.id}-${stop.id || sIdx}`}
                                      className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 text-xs"
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                        <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                                          {sIdx + 1}
                                        </span>
                                        <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                                          {stopLabel}:
                                        </span>
                                        <span className="text-slate-500 truncate">{stop.address}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0 font-mono text-[11px]">
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateShiftStopTime(asg, stop, 'arrivedAt')}
                                          className={`px-2 py-0.5 rounded border transition-colors ${
                                            stop.arrivedAt
                                              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-bold'
                                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-indigo-400'
                                          }`}
                                          title={isFrench ? 'Cliquer pour noter/modifier l\'arrivée' : 'Click to record/edit arrival time'}
                                        >
                                          Arr: {stop.arrivedAt || '--:--'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateShiftStopTime(asg, stop, 'departedAt')}
                                          className={`px-2 py-0.5 rounded border transition-colors ${
                                            stop.departedAt
                                              ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold'
                                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-indigo-400'
                                          }`}
                                          title={isFrench ? 'Cliquer pour noter/modifier le départ' : 'Click to record/edit departure time'}
                                        >
                                          Dep: {stop.departedAt || '--:--'}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              {onNavigateToPayroll && (
                <button
                  onClick={onNavigateToPayroll}
                  className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                >
                  <span>{isFrench ? 'Voir dans la paie de répartition' : 'View in Dispatch Payroll'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setSelectedTrip(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
              >
                {isFrench ? 'Fermer' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT TRIP MODAL */}
      {isTripModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingTripId
                  ? isFrench ? 'Modifier le voyage nolisé' : 'Edit Charter Trip'
                  : isFrench ? 'Nouveau voyage nolisé' : 'New Charter Trip'}
              </h3>
              <button
                onClick={() => setIsTripModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTrip} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {isFrench ? 'Client nolisé *' : 'Charter Client *'}
                  </label>
                  <select
                    required
                    value={formClientId}
                    onChange={(e) => setFormClientId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {isFrench ? 'Type de voyage' : 'Trip Type'}
                  </label>
                  <select
                    value={formTripType}
                    onChange={(e) => setFormTripType(Number(e.target.value) as CharterTripType)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  >
                    <option value={0}>{isFrench ? 'Sortie éducative' : 'Field Trip'}</option>
                    <option value={1}>{isFrench ? 'Sportif' : 'Athletic'}</option>
                    <option value={2}>{isFrench ? 'Académique' : 'Academic'}</option>
                    <option value={3}>{isFrench ? 'Autre' : 'Other'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isFrench ? 'Titre du voyage / Objet *' : 'Trip Title / Description *'}
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Science Center Field Trip - Grade 7"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {isFrench ? 'Date et heure de départ *' : 'Departure Date & Time *'}
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formDepartsAt}
                    onChange={(e) => handleDepartureTimeChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {isFrench ? 'Date et heure de retour *' : 'Return Date & Time *'}
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formReturnsAt}
                    onChange={(e) => setFormReturnsAt(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* Stop Schedule & Itinerary Editor (e.g. #1 Pickup School 08:00, #2 Dropoff Museum 08:30, #3 Return Pickup Library 15:00, #4 Return Dropoff School 15:30) */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                      {isFrench ? 'Itinéraire et horaires des arrêts (Stops)' : 'Stop Schedule & Itinerary'}
                    </label>
                    <p className="text-[10px] text-slate-500">
                      {isFrench
                        ? 'Ex: 08:00 Prise en charge École → 08:30 Musée → 15:00 Bibliothèque → 15:30 École'
                        : 'e.g. 08:00 Pickup at School → 08:30 Dropoff at Museum → 15:00 Pickup at Library → 15:30 Dropoff at School'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const datePart = formDepartsAt.slice(0, 10) || getLocalTodayString();
                      const lastStop = formStops[formStops.length - 1];
                      const nextTime = addMinutesToCharterTime(
                        formatCharterStopTime(lastStop?.scheduledAt) || '15:00',
                        30
                      );
                      const nextIsPickup = formStops.length % 2 === 0;
                      setFormStops((prev) => [
                        ...prev,
                        {
                          id: `ST-new-${prev.length + 1}-${Date.now()}`,
                          sequenceOrder: prev.length + 1,
                          stopType: (nextIsPickup ? 3 : 2) as CharterStopType,
                          locationName: nextIsPickup ? 'Return Pickup' : 'Return Dropoff',
                          address: '',
                          scheduledAt: `${datePart}T${nextTime}`,
                        },
                      ]);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold shadow-2xs"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{isFrench ? 'Ajouter arrêt' : 'Add Stop'}</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {formStops.map((st, idx) => {
                    const timeVal = formatCharterStopTime(st.scheduledAt) || '08:00';
                    const datePart = formDepartsAt.slice(0, 10) || getLocalTodayString();
                    return (
                      <div
                        key={st.id || idx}
                        className="flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <select
                            value={st.stopType}
                            onChange={(e) => {
                              const newType = Number(e.target.value) as CharterStopType;
                              const newLabel =
                                newType === 0
                                  ? 'Pickup'
                                  : newType === 1
                                  ? 'Dropoff'
                                  : newType === 3
                                  ? 'Return Pickup'
                                  : 'Return Dropoff';
                              setFormStops((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, stopType: newType, locationName: newLabel } : item
                                )
                              );
                            }}
                            className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border shrink-0 ${
                              st.stopType === 0 || st.stopType === 3
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                            }`}
                          >
                            <option value={0}>{isFrench ? 'Prise en charge (Pick Up)' : 'Pick Up (Outbound)'}</option>
                            <option value={1}>{isFrench ? 'Arrivée / Débarq. (Drop Off)' : 'Drop Off (Destination)'}</option>
                            <option value={3}>{isFrench ? 'Prise en charge retour (Pick Up)' : 'Pick Up (Return)'}</option>
                            <option value={2}>{isFrench ? 'Débarquement retour (Drop Off)' : 'Drop Off (Return)'}</option>
                          </select>
                          <input
                            type="text"
                            required
                            value={st.address}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (idx === 0) setFormFromAddress(val);
                              if (idx === 1) setFormToAddress(val);
                              setFormStops((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, address: val } : item))
                              );
                            }}
                            placeholder={
                              idx === 0
                                ? 'e.g. School'
                                : idx === 1
                                ? 'e.g. Museum'
                                : idx === 2
                                ? 'e.g. Library'
                                : 'e.g. School'
                            }
                            className="flex-1 min-w-0 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Clock className="w-3.5 h-3.5 text-indigo-500" />
                          <input
                            type="time"
                            required
                            value={timeVal}
                            onChange={(e) => {
                              const newT = e.target.value;
                              if (idx === 0 && newT) {
                                setFormDepartsAt(`${datePart}T${newT}`);
                              }
                              if (idx === formStops.length - 1 && newT) {
                                setFormReturnsAt(`${datePart}T${newT}`);
                              }
                              setFormStops((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, scheduledAt: `${datePart}T${newT}` } : item
                                )
                              );
                            }}
                            className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400"
                          />
                          {formStops.length > 2 && (
                            <button
                              type="button"
                              onClick={() =>
                                setFormStops((prev) =>
                                  prev
                                    .filter((_, i) => i !== idx)
                                    .map((item, i) => ({ ...item, sequenceOrder: i + 1 }))
                                )
                              }
                              className="p-1 text-slate-400 hover:text-rose-500 rounded-lg"
                              title={isFrench ? 'Supprimer cet arrêt' : 'Remove stop'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {isFrench ? 'Nb passagers' : 'Passengers'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formPassengerCount}
                    onChange={(e) => setFormPassengerCount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {isFrench ? 'Véhicules requis' : 'Buses Needed'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={formVehiclesNeeded}
                    onChange={(e) => setFormVehiclesNeeded(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {isFrench ? 'Montant devis ($)' : 'Quoted Rate ($)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formQuotedAmount}
                    onChange={(e) => setFormQuotedAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {isFrench ? 'Heures facturables' : 'Billable Hours'}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={formBillableHours}
                    onChange={(e) => setFormBillableHours(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              {/* Crew Payroll Rates (Shown to crew in Driver App after Check-In) */}
              <div className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                    {isFrench ? 'Taux de paie de l\'équipage (Par quart)' : 'Crew Payroll Rates (Per Shift)'}
                  </span>
                  <span className="text-[10px] text-indigo-600/80 dark:text-indigo-400/80">
                    {isFrench ? 'Visible par le chauffeur/accompagnateur après le pointage' : 'Visible to driver/attendant after Check-In'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {isFrench ? 'Taux de paie Chauffeur ($)' : 'Driver Payroll Rate ($)'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      required
                      value={formDriverPayRate}
                      onChange={(e) => setFormDriverPayRate(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-blue-700 dark:text-blue-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {isFrench ? 'Taux de paie Accompagnateur ($)' : 'Attendant Payroll Rate ($)'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      required
                      value={formAttendantPayRate}
                      onChange={(e) => setFormAttendantPayRate(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formRoundTrip}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFormRoundTrip(checked);
                      const datePart = formDepartsAt.slice(0, 10) || getLocalTodayString();
                      const retTime = formatCharterStopTime(formReturnsAt) || '15:00';
                      if (!checked && formStops.length > 2) {
                        setFormStops((prev) => prev.slice(0, 2));
                      } else if (checked && formStops.length < 4) {
                        const firstAddr = formStops[0]?.address || 'School';
                        const secondAddr = formStops[1]?.address || 'Library';
                        setFormStops((prev) => [
                          ...prev.slice(0, 2),
                          {
                            id: `ST-new-3-${Date.now()}`,
                            sequenceOrder: 3,
                            stopType: 3,
                            locationName: 'Return Pickup',
                            address: secondAddr,
                            scheduledAt: `${datePart}T${retTime}`,
                          },
                          {
                            id: `ST-new-4-${Date.now()}`,
                            sequenceOrder: 4,
                            stopType: 2,
                            locationName: 'Return Dropoff',
                            address: firstAddr,
                            scheduledAt: `${datePart}T${addMinutesToCharterTime(retTime, 30)}`,
                          },
                        ]);
                      }
                    }}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{isFrench ? 'Aller-retour' : 'Round Trip'}</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formNeedsAttendant}
                    onChange={(e) => setFormNeedsAttendant(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{isFrench ? 'Nécessite accompagnateur' : 'Needs Attendant'}</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isFrench ? 'Notes / Consignes particulières' : 'Special Instructions / Notes'}
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Gate instructions, parking contact, special luggage..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTripModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {isFrench ? 'Annuler' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs"
                >
                  {isFrench ? 'Enregistrer le voyage' : 'Save Trip'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGNMENT MODAL (Vehicle & Crew) */}
      {isAssignmentModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingAssignment
                  ? isFrench ? 'Modifier l\'affectation (Équipage)' : 'Edit Crew Assignment'
                  : isFrench ? 'Assigner un véhicule et chauffeur' : 'Assign Vehicle & Crew'}
              </h3>
              <button
                onClick={() => setIsAssignmentModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAssignment} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isFrench ? 'Sélectionner le véhicule' : 'Select Vehicle'}
                </label>
                <select
                  value={asgVehicleId}
                  onChange={(e) => {
                    const vId = Number(e.target.value);
                    if (!vId) {
                      setAsgVehicleId(0);
                      setAsgUnitNumber('TBD');
                      setAsgPlateNumber('');
                    } else {
                      const veh = vehicles.find((v) => v.vehicleId === vId);
                      setAsgVehicleId(vId);
                      setAsgUnitNumber(veh?.unitNumber || `UNIT-${vId}`);
                      setAsgPlateNumber(veh?.plateNumber || '');
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                >
                  <option value={0}>
                    {isFrench ? '-- À assigner (TBD) --' : '-- TBD / Unassigned Vehicle --'}
                  </option>
                  {vehicles.map((v) => (
                    <option key={v.vehicleId} value={v.vehicleId}>
                      Unit {v.unitNumber} - {v.manufacturer} {v.model} ({v.seatCap} pass.)
                    </option>
                  ))}
                </select>
              </div>

              {/* Driver Section */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase">
                  {isFrench ? 'Chauffeur' : 'Driver Assignment'}
                </span>

                {/* Driver Searchable Combobox */}
                <div className="relative" ref={asgDriverDropdownRef}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isFrench ? 'Chauffeur assigné *' : 'Assigned Driver *'}
                    </label>
                    {asgDriverId && (
                      <button
                        type="button"
                        onClick={handleClearDriver}
                        className="text-[11px] text-slate-400 hover:text-rose-500 flex items-center gap-1 transition-colors"
                      >
                        <X className="w-3 h-3" />
                        <span>{isFrench ? 'Effacer' : 'Clear'}</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setAsgDriverDropdownOpen((prev) => !prev)}
                    className={`w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-xs flex items-center justify-between cursor-pointer transition-colors text-left ${
                      asgDriverDropdownOpen
                        ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                      <Users className={`w-4 h-4 shrink-0 ${asgDriverId ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                      <span className={`truncate ${asgDriverId ? 'font-medium text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>
                        {asgDriverId
                          ? `${asgDriverName} (${asgDriverId})`
                          : (isFrench ? '-- Sélectionner un chauffeur --' : '-- Select Driver --')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 text-slate-400">
                      {asgDriverId && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={handleClearDriver}
                          className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full"
                          title={isFrench ? 'Effacer' : 'Clear'}
                        >
                          <X className="w-3.5 h-3.5" />
                        </span>
                      )}
                      <ChevronDown className={`w-4 h-4 transition-transform duration-150 ${asgDriverDropdownOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {asgDriverDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                      <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            autoFocus
                            value={asgDriverSearchQuery}
                            onChange={(e) => setAsgDriverSearchQuery(e.target.value)}
                            placeholder={isFrench ? 'Rechercher chauffeur (nom, #)...' : 'Search driver (name, #)...'}
                            className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                e.stopPropagation();
                                setAsgDriverDropdownOpen(false);
                              }
                            }}
                          />
                          {asgDriverSearchQuery && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAsgDriverSearchQuery('');
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                        {filteredDrivers.length === 0 ? (
                          <div className="py-6 px-4 text-center text-xs text-slate-400">
                            {isFrench ? 'Aucun chauffeur trouvé' : 'No drivers found'}
                          </div>
                        ) : (
                          filteredDrivers.map((d) => {
                            const dVal = String(d.employeeId || d.id || d.employeeNumber);
                            const isSelected = asgDriverId === dVal;
                            const phone = d.mobilePhone || d.workPhonePhone || d.homePhone;
                            return (
                              <div
                                key={dVal}
                                onClick={() => handleSelectDriver(d)}
                                className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                                  isSelected
                                    ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-200 font-medium'
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                                    {d.firstName} {d.lastName}
                                    <span className="ml-1.5 text-[11px] text-slate-400 font-mono">
                                      ({d.employeeNumber || dVal})
                                    </span>
                                  </div>
                                  {phone && (
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                                      {phone}
                                    </div>
                                  )}
                                </div>
                                {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {isFrench ? 'Taux de paie chauffeur ($)' : 'Driver Pay Rate ($)'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={asgDriverPayRate}
                      onChange={(e) => setAsgDriverPayRate(Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {isFrench ? 'Heures d\'assurance-emploi (EI)' : 'Driver EI Hours'}
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      required
                      value={asgDriverEiHours}
                      onChange={(e) => setAsgDriverEiHours(Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Attendant Section (Optional) */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                  {isFrench ? 'Accompagnateur (Optionnel)' : 'Attendant (Optional)'}
                </span>

                {/* Attendant Searchable Combobox */}
                <div className="relative" ref={asgAttendantDropdownRef}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isFrench ? 'Accompagnateur assigné' : 'Assigned Attendant'}
                    </label>
                    {asgAttendantId && (
                      <button
                        type="button"
                        onClick={handleClearAttendant}
                        className="text-[11px] text-slate-400 hover:text-rose-500 flex items-center gap-1 transition-colors"
                      >
                        <X className="w-3 h-3" />
                        <span>{isFrench ? 'Effacer' : 'Clear'}</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setAsgAttendantDropdownOpen((prev) => !prev)}
                    className={`w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-xs flex items-center justify-between cursor-pointer transition-colors text-left ${
                      asgAttendantDropdownOpen
                        ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                      <Users className={`w-4 h-4 shrink-0 ${asgAttendantId ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                      <span className={`truncate ${asgAttendantId ? 'font-medium text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>
                        {asgAttendantId
                          ? `${asgAttendantName} (${asgAttendantId})`
                          : (isFrench ? '-- Aucun accompagnateur --' : '-- None / No Attendant --')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 text-slate-400">
                      {asgAttendantId && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={handleClearAttendant}
                          className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full"
                          title={isFrench ? 'Effacer' : 'Clear'}
                        >
                          <X className="w-3.5 h-3.5" />
                        </span>
                      )}
                      <ChevronDown className={`w-4 h-4 transition-transform duration-150 ${asgAttendantDropdownOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {asgAttendantDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                      <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            autoFocus
                            value={asgAttendantSearchQuery}
                            onChange={(e) => setAsgAttendantSearchQuery(e.target.value)}
                            placeholder={isFrench ? 'Rechercher accompagnateur (nom, #)...' : 'Search attendant (name, #)...'}
                            className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                e.stopPropagation();
                                setAsgAttendantDropdownOpen(false);
                              }
                            }}
                          />
                          {asgAttendantSearchQuery && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAsgAttendantSearchQuery('');
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                        {/* Option to select None */}
                        <div
                          onClick={() => handleSelectAttendant(null)}
                          className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                            !asgAttendantId
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 font-medium'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-500 dark:text-slate-400 italic'
                          }`}
                        >
                          <span>{isFrench ? '-- Aucun accompagnateur --' : '-- None / No Attendant --'}</span>
                          {!asgAttendantId && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                        </div>

                        {filteredAttendants.length === 0 && asgAttendantSearchQuery ? (
                          <div className="py-6 px-4 text-center text-xs text-slate-400">
                            {isFrench ? 'Aucun accompagnateur trouvé' : 'No attendants found'}
                          </div>
                        ) : (
                          filteredAttendants.map((a) => {
                            const aVal = String(a.employeeId || a.id || a.employeeNumber);
                            const isSelected = asgAttendantId === aVal;
                            const phone = a.mobilePhone || a.workPhonePhone || a.homePhone;
                            return (
                              <div
                                key={aVal}
                                onClick={() => handleSelectAttendant(a)}
                                className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                                  isSelected
                                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 font-medium'
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                                    {a.firstName} {a.lastName}
                                    <span className="ml-1.5 text-[11px] text-slate-400 font-mono">
                                      ({a.employeeNumber || aVal})
                                    </span>
                                  </div>
                                  {phone && (
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                                      {phone}
                                    </div>
                                  )}
                                </div>
                                {isSelected && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {asgAttendantId && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {isFrench ? 'Taux accompagnateur ($)' : 'Attendant Pay Rate ($)'}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={asgAttendantPayRate}
                        onChange={(e) => setAsgAttendantPayRate(Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {isFrench ? 'Heures EI accompagnateur' : 'Attendant EI Hours'}
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        value={asgAttendantEiHours}
                        onChange={(e) => setAsgAttendantEiHours(Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isFrench ? 'Notes d\'affectation' : 'Assignment Notes'}
                </label>
                <input
                  type="text"
                  value={asgNotes}
                  onChange={(e) => setAsgNotes(e.target.value)}
                  placeholder="e.g. Equipped with underfloor luggage bay"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAssignmentModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {isFrench ? 'Annuler' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs"
                >
                  {isFrench ? 'Enregistrer et synchroniser' : 'Save & Sync'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLIENT CREATE / EDIT MODAL */}
      {isClientModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingClient
                  ? isFrench ? 'Modifier le client' : 'Edit Charter Client'
                  : isFrench ? 'Nouveau client nolisé' : 'New Charter Client'}
              </h3>
              <button
                onClick={() => setIsClientModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveClient} className="p-5 space-y-3.5">
              {/* Optional school link - Searchable Combobox */}
              <div className="relative" ref={schoolDropdownRef}>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {isFrench ? 'Lier depuis une école (optionnel)' : 'Link from School Directory (optional)'}
                  </label>
                  {selectedSchool && (
                    <button
                      type="button"
                      onClick={handleClearSchool}
                      className="text-[11px] text-slate-400 hover:text-rose-500 flex items-center gap-1 transition-colors"
                    >
                      <X className="w-3 h-3" />
                      <span>{isFrench ? 'Détacher' : 'Clear Link'}</span>
                    </button>
                  )}
                </div>

                {/* Combobox Trigger Button */}
                <button
                  type="button"
                  onClick={() => setSchoolDropdownOpen((prev) => !prev)}
                  className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs flex items-center justify-between cursor-pointer transition-colors text-left ${
                    schoolDropdownOpen
                      ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                    <GraduationCap className={`w-4 h-4 shrink-0 ${selectedSchool ? 'text-indigo-500' : 'text-slate-400'}`} />
                    <span className={`truncate ${selectedSchool ? 'font-medium text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>
                      {selectedSchool ? selectedSchool.schoolName : (isFrench ? '-- Sélectionner une école --' : '-- Choose a School --')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 text-slate-400">
                    {selectedSchool && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={handleClearSchool}
                        className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full"
                        title={isFrench ? 'Effacer' : 'Clear'}
                      >
                        <X className="w-3.5 h-3.5" />
                      </span>
                    )}
                    <ChevronDown className={`w-4 h-4 transition-transform duration-150 ${schoolDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Dropdown Popover */}
                {schoolDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                    {/* Search Input */}
                    <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          autoFocus
                          value={schoolSearchQuery}
                          onChange={(e) => setSchoolSearchQuery(e.target.value)}
                          placeholder={isFrench ? 'Rechercher par nom, conseil, adresse...' : 'Search school, board, address...'}
                          className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              e.stopPropagation();
                              setSchoolDropdownOpen(false);
                            }
                          }}
                        />
                        {schoolSearchQuery && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSchoolSearchQuery('');
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* School List */}
                    <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                      {filteredSchools.length === 0 ? (
                        <div className="py-6 px-4 text-center text-xs text-slate-400">
                          {isFrench ? 'Aucune école trouvée' : 'No matching schools found'}
                        </div>
                      ) : (
                        filteredSchools.map((s) => {
                          const isSelected = selectedSchool?.schoolId === s.schoolId;
                          return (
                            <div
                              key={s.schoolId}
                              onClick={() => handleSelectSchool(s)}
                              className={`px-3 py-2 text-xs cursor-pointer flex items-start justify-between gap-2 transition-colors ${
                                isSelected
                                  ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200 font-medium'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                                  {s.schoolName}
                                </div>
                                {(s.schoolBoardName || s.schoolAddress) && (
                                  <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                                    {[s.schoolBoardName, s.schoolAddress].filter(Boolean).join(' • ')}
                                  </div>
                                )}
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isFrench ? 'Nom de l\'organisation / Client *' : 'Organization / Client Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {isFrench ? 'Personne contact' : 'Contact Person'}
                  </label>
                  <input
                    type="text"
                    value={clientContactName}
                    onChange={(e) => setClientContactName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {isFrench ? 'Téléphone' : 'Phone'}
                  </label>
                  <input
                    type="tel"
                    value={clientContactPhone}
                    onChange={(e) => setClientContactPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isFrench ? 'Courriel' : 'Email'}
                </label>
                <input
                  type="email"
                  value={clientContactEmail}
                  onChange={(e) => setClientContactEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isFrench ? 'Adresse de facturation' : 'Billing Address'}
                </label>
                <input
                  type="text"
                  value={clientBillingAddress}
                  onChange={(e) => setClientBillingAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isFrench ? 'Remarques' : 'Notes'}
                </label>
                <textarea
                  rows={2}
                  value={clientNotes}
                  onChange={(e) => setClientNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="clientActiveCheck"
                  checked={clientActive}
                  onChange={(e) => setClientActive(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="clientActiveCheck" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  {isFrench ? 'Client actif' : 'Active Client'}
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsClientModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {isFrench ? 'Annuler' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs"
                >
                  {isFrench ? 'Enregistrer' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PUBLISH CHARTER ASSIGNMENT OPEN MODAL */}
      {publishingTrip && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {isFrench
                      ? 'Publier l\'offre de voyage nolisé (Route Openings)'
                      : 'Publish Charter Assignment Open'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {publishingTrip.tripNumber} • {publishingTrip.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPublishingTrip(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePublishCharterOpening} className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-800/60 text-xs text-indigo-800 dark:text-indigo-200 space-y-1">
                <div className="font-bold">
                  {isFrench
                    ? 'Comment cela fonctionne dans l\'application Chauffeur :'
                    : 'How this appears in the Driver App:'}
                </div>
                <p className="text-[11px] opacity-90">
                  {isFrench
                    ? 'Les chauffeurs verront cette offre dans la page "Route Openings" sous la catégorie "Charter Trips", pourront prévisualiser l\'itinéraire et soumettre leur candidature.'
                    : 'Drivers will see a single bulletin under the "Charter Trips" category in the Route Openings page, preview stops, and apply. You can then review and award shifts to applicants.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {isFrench ? 'Rôle recherché' : 'Role Needed'}
                  </label>
                  <select
                    value={pubRoleNeeded}
                    onChange={(e) => setPubRoleNeeded(e.target.value as RouteOpeningRole)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  >
                    <option value="driver">{isFrench ? 'Chauffeur seulement' : 'Driver Only'}</option>
                    <option value="attendant">{isFrench ? 'Accompagnateur seulement' : 'Attendant Only'}</option>
                    <option value="driver_and_attendant">
                      {isFrench ? 'Chauffeur & Accompagnateur' : 'Driver & Attendant'}
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {isFrench ? 'Date limite de candidature *' : 'Application Deadline *'}
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={pubDeadline}
                    onChange={(e) => setPubDeadline(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {isFrench ? 'Taux de paie Chauffeur ($)' : 'Driver Payroll Rate ($)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    required
                    value={pubDriverPayRate}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setPubDriverPayRate(val);
                      setPubCompensation(
                        pubRoleNeeded === 'attendant'
                          ? `Attendant: $${pubAttendantPayRate.toFixed(2)} (${publishingTrip.billableHours || 5}h EI)`
                          : pubRoleNeeded === 'driver_and_attendant'
                          ? `Driver: $${val.toFixed(2)} | Attendant: $${pubAttendantPayRate.toFixed(2)} (${publishingTrip.billableHours || 5}h EI)`
                          : `Driver: $${val.toFixed(2)} / shift (${publishingTrip.billableHours || 5}h EI)`
                      );
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-blue-700 dark:text-blue-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {isFrench ? 'Taux de paie Accompagnateur ($)' : 'Attendant Payroll Rate ($)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    required
                    value={pubAttendantPayRate}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setPubAttendantPayRate(val);
                      setPubCompensation(
                        pubRoleNeeded === 'attendant'
                          ? `Attendant: $${val.toFixed(2)} (${publishingTrip.billableHours || 5}h EI)`
                          : pubRoleNeeded === 'driver_and_attendant'
                          ? `Driver: $${pubDriverPayRate.toFixed(2)} | Attendant: $${val.toFixed(2)} (${publishingTrip.billableHours || 5}h EI)`
                          : `Driver: $${pubDriverPayRate.toFixed(2)} / shift (${publishingTrip.billableHours || 5}h EI)`
                      );
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isFrench ? 'Rémunération / Taux affiché' : 'Compensation / Rate Note'}
                </label>
                <input
                  type="text"
                  value={pubCompensation}
                  onChange={(e) => setPubCompensation(e.target.value)}
                  placeholder="e.g. $150.00 / shift (6h EI)"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              {/* Stop Schedule & Time List */}
              {pubStops.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isFrench ? 'Horaire des arrêts publiés (Stop Time List)' : 'Published Stop Schedule & Time List'}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const datePart = publishingTrip.dispatchDate || getLocalTodayString();
                        const lastStop = pubStops[pubStops.length - 1];
                        const nextTime = addMinutesToCharterTime(
                          formatCharterStopTime(lastStop?.scheduledAt) || '15:00',
                          30
                        );
                        const nextIsPickup = pubStops.length % 2 === 0;
                        const newKey = `ST-pub-${pubStops.length + 1}-${Date.now()}`;
                        setPubStops((prev) => [
                          ...prev,
                          {
                            id: newKey,
                            sequenceOrder: prev.length + 1,
                            stopType: (nextIsPickup ? 3 : 2) as CharterStopType,
                            locationName: nextIsPickup ? 'Return Pickup' : 'Return Dropoff',
                            address: nextIsPickup ? 'Library' : 'School',
                            scheduledAt: `${datePart}T${nextTime}`,
                          },
                        ]);
                        setPubStopTimes((prev) => ({ ...prev, [newKey]: nextTime }));
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{isFrench ? 'Ajouter arrêt' : 'Add Stop'}</span>
                    </button>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 divide-y divide-slate-200/70 dark:divide-slate-700/70 space-y-2">
                    {pubStops.map((st, idx) => {
                      const key = st.id || `stop-${idx}`;
                      const stopTimeVal =
                        pubStopTimes[key] ||
                        formatCharterStopTime(st.scheduledAt) ||
                        resolveDefaultStopTime(publishingTrip, st, idx);
                      const isPickup = st.stopType === 0 || st.stopType === 3;
                      return (
                        <div
                          key={key}
                          className="pt-2 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <select
                              value={st.stopType}
                              onChange={(e) => {
                                const newType = Number(e.target.value) as CharterStopType;
                                const newLabel =
                                  newType === 0
                                    ? 'Pickup'
                                    : newType === 1
                                    ? 'Dropoff'
                                    : newType === 3
                                    ? 'Return Pickup'
                                    : 'Return Dropoff';
                                setPubStops((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, stopType: newType, locationName: newLabel } : item
                                  )
                                );
                              }}
                              className={`px-1.5 py-1 rounded-lg text-[10px] font-bold border shrink-0 ${
                                isPickup
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                              }`}
                            >
                              <option value={0}>Pick Up</option>
                              <option value={1}>Drop Off</option>
                              <option value={3}>Return Pick Up</option>
                              <option value={2}>Return Drop Off</option>
                            </select>
                            <input
                              type="text"
                              value={st.address}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPubStops((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, address: val } : item))
                                );
                              }}
                              className="flex-1 min-w-0 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                            />
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Clock className="w-3.5 h-3.5 text-indigo-500" />
                            <input
                              type="time"
                              value={stopTimeVal}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPubStopTimes((prev) => ({
                                  ...prev,
                                  [key]: val,
                                }));
                                setPubStops((prev) =>
                                  prev.map((item, i) =>
                                    i === idx
                                      ? { ...item, scheduledAt: `${publishingTrip.dispatchDate}T${val}` }
                                      : item
                                  )
                                );
                              }}
                              className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400"
                            />
                            {pubStops.length > 2 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPubStops((prev) =>
                                    prev
                                      .filter((_, i) => i !== idx)
                                      .map((item, i) => ({ ...item, sequenceOrder: i + 1 }))
                                  )
                                }
                                className="p-1 text-slate-400 hover:text-rose-500 rounded-lg"
                                title={isFrench ? 'Supprimer' : 'Remove stop'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isFrench ? 'Détails de l\'offre' : 'Bulletin Details & Instructions'}
                </label>
                <textarea
                  rows={3}
                  value={pubDescription}
                  onChange={(e) => setPubDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pubPostToChat}
                  onChange={(e) => setPubPostToChat(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>
                  {isFrench
                    ? 'Envoyer une annonce dans le canal Fleet Chat'
                    : 'Broadcast announcement to Fleet Chat channel'}
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPublishingTrip(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {isFrench ? 'Annuler' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isPublishingOpening}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  <span>
                    {isPublishingOpening
                      ? isFrench
                        ? 'Publication...'
                        : 'Publishing...'
                      : isFrench
                      ? 'Publier dans Route Openings'
                      : 'Publish to Route Openings'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVIEW CHARTER APPLICANTS DRAWER */}
      {reviewingCharterOpening && (
        <RouteOpeningApplicantsDrawer
          isOpen={!!reviewingCharterOpening}
          onClose={() => setReviewingCharterOpening(null)}
          opening={reviewingCharterOpening}
          onAwarded={() => {}}
        />
      )}
    </div>
  );
};
