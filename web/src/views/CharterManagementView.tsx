import React, { useState, useEffect, useMemo } from 'react';
import {
  Compass,
  Plus,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Truck,
  Users,
  Phone,
  Mail,
  MapPin,
  Pencil,
  Trash2,
  X,
  RotateCcw,
  ArrowRight
} from 'lucide-react';
import {
  CharterClient,
  CharterTrip,
  CharterAssignment,
  CharterStop,
  CharterTripType,
  CharterTripStatus,
  getCharterTripTypeLabel,
  getCharterTripStatusLabel,
  buildCharterSimpleStops,
} from '../types/charter';
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
  const [formNeedsAttendant, setFormNeedsAttendant] = useState<boolean>(false);
  const [formFromAddress, setFormFromAddress] = useState<string>('');
  const [formToAddress, setFormToAddress] = useState<string>('');
  const [formRoundTrip, setFormRoundTrip] = useState<boolean>(true);
  const [formQuotedAmount, setFormQuotedAmount] = useState<number>(450);
  const [formBillableHours, setFormBillableHours] = useState<number>(6);
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

  // Client Modal
  const [isClientModalOpen, setIsClientModalOpen] = useState<boolean>(false);
  const [editingClient, setEditingClient] = useState<CharterClient | null>(null);
  const [clientName, setClientName] = useState<string>('');
  const [clientContactName, setClientContactName] = useState<string>('');
  const [clientContactPhone, setClientContactPhone] = useState<string>('');
  const [clientContactEmail, setClientContactEmail] = useState<string>('');
  const [clientBillingAddress, setClientBillingAddress] = useState<string>('');
  const [clientNotes, setClientNotes] = useState<string>('');
  const [clientActive, setClientActive] = useState<boolean>(true);
  const [clientSearch, setClientSearch] = useState<string>('');

  // Subscribe to trips and clients
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

    return () => {
      unsubTrips();
      unsubClients();
    };
  }, []);

  // Update selectedTrip if trips array updates
  useEffect(() => {
    if (selectedTrip) {
      const updated = trips.find((t) => t.id === selectedTrip.id);
      if (updated) setSelectedTrip(updated);
    }
  }, [trips]);

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

  // Open Create Trip Modal
  const handleOpenCreateTrip = () => {
    setEditingTripId(null);
    setFormClientId(clients[0]?.id || '');
    setFormTitle('');
    setFormTripType(0);
    const today = getLocalTodayString();
    setFormDepartsAt(`${today}T08:00`);
    setFormReturnsAt(`${today}T15:00`);
    setFormPassengerCount(35);
    setFormNeedsAttendant(false);
    setFormFromAddress('School Yard / Main Gate');
    setFormToAddress('');
    setFormRoundTrip(true);
    setFormQuotedAmount(450);
    setFormBillableHours(6);
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
    setFormNeedsAttendant(trip.needsAttendant || false);
    const pickupStop = trip.stops?.find((s) => s.stopType === 0);
    const destStop = trip.stops?.find((s) => s.stopType === 1);
    setFormFromAddress(pickupStop?.address || '');
    setFormToAddress(destStop?.address || '');
    setFormRoundTrip(trip.roundTrip ?? true);
    setFormQuotedAmount(trip.quotedAmount || 0);
    setFormBillableHours(trip.billableHours || 0);
    setFormBillingNotes(trip.billingNotes || '');
    setFormNotes(trip.notes || '');
    setFormSpecialRequirements(trip.specialRequirements || '');
    setIsTripModalOpen(true);
  };

  // Save Trip
  const handleSaveTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    const client = clients.find((c) => c.id === formClientId);
    const clientNameStr = client ? client.name : 'General Charter Client';
    const dispatchDate = formDepartsAt.slice(0, 10);

    const stops: CharterStop[] = buildCharterSimpleStops({
      tripId: editingTripId || 'temp',
      fromAddress: formFromAddress || 'Pickup Address',
      toAddress: formToAddress || 'Destination Address',
      roundTrip: formRoundTrip,
      departsAt: formDepartsAt,
      returnsAt: formReturnsAt,
    });

    try {
      if (editingTripId) {
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
            needsAttendant: formNeedsAttendant,
            stops,
            roundTrip: formRoundTrip,
            quotedAmount: Number(formQuotedAmount),
            billableHours: Number(formBillableHours),
            billingNotes: formBillingNotes,
            notes: formNotes,
            specialRequirements: formSpecialRequirements,
          },
          actorName
        );
      } else {
        const tripNum = `CHR-${new Date().getFullYear()}-${String(trips.length + 1).padStart(3, '0')}`;
        await CharterService.createTrip({
          tripNumber: tripNum,
          charterClientId: formClientId,
          clientName: clientNameStr,
          title: formTitle,
          tripType: formTripType,
          status: 0, // Draft
          dispatchDate,
          departsAt: formDepartsAt,
          returnsAt: formReturnsAt,
          passengerCount: Number(formPassengerCount),
          needsAttendant: formNeedsAttendant,
          specialRequirements: formSpecialRequirements,
          quotedAmount: Number(formQuotedAmount),
          billableHours: Number(formBillableHours),
          billingNotes: formBillingNotes,
          notes: formNotes,
          roundTrip: formRoundTrip,
          stops,
          assignments: [],
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
      setAsgDriverPayRate(150);
      setAsgDriverEiHours(selectedTrip?.billableHours || 5);
      setAsgAttendantId('');
      setAsgAttendantName('');
      setAsgAttendantPhone('');
      setAsgAttendantPayRate(100);
      setAsgAttendantEiHours(selectedTrip?.billableHours || 5);
      setAsgNotes('');
    }
    setIsAssignmentModalOpen(true);
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
            vehicleUnitNumber: asgUnitNumber,
            plateNumber: asgPlateNumber,
            driverId: asgDriverId,
            driverName: asgDriverName,
            driverPhone: asgDriverPhone,
            driverPayRate: Number(asgDriverPayRate),
            driverEiHours: Number(asgDriverEiHours),
            attendantId: asgAttendantId || undefined,
            attendantName: asgAttendantName || undefined,
            attendantPhone: asgAttendantPhone || undefined,
            attendantPayRate: Number(asgAttendantPayRate),
            attendantEiHours: Number(asgAttendantEiHours),
            notes: asgNotes,
          },
          actorName
        );

        await logDispatchAction({
          date: selectedTrip.dispatchDate,
          type: 'Charter Crew Modified',
          detail: `Modified crew assignment on ${selectedTrip.tripNumber}: Driver ${asgDriverName}, Unit ${asgUnitNumber}`,
          user: actorName,
        });
      } else {
        // Add new assignment
        const newAssignmentId = `ASG-${selectedTrip.id}-${Date.now().toString().slice(-4)}`;
        const newAssignment: CharterAssignment = {
          id: newAssignmentId,
          charterTripId: selectedTrip.id,
          vehicleId: asgVehicleId,
          vehicleUnitNumber: asgUnitNumber,
          plateNumber: asgPlateNumber,
          driverId: asgDriverId,
          driverName: asgDriverName,
          driverPhone: asgDriverPhone,
          driverPayOption: 'STANDARD',
          driverPayRate: Number(asgDriverPayRate),
          driverEiHours: Number(asgDriverEiHours),
          attendantId: asgAttendantId || undefined,
          attendantName: asgAttendantName || undefined,
          attendantPhone: asgAttendantPhone || undefined,
          attendantPayOption: 'STANDARD',
          attendantPayRate: Number(asgAttendantPayRate),
          attendantEiHours: Number(asgAttendantEiHours),
          status: 0,
          isDriverCheckedIn: false,
          isAttendantCheckedIn: false,
          notes: asgNotes,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const updatedAssignments = [...(selectedTrip.assignments || []), newAssignment];
        await CharterService.updateTrip(
          selectedTrip.id,
          {
            assignments: updatedAssignments,
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

  // Open Client Modal
  const handleOpenClientModal = (client?: CharterClient) => {
    if (client) {
      setEditingClient(client);
      setClientName(client.name);
      setClientContactName(client.contactName || '');
      setClientContactPhone(client.contactPhone || '');
      setClientContactEmail(client.contactEmail || '');
      setClientBillingAddress(client.billingAddress || '');
      setClientNotes(client.notes || '');
      setClientActive(client.active);
    } else {
      setEditingClient(null);
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

  // Save Client
  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingClient) {
        await CharterService.updateClient(editingClient.id, {
          name: clientName,
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

  // Link from school dropdown
  const handleSelectSchoolForClient = (schoolIdStr: string) => {
    const sch = schools.find((s) => String(s.schoolId) === schoolIdStr);
    if (!sch) return;
    setClientName(sch.schoolName);
    if (sch.contactPerson) setClientContactName(sch.contactPerson);
    if (sch.schoolPhone) setClientContactPhone(sch.schoolPhone);
    if (sch.contactPersonEmail) setClientContactEmail(sch.contactPersonEmail);
    if (sch.schoolAddress) setClientBillingAddress(sch.schoolAddress);
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
                      const totalAssignments = trip.assignments?.length || 0;

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
                            <div>
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
                          </td>

                          <td className="py-3.5 px-4 text-xs font-mono">
                            <div className="text-slate-700 dark:text-slate-300">
                              {isFrench ? 'Dép :' : 'Dep:'} {departsTime}
                            </div>
                            <div className="text-slate-400">
                              {isFrench ? 'Ret :' : 'Ret:'} {returnsTime}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {totalAssignments === 0 ? (
                              <span className="text-xs text-amber-500 font-semibold">
                                {isFrench ? 'Non assigné' : 'Unassigned'}
                              </span>
                            ) : (
                              <div className="space-y-1">
                                {trip.assignments.map((asg) => (
                                  <div key={asg.id} className="text-xs flex items-center gap-1.5">
                                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                                      {asg.vehicleUnitNumber}
                                    </span>
                                    <span className="text-slate-400">•</span>
                                    <span className="text-slate-800 dark:text-slate-200">
                                      {asg.driverName}
                                    </span>
                                    {asg.isDriverCheckedIn && (
                                      <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                        {isFrench ? 'Pointé' : 'Checked In'}
                                      </span>
                                    )}
                                  </div>
                                ))}
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
                          </td>

                          <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
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
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-lg text-indigo-600 dark:text-indigo-400">
                    {selectedTrip.tripNumber}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                    {getCharterTripTypeLabel(selectedTrip.tripType, isFrench)}
                  </span>
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
                  <span className="text-[11px] text-slate-400 uppercase font-bold">{isFrench ? 'Facturation' : 'Pricing'}</span>
                  <p className="text-base font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    ${(selectedTrip.quotedAmount || 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {selectedTrip.billableHours || 0} {isFrench ? 'heures facturables' : 'billable hours'}
                  </p>
                </div>
              </div>

              {/* Stops Itinerary */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {isFrench ? 'Itinéraire des arrêts' : 'Route Stops'}
                </h4>
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedTrip.stops?.map((stop, idx) => (
                    <div key={stop.id} className="py-2.5 flex items-start gap-2.5 first:pt-0 last:pb-0">
                      <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {stop.locationName || (stop.stopType === 0 ? 'Pickup' : stop.stopType === 1 ? 'Destination' : 'Return')}
                        </div>
                        <div className="text-xs text-slate-500">{stop.address}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Assignments & Crew Check-In Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {isFrench ? 'Véhicules & Équipage' : 'Vehicles & Crew Assignments'}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {isFrench
                        ? 'Le pointage envoie automatiquement la paie à la répartition et au journal de paie.'
                        : 'Check-in automatically generates records in Dispatch Payroll & Payroll Log.'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleOpenAssignmentModal()}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isFrench ? 'Ajouter véhicule' : 'Add Vehicle'}</span>
                  </button>
                </div>

                {(!selectedTrip.assignments || selectedTrip.assignments.length === 0) ? (
                  <div className="p-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-slate-500">
                    <Truck className="w-8 h-8 mx-auto text-slate-400 mb-1" />
                    <p className="text-xs font-semibold">{isFrench ? 'Aucun véhicule assigné' : 'No vehicles assigned yet'}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {isFrench
                        ? 'Assignez un autobus et un chauffeur pour démarrer le voyage.'
                        : 'Assign a bus and driver to dispatch this trip.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedTrip.assignments.map((asg) => (
                      <div
                        key={asg.id}
                        className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3"
                      >
                        {/* Vehicle & Assignment Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-base text-slate-900 dark:text-white">
                              Unit {asg.vehicleUnitNumber}
                            </span>
                            {asg.plateNumber && (
                              <span className="text-[11px] text-slate-400 font-mono">
                                ({asg.plateNumber})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleOpenAssignmentModal(asg)}
                              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                              title={isFrench ? 'Modifier l\'équipage' : 'Edit Crew'}
                            >
                              <Pencil className="w-3.5 h-3.5" />
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
                              <span className="font-semibold text-slate-900 dark:text-white text-xs">
                                {asg.driverName}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                              ${asg.driverPayRate?.toFixed(2)} • {asg.driverEiHours}h EI
                              {asg.isDriverCheckedIn && ` • In: ${asg.driverCheckedInAt || '-'}`}
                              {asg.isDriverCheckedOut && ` • Out: ${asg.driverCheckedOutAt || '-'}`}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {!asg.isDriverCheckedIn ? (
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
                      </div>
                    ))}
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
                    onChange={(e) => setFormDepartsAt(e.target.value)}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {isFrench ? 'Lieu de prise en charge (Départ)' : 'Pickup Address'}
                  </label>
                  <input
                    type="text"
                    value={formFromAddress}
                    onChange={(e) => setFormFromAddress(e.target.value)}
                    placeholder="e.g. 574 Broadview Ave, Ottawa"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {isFrench ? 'Destination' : 'Destination Address'}
                  </label>
                  <input
                    type="text"
                    value={formToAddress}
                    onChange={(e) => setFormToAddress(e.target.value)}
                    placeholder="e.g. 1125 Colonel By Dr, Ottawa"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
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

              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formRoundTrip}
                    onChange={(e) => setFormRoundTrip(e.target.checked)}
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
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
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
                  {isFrench ? 'Sélectionner le véhicule *' : 'Select Vehicle *'}
                </label>
                <select
                  required
                  value={asgVehicleId}
                  onChange={(e) => {
                    const vId = Number(e.target.value);
                    const veh = vehicles.find((v) => v.vehicleId === vId);
                    setAsgVehicleId(vId);
                    setAsgUnitNumber(veh?.unitNumber || `UNIT-${vId}`);
                    setAsgPlateNumber(veh?.plateNumber || '');
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                >
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

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {isFrench ? 'Chauffeur assigné *' : 'Assigned Driver *'}
                  </label>
                  <select
                    required
                    value={asgDriverId}
                    onChange={(e) => {
                      const dId = e.target.value;
                      const emp = employees.find((em) => String(em.employeeId || em.id || em.employeeNumber) === dId);
                      setAsgDriverId(dId);
                      setAsgDriverName(emp ? `${emp.firstName} ${emp.lastName}` : '');
                      setAsgDriverPhone(emp?.mobilePhone || emp?.workPhonePhone || emp?.homePhone || '');
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  >
                    <option value="">{isFrench ? '-- Sélectionner un chauffeur --' : '-- Select Driver --'}</option>
                    {driverOptions.map((d) => {
                      const dVal = String(d.employeeId || d.id || d.employeeNumber);
                      return (
                        <option key={dVal} value={dVal}>
                          {d.firstName} {d.lastName} ({d.employeeNumber || dVal})
                        </option>
                      );
                    })}
                  </select>
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

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {isFrench ? 'Accompagnateur assigné' : 'Assigned Attendant'}
                  </label>
                  <select
                    value={asgAttendantId}
                    onChange={(e) => {
                      const aId = e.target.value;
                      if (!aId) {
                        setAsgAttendantId('');
                        setAsgAttendantName('');
                        setAsgAttendantPhone('');
                      } else {
                        const emp = employees.find((em) => String(em.employeeId || em.id || em.employeeNumber) === aId);
                        setAsgAttendantId(aId);
                        setAsgAttendantName(emp ? `${emp.firstName} ${emp.lastName}` : '');
                        setAsgAttendantPhone(emp?.mobilePhone || emp?.workPhonePhone || emp?.homePhone || '');
                      }
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  >
                    <option value="">{isFrench ? '-- Aucun accompagnateur --' : '-- None / No Attendant --'}</option>
                    {attendantOptions.map((a) => {
                      const aVal = String(a.employeeId || a.id || a.employeeNumber);
                      return (
                        <option key={aVal} value={aVal}>
                          {a.firstName} {a.lastName} ({a.employeeNumber || aVal})
                        </option>
                      );
                    })}
                  </select>
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
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
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
              {/* Optional school link */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isFrench ? 'Lier depuis une école (optionnel)' : 'Link from School Directory (optional)'}
                </label>
                <select
                  onChange={(e) => handleSelectSchoolForClient(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  defaultValue=""
                >
                  <option value="">{isFrench ? '-- Sélectionner une école --' : '-- Choose a School --'}</option>
                  {schools.map((s) => (
                    <option key={s.schoolId} value={s.schoolId}>
                      {s.schoolName}
                    </option>
                  ))}
                </select>
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
    </div>
  );
};
