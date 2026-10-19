import React, { useState, useEffect } from 'react';
import { Student, StudentContact, StudentStop } from '../../types/student';
import { School } from '../../types/school';
import { BusRoute, BusRouteShift } from '../../types/route';
import { RouteService } from '../../services/routeService';
import {
  assignStudentToRouteOrShiftLogic,
  persistShiftAssignments,
  AssignmentTarget
} from '../../services/stopAssignmentService';
import { useI18n } from '../../contexts/I18nContext';
import {
  X,
  GraduationCap,
  School as SchoolIcon,
  HeartPulse,
  Users,
  Check,
  AlertTriangle,
  Plus,
  Trash2,
  Star,
  MapPin,
  Clock,
  Edit2,
  Bus,
  Lock,
  Search
} from 'lucide-react';

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (studentData: Partial<Student>) => Promise<void>;
  initialData?: Student | null;
  schools: School[];
}

const safeFormatDateForInput = (val?: any): string => {
  if (!val) return '';
  try {
    let d: Date | null = null;
    if (typeof val === 'object' && val !== null) {
      if (typeof val.toDate === 'function') {
        d = val.toDate();
      } else if (typeof val.seconds === 'number') {
        d = new Date(val.seconds * 1000);
      } else if (val instanceof Date) {
        d = val;
      }
    } else if (typeof val === 'string' || typeof val === 'number') {
      const parsed = new Date(val);
      if (!isNaN(parsed.getTime())) {
        d = parsed;
      }
    }
    if (d && !isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch (e) {
    console.warn('[StudentModal] Failed to parse birthDate:', e);
  }
  return '';
};

const generateDefaultStops = (addr: string, schName: string, rt: string): StudentStop[] => {
  const cleanRt = rt ? rt.split(',')[0].trim() : 'OCDSB-001';
  const cleanAddr = addr.trim() || 'Home Stop (Curbside)';
  const cleanSch = schName.trim() || 'Children\'s Village School';
  return [
    {
      stopId: `STP-1`,
      time: '7:10 a.m.',
      type: 'Pickup',
      opDays: 'M T W R F',
      location: cleanAddr,
      comment: 'Eastbound front curb / driveway',
      instruction: 'Met at bus by parent',
      route: cleanRt,
      shift: 'AM'
    },
    {
      stopId: `STP-2`,
      time: '8:30 a.m.',
      type: 'School Dropoff',
      opDays: 'M T W R F',
      location: cleanSch,
      comment: 'Main school bus arrival loop',
      instruction: '',
      route: cleanRt,
      shift: 'AM'
    },
    {
      stopId: `STP-3`,
      time: '12:25 p.m.',
      type: 'School Pickup',
      opDays: '---- F',
      location: cleanSch,
      comment: 'Friday early dismissal loading zone',
      instruction: '',
      route: cleanRt,
      shift: 'NOON'
    },
    {
      stopId: `STP-4`,
      time: '1:33 p.m.',
      type: 'Dropoff',
      opDays: '---- F',
      location: cleanAddr,
      comment: 'Friday early dismissal dropoff at curb',
      instruction: '',
      route: cleanRt,
      shift: 'NOON'
    },
    {
      stopId: `STP-5`,
      time: '2:40 p.m.',
      type: 'School Pickup',
      opDays: 'M T W R -',
      location: cleanSch,
      comment: 'Afternoon regular dismissal loop',
      instruction: '',
      route: cleanRt,
      shift: 'PM'
    },
    {
      stopId: `STP-6`,
      time: '3:48 p.m.',
      type: 'Dropoff',
      opDays: 'M T W R -',
      location: cleanAddr,
      comment: 'Afternoon dropoff at house curb',
      instruction: '',
      route: cleanRt,
      shift: 'PM'
    }
  ];
};

export const StudentModal: React.FC<StudentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  schools = []
}) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'school' | 'stops' | 'contacts' | 'care'>('profile');

  // Basic Profile
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [studentNo, setStudentNo] = useState('');
  const [grade, setGrade] = useState('1');
  const [gender, setGender] = useState('Unspecified');
  const [birthDate, setBirthDate] = useState('');
  const [active, setActive] = useState(true);
  const [metatBus, setMetatBus] = useState(false);

  // School & Route Logistics
  const [schoolId, setSchoolId] = useState<number>(schools?.[0]?.schoolId || 101);
  const [routes, setRoutes] = useState('');
  const [studentAddress, setStudentAddress] = useState('');
  const [studentPhone, setStudentPhone] = useState('');

  const currentSchool = (schools || []).find((s) => s && s.schoolId === Number(schoolId));
  const currentSchoolName = currentSchool ? currentSchool.schoolName : initialData?.schoolName || '';

  // Stops List
  const [stops, setStops] = useState<StudentStop[]>([]);
  const [editingStopIndex, setEditingStopIndex] = useState<number | null>(null);
  const [stopFormTime, setStopFormTime] = useState('7:10 a.m.');
  const [stopFormType, setStopFormType] = useState('Pickup');
  const [stopFormOpDays, setStopFormOpDays] = useState('M T W R F');
  const [stopFormLocation, setStopFormLocation] = useState('');
  const [stopFormComment, setStopFormComment] = useState('');
  const [stopFormInstruction, setStopFormInstruction] = useState('');
  const [stopFormRoute, setStopFormRoute] = useState('');
  const [stopFormShift, setStopFormShift] = useState('AM');

  // Route & Shift Assignment Modal State
  const [availableRoutes, setAvailableRoutes] = useState<BusRoute[]>([]);
  const [availableShifts, setAvailableShifts] = useState<BusRouteShift[]>([]);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedTargetKey, setSelectedTargetKey] = useState<string>('');
  const [routeShiftSearch, setRouteShiftSearch] = useState<string>('');
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const filteredAvailableRoutes = React.useMemo(() => {
    if (!routeShiftSearch.trim()) return availableRoutes;
    const q = routeShiftSearch.toLowerCase().trim();
    return availableRoutes.filter(
      (r) =>
        r.routeNo?.toLowerCase().includes(q) ||
        r.routeName?.toLowerCase().includes(q) ||
        r.schoolBoardCode?.toLowerCase().includes(q) ||
        r.yardName?.toLowerCase().includes(q)
    );
  }, [availableRoutes, routeShiftSearch]);

  const filteredAvailableShifts = React.useMemo(() => {
    if (!routeShiftSearch.trim()) return availableShifts;
    const q = routeShiftSearch.toLowerCase().trim();
    return availableShifts.filter(
      (s) =>
        s.routeNo?.toLowerCase().includes(q) ||
        s.routeName?.toLowerCase().includes(q) ||
        s.shiftType?.toLowerCase().includes(q) ||
        s.runDays?.toLowerCase().includes(q) ||
        s.shiftSchools?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q)
    );
  }, [availableShifts, routeShiftSearch]);

  useEffect(() => {
    if (!isOpen) return;
    RouteService.list()
      .then((rts) => setAvailableRoutes(rts || []))
      .catch((e) => console.warn('Failed to load routes in StudentModal:', e));

    RouteService.getAllShifts()
      .then((sfts) => setAvailableShifts(sfts || []))
      .catch((e) => console.warn('Failed to load shifts in StudentModal:', e));
  }, [isOpen]);

  // Multiple Contacts List
  const [contacts, setContacts] = useState<StudentContact[]>([]);

  // Emergency & Special Care
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyAddress, setEmergencyAddress] = useState('');
  const [equipments, setEquipments] = useState('');
  const [studentDispatchNotes, setStudentDispatchNotes] = useState('');
  const [studentSchoolNotes, setStudentSchoolNotes] = useState('');

  useEffect(() => {
    try {
      if (initialData) {
        setFirstName(initialData.firstName || '');
        setLastName(initialData.lastName || '');
        setStudentNo(initialData.studentNo || '');
        setGrade(initialData.grade || '1');
        setGender(initialData.gender || 'Unspecified');
        setBirthDate(safeFormatDateForInput(initialData.birthDate));
        setActive(initialData.active ?? true);
        setMetatBus(initialData.metatBus ?? false);

        setSchoolId(initialData.schoolId || schools?.[0]?.schoolId || 101);
        setRoutes(initialData.routes || '');
        setStudentAddress(initialData.studentAddress || '');
        setStudentPhone(initialData.studentPhone || '');

        const existingContacts = Array.isArray(initialData.contacts) ? initialData.contacts : [];
        if (existingContacts.length > 0) {
          setContacts(
            existingContacts.map((c, i) => ({
              ...c,
              contactIndex: c.contactIndex || i + 1,
              primaryContact: c.primaryContact ?? (i === 0)
            }))
          );
        } else {
          // Default initial empty contact
          setContacts([
            {
              contactId: `SC-${Date.now()}-1`,
              studentId: initialData.studentId || 0,
              contactIndex: 1,
              primaryContact: true,
              contactName: '',
              relationship: 'Mother',
              mobilePhone: '',
              homePhone: '',
              workPhone: '',
              email: '',
              address: '',
              active: true
            }
          ]);
        }

        setEmergencyPhone(initialData.studentEmergencyPhone || '');
        setEmergencyAddress(initialData.studentEmergencyAddress || '');
        setEquipments(initialData.equipments || '');
        setStudentDispatchNotes(initialData.studentDispatchNotes || '');
        setStudentSchoolNotes(initialData.studentSchoolNotes || '');

        if (initialData.stops && Array.isArray(initialData.stops) && initialData.stops.length > 0) {
          setStops(initialData.stops);
        } else {
          setStops(
            generateDefaultStops(
              initialData.studentAddress || '',
              initialData.schoolName || '',
              initialData.routes || ''
            )
          );
        }
      } else {
        // Reset form
        setFirstName('');
        setLastName('');
        setStudentNo('');
        setGrade('1');
        setGender('Unspecified');
        setBirthDate('');
        setActive(true);
        setMetatBus(false);

        setSchoolId(schools?.[0]?.schoolId || 101);
        setRoutes('');
        setStudentAddress('');
        setStudentPhone('');

        setContacts([
          {
            contactId: `SC-${Date.now()}-1`,
            studentId: 0,
            contactIndex: 1,
            primaryContact: true,
            contactName: '',
            relationship: 'Mother',
            mobilePhone: '',
            homePhone: '',
            workPhone: '',
            email: '',
            address: '',
            active: true
          }
        ]);

        setEmergencyPhone('');
        setEmergencyAddress('');
        setEquipments('');
        setStudentDispatchNotes('');
        setStudentSchoolNotes('');
        setStops(generateDefaultStops('', '', ''));
      }
    } catch (err) {
      console.error('[StudentModal] Error in initialData effect:', err);
    }
  }, [initialData, isOpen, schools]);

  if (!isOpen) return null;

  const isSchoolStop = (type: string) => {
    return (type || '').toLowerCase().includes('school');
  };

  const handleOpenAddStop = () => {
    setAssignError(null);
    setRouteShiftSearch('');
    if (availableRoutes.length > 0) {
      setSelectedTargetKey(`route:${availableRoutes[0].id}:${availableRoutes[0].routeNo}`);
    } else if (availableShifts.length > 0) {
      setSelectedTargetKey(`shift:${availableShifts[0].routeId}:${availableShifts[0].routeNo}:${availableShifts[0].id}`);
    } else {
      setSelectedTargetKey('');
    }
    setIsAssignModalOpen(true);
  };

  const handleConfirmAssign = async () => {
    if (!selectedTargetKey) {
      setAssignError('Please select a route or shift from the dropdown.');
      return;
    }

    setAssignError(null);
    setAssigning(true);

    try {
      const parts = selectedTargetKey.split(':');
      const targetType = parts[0] as 'route' | 'shift';
      const routeId = parts[1];
      const routeNo = parts[2];
      const shiftId = parts[3];

      const target: AssignmentTarget = {
        type: targetType,
        routeId,
        routeNo,
        shiftId,
        label: targetType === 'route' ? `Route ${routeNo}` : `Shift ${routeNo}`
      };

      const currentStudentObj: Student = {
        id: initialData?.id || `STU-${studentNo || 'NEW'}`,
        studentId: initialData?.studentId || (parseInt(studentNo, 10) || Date.now() % 100000),
        studentNo: studentNo || '0000',
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        studentName: `${firstName.trim()} ${lastName.trim()}`,
        fullName: metatBus ? `${firstName.trim()} ${lastName.trim()}*` : `${firstName.trim()} ${lastName.trim()}`,
        studentAddress: studentAddress.trim() || 'Home Address',
        schoolId: Number(schoolId),
        schoolName: currentSchoolName || 'School',
        active,
        metatBus,
        grade,
        routes,
        stops
      };

      const result = assignStudentToRouteOrShiftLogic(
        currentStudentObj,
        target,
        availableShifts,
        schools
      );

      if (!result.success) {
        setAssignError(result.error || 'Failed to assign student to route or shift.');
        setAssigning(false);
        return;
      }

      // Merge newly generated student stops with current stops (avoiding duplicates)
      const existingStops = [...stops];
      for (const newStop of result.generatedStudentStops) {
        const alreadyExists = existingStops.some(
          (s) =>
            s.route === newStop.route &&
            s.shift === newStop.shift &&
            s.type === newStop.type &&
            s.location === newStop.location
        );
        if (!alreadyExists) {
          existingStops.push(newStop);
        }
      }
      setStops(existingStops);

      // Append assigned routes to routes field
      const currentRoutesSet = new Set(
        routes ? routes.split(',').map((r) => r.trim()).filter(Boolean) : []
      );
      for (const rNo of result.assignedRouteNos) {
        currentRoutesSet.add(rNo);
      }
      setRoutes(Array.from(currentRoutesSet).join(', '));

      // Asynchronously persist shift stops in Firestore
      if (result.updatedShifts && result.updatedShifts.length > 0) {
        await persistShiftAssignments(result.updatedShifts);
      }

      setIsAssignModalOpen(false);
    } catch (err: any) {
      console.error('Assignment error:', err);
      setAssignError(err.message || 'An unexpected error occurred during stop assignment.');
    } finally {
      setAssigning(false);
    }
  };

  const handleOpenEditStop = (index: number) => {
    const item = stops[index];
    if (!item || isSchoolStop(item.type)) return;
    setStopFormTime(item.time || '7:10 a.m.');
    setStopFormType(item.type || 'Pickup');
    setStopFormOpDays(item.opDays || 'M T W R F');
    setStopFormLocation(item.location || '');
    setStopFormComment(item.comment || '');
    setStopFormInstruction(item.instruction || '');
    setStopFormRoute(item.route || routes || '');
    setStopFormShift(item.shift || 'AM');
    setEditingStopIndex(index);
  };

  const handleSaveStopItem = () => {
    if (!stopFormTime.trim() || !stopFormLocation.trim()) {
      alert('Time and Location are required.');
      return;
    }
    const updatedStop: StudentStop = {
      stopId:
        editingStopIndex !== null && editingStopIndex >= 0 && stops[editingStopIndex]?.stopId
          ? stops[editingStopIndex].stopId
          : `STP-${Date.now()}`,
      time: stopFormTime.trim(),
      type: stopFormType.trim(),
      opDays: stopFormOpDays.trim() || 'M T W R F',
      location: stopFormLocation.trim(),
      comment: stopFormComment.trim() || undefined,
      instruction: stopFormInstruction.trim() || undefined,
      route: stopFormRoute.trim() || undefined,
      shift: stopFormShift || 'AM'
    };

    if (editingStopIndex === -1) {
      setStops([...stops, updatedStop]);
    } else if (editingStopIndex !== null && editingStopIndex >= 0) {
      setStops(stops.map((s, i) => (i === editingStopIndex ? updatedStop : s)));
    }
    setEditingStopIndex(null);
  };

  const handleDeleteStop = (index: number) => {
    const item = stops[index];
    if (item && isSchoolStop(item.type)) return;
    setStops(stops.filter((_, i) => i !== index));
  };

  const handleAddContact = () => {
    const nextIdx = contacts.length + 1;
    const newContact: StudentContact = {
      contactId: `SC-${Date.now()}-${nextIdx}`,
      studentId: initialData?.studentId || 0,
      contactIndex: nextIdx,
      primaryContact: contacts.length === 0,
      contactName: '',
      relationship: contacts.length === 1 ? 'Father' : 'Emergency Contact',
      mobilePhone: '',
      homePhone: '',
      workPhone: '',
      email: '',
      address: '',
      active: true
    };
    setContacts([...contacts, newContact]);
  };

  const handleRemoveContact = (index: number) => {
    if (contacts.length <= 1) {
      setContacts([
        {
          contactId: `SC-${Date.now()}-1`,
          studentId: initialData?.studentId || 0,
          contactIndex: 1,
          primaryContact: true,
          contactName: '',
          relationship: 'Parent',
          mobilePhone: '',
          homePhone: '',
          workPhone: '',
          email: '',
          address: '',
          active: true
        }
      ]);
      return;
    }
    const wasPrimary = contacts[index].primaryContact;
    const remaining = contacts.filter((_, i) => i !== index);
    if (wasPrimary && remaining.length > 0) {
      remaining[0].primaryContact = true;
    }
    setContacts(remaining);
  };

  const handleSetPrimary = (index: number) => {
    setContacts(
      contacts.map((c, i) => ({
        ...c,
        primaryContact: i === index
      }))
    );
  };

  const handleContactChange = (index: number, field: keyof StudentContact, value: any) => {
    setContacts(
      contacts.map((c, i) => {
        if (i === index) {
          return { ...c, [field]: value };
        }
        return c;
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !studentNo.trim()) {
      alert('First Name, Last Name, and Student ID/No are required.');
      return;
    }

    const safeSchools = Array.isArray(schools) ? schools : [];
    const selectedSchool = safeSchools.find((s) => s && s.schoolId === Number(schoolId));
    const schoolName = selectedSchool ? selectedSchool.schoolName : initialData?.schoolName || 'Central School';

    const fullCleanName = `${firstName.trim()} ${lastName.trim()}`;

    // Filter valid contacts (at least a name or phone entered)
    const validContacts: StudentContact[] = contacts
      .filter((c) => c.contactName.trim() || (c.mobilePhone && c.mobilePhone.trim()))
      .map((c, idx) => ({
        contactId: c.contactId || `SC-${Date.now()}-${idx + 1}`,
        studentId: initialData?.studentId || 0,
        contactIndex: idx + 1,
        primaryContact: c.primaryContact ?? (idx === 0),
        contactName: c.contactName.trim() || 'Parent/Guardian',
        relationship: c.relationship?.trim() || 'Parent',
        mobilePhone: c.mobilePhone?.trim() || '',
        homePhone: c.homePhone?.trim() || '',
        workPhone: c.workPhone?.trim() || '',
        email: c.email?.trim() || '',
        address: c.address?.trim() || studentAddress.trim(),
        active: c.active ?? true
      }));

    if (validContacts.length > 0 && !validContacts.some((c) => c.primaryContact)) {
      validContacts[0].primaryContact = true;
    }

    let isoBirthDate: string | undefined = undefined;
    if (birthDate) {
      const d = new Date(birthDate);
      if (!isNaN(d.getTime())) {
        isoBirthDate = d.toISOString();
      }
    }

    const payload: Partial<Student> = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      studentName: fullCleanName,
      fullName: metatBus ? `${fullCleanName}*` : fullCleanName,
      studentNo: studentNo.trim(),
      grade: grade.trim(),
      gender,
      birthDate: isoBirthDate,
      active,
      metatBus,

      schoolId: Number(schoolId),
      schoolName,
      routes: routes.trim(),
      studentAddress: studentAddress.trim(),
      studentPhone: studentPhone.trim(),

      stops,

      contacts: validContacts,
      studentEmergencyPhone: emergencyPhone.trim(),
      studentEmergencyAddress: emergencyAddress.trim(),
      equipments: equipments.trim(),
      studentDispatchNotes: studentDispatchNotes.trim(),
      studentSchoolNotes: studentSchoolNotes.trim()
    };

    try {
      setLoading(true);
      await onSave(payload);
      onClose();
    } catch (err: any) {
      console.error('Save student failed:', err);
      alert(`Failed to save student: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const gradeOptions = ['JK', 'SK', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl my-8">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 font-bold">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                {initialData ? `Edit Student: ${initialData.fullName || initialData.studentName || 'Student'}` : 'Register New Student'}
              </h2>
              <p className="text-xs text-slate-400">
                {initialData ? `Updating record #${initialData.studentNo || initialData.id}` : 'Add student to dispatch and bus route roster'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 px-5 bg-slate-950/30 overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`py-3 px-3 font-semibold border-b-2 flex items-center space-x-1.5 whitespace-nowrap transition ${
              activeTab === 'profile'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Profile & Grade</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('school')}
            className={`py-3 px-3 font-semibold border-b-2 flex items-center space-x-1.5 whitespace-nowrap transition ${
              activeTab === 'school'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <SchoolIcon className="w-3.5 h-3.5" />
            <span>School & Route</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stops')}
            className={`py-3 px-3 font-semibold border-b-2 flex items-center space-x-1.5 whitespace-nowrap transition ${
              activeTab === 'stops'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>{t.stops?.title || 'Stops'} ({stops.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('contacts')}
            className={`py-3 px-3 font-semibold border-b-2 flex items-center space-x-1.5 whitespace-nowrap transition ${
              activeTab === 'contacts'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Guardians & Contacts ({contacts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('care')}
            className={`py-3 px-3 font-semibold border-b-2 flex items-center space-x-1.5 whitespace-nowrap transition ${
              activeTab === 'care'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HeartPulse className="w-3.5 h-3.5" />
            <span>Care Plan & Notes</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 max-h-[68vh] overflow-y-auto space-y-4">
            {/* TAB 1: BASIC PROFILE */}
            {activeTab === 'profile' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      First Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g. John"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-sky-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Last Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="e.g. Doe"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-sky-500 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Student ID / Number <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={studentNo}
                      onChange={(e) => setStudentNo(e.target.value)}
                      placeholder="e.g. 0001"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-sky-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Grade Level
                    </label>
                    <select
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500 transition"
                    >
                      {gradeOptions.map((g) => (
                        <option key={g} value={g}>
                          Grade {g}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Gender
                    </label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500 transition"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                      <option value="Unspecified">Unspecified</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Birth Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-sky-500 transition"
                  />
                </div>

                {/* Status Toggles */}
                <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/40 border border-slate-800">
                    <div>
                      <div className="text-xs font-semibold text-white">Active Student Rider</div>
                      <div className="text-[11px] text-slate-400">Currently enrolled in active bus service</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={(e) => setActive(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
                    <div>
                      <div className="text-xs font-semibold text-amber-300 flex items-center space-x-1">
                        <span>★ Met at Bus Required</span>
                      </div>
                      <div className="text-[11px] text-slate-400">Driver must verify adult hand-off</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={metatBus}
                        onChange={(e) => setMetatBus(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: SCHOOL & ROUTES */}
            {activeTab === 'school' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Attending School Campus <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={schoolId}
                    onChange={(e) => setSchoolId(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500 transition"
                  >
                    {(schools || []).map((sch) => (
                      <option key={sch.schoolId} value={sch.schoolId}>
                        {sch.schoolName} ({sch.schoolBoardCode || `ID #${sch.schoolId}`})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Assigned Bus Routes
                    </label>
                    <span className="inline-flex items-center space-x-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60 font-medium">
                      <Lock className="w-3 h-3 text-slate-400" />
                      <span>Fixed</span>
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      value={routes || 'No Route Assigned'}
                      className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3.5 py-2 text-sm text-slate-300 font-mono focus:outline-none cursor-not-allowed select-none pr-8"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                      <Lock className="w-4 h-4" />
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    {t.stops?.routesLockedNotice || 'Assigned bus routes cannot be modified directly here. They are assigned through dispatch route scheduling.'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Home Address (Pickup/Dropoff)
                    </label>
                    <input
                      type="text"
                      value={studentAddress}
                      onChange={(e) => setStudentAddress(e.target.value)}
                      placeholder="e.g. 123 Main St, Ottawa, ON"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-sky-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Student Phone (if applicable)
                    </label>
                    <input
                      type="tel"
                      value={studentPhone}
                      onChange={(e) => setStudentPhone(e.target.value)}
                      placeholder="e.g. 613-555-0199"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-sky-500 transition"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB: STOPS & ITINERARY (MATCHING ROUTE STOP SCHEDULE) */}
            {activeTab === 'stops' && (
              <div className="space-y-4">
                {/* Header Context Banner matching screenshot */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-sky-500/10 border border-sky-500/20">
                  <div>
                    <div className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center space-x-2">
                      <Bus className="w-4 h-4" />
                      <span>
                        {t.stops?.studentsForRoute || 'Students for Route'}: {routes || 'No Route Assigned'}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-white mt-1 flex items-center space-x-2">
                      <span>{firstName || lastName ? `${firstName} ${lastName}${metatBus ? '*' : ''}` : 'Student Itinerary'}</span>
                      {currentSchoolName && (
                        <span className="text-xs text-slate-400 font-normal">
                          • {currentSchoolName}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenAddStop}
                    className="px-3.5 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl transition flex items-center space-x-1.5 self-start sm:self-auto shadow-md shadow-sky-500/10"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t.stops?.addStop || 'Add Stop'}</span>
                  </button>
                </div>

                {/* Stops Table matching image layout */}
                <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/40">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-3.5 whitespace-nowrap">{t.stops?.time || 'Time'}</th>
                        <th className="py-3 px-3 whitespace-nowrap">{t.stops?.type || 'Type'}</th>
                        <th className="py-3 px-3 whitespace-nowrap">{t.stops?.opDays || 'Op Days'}</th>
                        <th className="py-3 px-3 min-w-[200px]">{t.stops?.location || 'Location'}</th>
                        <th className="py-3 px-3 whitespace-nowrap">{t.stops?.comment || 'Comment'}</th>
                        <th className="py-3 px-3 whitespace-nowrap">{t.stops?.instruction || 'Instruction'}</th>
                        <th className="py-3 px-3 whitespace-nowrap">{t.stops?.route || 'Route'}</th>
                        <th className="py-3 px-3 whitespace-nowrap">{t.stops?.shift || 'Shift'}</th>
                        <th className="py-3 px-3 text-right whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {stops.map((stop, idx) => (
                        <tr
                          key={stop.stopId || idx}
                          className="hover:bg-slate-800/40 transition group"
                        >
                          <td className="py-2.5 px-3.5 font-semibold text-white whitespace-nowrap">
                            <div className="flex items-center space-x-1.5">
                              <Clock className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                              <span className="font-mono">{stop.time}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                                stop.type.toLowerCase().includes('pickup')
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                              }`}
                            >
                              {stop.type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                            {stop.opDays}
                          </td>
                          <td className="py-2.5 px-3 text-slate-200 max-w-xs truncate" title={stop.location}>
                            <div className="flex items-center space-x-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                              <span className="truncate">{stop.location}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-amber-300 font-mono text-[11px] whitespace-nowrap">
                            {stop.comment ? (
                              <span className="bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-medium">
                                {stop.comment}
                              </span>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 text-[11px] max-w-xs truncate">
                            {stop.instruction || <span className="text-slate-600">-</span>}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-sky-300 whitespace-nowrap">
                            {stop.route || <span className="text-slate-600">-</span>}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold">
                              {stop.shift || 'AM'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            {isSchoolStop(stop.type) ? (
                              <span
                                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800/80 text-slate-500 text-[10px] font-semibold border border-slate-700/60 cursor-not-allowed select-none"
                                title={t.stops?.schoolStopNotice || 'School stops cannot be edited'}
                              >
                                <Lock className="w-3 h-3 text-slate-500" />
                                <span>{t.stops?.schoolStopReadOnly || 'School Stop (Read-only)'}</span>
                              </span>
                            ) : (
                              <div className="flex items-center justify-end space-x-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditStop(idx)}
                                  className="p-1 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded transition"
                                  title={t.stops?.editStop || 'Edit stop'}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteStop(idx)}
                                  className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                                  title={t.stops?.deleteStop || 'Delete stop'}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}

                      {stops.length === 0 && (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-500">
                            {t.stops?.noStops || 'No scheduled stops configured for this student.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Pagination summary row matching screenshot */}
                  <div className="border-t border-slate-800 px-4 py-2 bg-slate-900/60 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center space-x-2">
                      <span>
                        1 - {stops.length} {t.stops?.ofTotal || 'of'} {stops.length} {t.stops?.items || 'items'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Click edit icon on any row to adjust time, address, or comment
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: MULTIPLE CONTACTS & GUARDIANS */}
            {activeTab === 'contacts' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-1">
                  <div>
                    <div className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center space-x-1.5">
                      <Users className="w-4 h-4" />
                      <span>Parents & Guardians Directory ({contacts.length})</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Manage multiple authorized parents, guardians, and emergency callers.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddContact}
                    className="px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-xl text-xs font-semibold transition flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Contact</span>
                  </button>
                </div>

                <div className="space-y-3.5">
                  {contacts.map((c, idx) => (
                    <div
                      key={c.contactId || idx}
                      className={`p-4 rounded-2xl border transition ${
                        c.primaryContact
                          ? 'bg-slate-900 border-indigo-500/40 shadow-sm'
                          : 'bg-slate-900/60 border-slate-800'
                      }`}
                    >
                      {/* Contact Card Header */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
                        <div className="flex items-center space-x-2">
                          <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 font-mono text-xs flex items-center justify-center font-bold">
                            #{idx + 1}
                          </span>
                          <span className="text-xs font-bold text-white">
                            {c.contactName ? c.contactName : `Contact #${idx + 1}`}
                          </span>
                          {c.relationship && (
                            <span className="text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700/60">
                              {c.relationship}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => handleSetPrimary(idx)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center space-x-1 ${
                              c.primaryContact
                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                                : 'text-slate-400 hover:text-slate-200 bg-slate-800 border border-slate-700'
                            }`}
                          >
                            <Star className={`w-3.5 h-3.5 ${c.primaryContact ? 'fill-indigo-400 text-indigo-400' : ''}`} />
                            <span>{c.primaryContact ? 'Primary Contact' : 'Set as Primary'}</span>
                          </button>

                          {contacts.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveContact(idx)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                              title="Delete this contact"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Contact Card Fields */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            Contact Full Name <span className="text-rose-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={c.contactName}
                            onChange={(e) => handleContactChange(idx, 'contactName', e.target.value)}
                            placeholder="e.g. Mary Doe"
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-sky-500 transition"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            Relationship
                          </label>
                          <input
                            type="text"
                            value={c.relationship || ''}
                            onChange={(e) => handleContactChange(idx, 'relationship', e.target.value)}
                            placeholder="e.g. Mother, Father, Guardian, Grandparent"
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-sky-500 transition"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            Mobile Phone
                          </label>
                          <input
                            type="tel"
                            value={c.mobilePhone || ''}
                            onChange={(e) => handleContactChange(idx, 'mobilePhone', e.target.value)}
                            placeholder="e.g. 613-555-0199"
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-sky-500 transition"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            Email Address
                          </label>
                          <input
                            type="email"
                            value={c.email || ''}
                            onChange={(e) => handleContactChange(idx, 'email', e.target.value)}
                            placeholder="e.g. parent@example.com"
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-sky-500 transition"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            Alternative Phone (Home / Work)
                          </label>
                          <input
                            type="tel"
                            value={c.homePhone || c.workPhone || ''}
                            onChange={(e) => handleContactChange(idx, 'homePhone', e.target.value)}
                            placeholder="e.g. 613-555-0100"
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-sky-500 transition"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            Address (leave blank if same as student)
                          </label>
                          <input
                            type="text"
                            value={c.address || ''}
                            onChange={(e) => handleContactChange(idx, 'address', e.target.value)}
                            placeholder="e.g. 456 Secondary St, Ottawa, ON"
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-sky-500 transition"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-slate-800/80">
                  <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Emergency Secondary Hotline & Address</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Emergency Phone
                      </label>
                      <input
                        type="tel"
                        value={emergencyPhone}
                        onChange={(e) => setEmergencyPhone(e.target.value)}
                        placeholder="e.g. 613-555-0188"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-sky-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Emergency Address
                      </label>
                      <input
                        type="text"
                        value={emergencyAddress}
                        onChange={(e) => setEmergencyAddress(e.target.value)}
                        placeholder="e.g. 456 Secondary Ave, Ottawa, ON"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-sky-500 transition"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: CARE PLAN & SPECIAL NOTES */}
            {activeTab === 'care' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Special Equipment / Safety Devices
                  </label>
                  <input
                    type="text"
                    value={equipments}
                    onChange={(e) => setEquipments(e.target.value)}
                    placeholder="e.g. Wheelchair, Booster Seat, Safety Harness, EpiPen"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-sky-500 transition"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Displays prominently on driver manifest and route sheets.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Dispatch Operations & Driver Care Plan
                  </label>
                  <textarea
                    rows={3}
                    value={studentDispatchNotes}
                    onChange={(e) => setStudentDispatchNotes(e.target.value)}
                    placeholder="e.g. Met by older sibling at stop; wait for adult signal before moving..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-sky-500 transition resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    School & Medical Notes
                  </label>
                  <textarea
                    rows={3}
                    value={studentSchoolNotes}
                    onChange={(e) => setStudentSchoolNotes(e.target.value)}
                    placeholder="e.g. Severe peanut allergy, requires front-row seating..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-sky-500 transition resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 transition flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{loading ? 'Saving...' : initialData ? 'Save Changes' : 'Register Student'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Stop Edit / Add Sub-modal */}
      {editingStopIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {editingStopIndex === -1 ? (t.stops?.addStop || 'Add Stop') : (t.stops?.editStop || 'Edit Stop')}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Configure stop schedule, location, and driver notes
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingStopIndex(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Route & Shift Parameters (Read-only / Governed by Dispatch Schedule) */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-400 flex items-center space-x-1.5 uppercase tracking-wider">
                    <Lock className="w-3 h-3 text-slate-500" />
                    <span>{t.stops?.fixedRouteDetails || 'Route & Shift Parameters (Fixed)'}</span>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                      stopFormType.toLowerCase().includes('pickup')
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                    }`}
                  >
                    {stopFormType}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/80">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">
                      {t.stops?.shift || 'Shift'}
                    </div>
                    <div className="font-mono font-bold text-white mt-0.5">
                      {stopFormShift || 'AM'}
                    </div>
                  </div>

                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/80">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">
                      {t.stops?.opDays || 'Op Days'}
                    </div>
                    <div className="font-mono font-bold text-slate-200 mt-0.5">
                      {stopFormOpDays || 'M T W R F'}
                    </div>
                  </div>

                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/80">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">
                      {t.stops?.route || 'Route'}
                    </div>
                    <div className="font-mono font-bold text-sky-400 mt-0.5 truncate" title={stopFormRoute}>
                      {stopFormRoute || 'No Route'}
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 flex items-center space-x-1 pt-0.5">
                  <Lock className="w-2.5 h-2.5 flex-shrink-0" />
                  <span>{t.stops?.routeShiftFixedNotice || 'Route, shift, and operating days cannot be modified directly. They are governed by the route schedule.'}</span>
                </div>
              </div>

              {/* Editable: Time */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  {t.stops?.time || 'Time'} <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={stopFormTime}
                    onChange={(e) => setStopFormTime(e.target.value)}
                    placeholder="e.g. 7:10 a.m."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-sky-500 pl-8"
                  />
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-300">
                    {t.stops?.location || 'Location / Address'} <span className="text-rose-400">*</span>
                  </label>
                  {studentAddress && (
                    <button
                      type="button"
                      onClick={() => setStopFormLocation(studentAddress)}
                      className="text-[10px] text-sky-400 hover:underline"
                    >
                      {t.stops?.useHomeAddress || 'Use Home Address'}
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={stopFormLocation}
                  onChange={(e) => setStopFormLocation(e.target.value)}
                  placeholder="e.g. 1405-3240 SOUTHLAND DR, GLOUCESTER"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  {t.stops?.comment || 'Comment'}
                </label>
                <input
                  type="text"
                  value={stopFormComment}
                  onChange={(e) => setStopFormComment(e.target.value)}
                  placeholder="e.g. C/O: METATBUS/P"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  {t.stops?.instruction || 'Instruction (Optional)'}
                </label>
                <input
                  type="text"
                  value={stopFormInstruction}
                  onChange={(e) => setStopFormInstruction(e.target.value)}
                  placeholder="e.g. Met at bus by parent"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingStopIndex(null)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveStopItem}
                className="px-4 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-xl transition text-xs font-bold shadow-md shadow-sky-500/20"
              >
                {t.stops?.saveStop || 'Save Stop'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Student to Route or Shift Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                  <Bus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {t.stops?.assignToRouteOrShift || 'Assign Student to Route or Shift'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Add student stops and itinerary across designated bus lines
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {assignError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{assignError}</div>
              </div>
            )}

            <div className="space-y-3.5 text-xs">
              {/* Route or Shift Search and Selection List */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-300">
                    {t.stops?.selectRouteOrShift || 'Select Route or Shift'} <span className="text-rose-400">*</span>
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {filteredAvailableRoutes.length} routes • {filteredAvailableShifts.length} shifts
                  </span>
                </div>

                {/* Search Box */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={routeShiftSearch}
                    onChange={(e) => setRouteShiftSearch(e.target.value)}
                    placeholder={t.stops?.searchRouteOrShiftPlaceholder || 'Search route or shift by number, name, type, days...'}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
                  />
                  {routeShiftSearch && (
                    <button
                      type="button"
                      onClick={() => setRouteShiftSearch('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white p-0.5 rounded transition"
                      title={t.stops?.clearSearch || 'Clear search'}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filtered Dropdown / Selection List */}
                <select
                  value={selectedTargetKey}
                  onChange={(e) => {
                    setSelectedTargetKey(e.target.value);
                    setAssignError(null);
                  }}
                  size={filteredAvailableRoutes.length + filteredAvailableShifts.length > 0 ? 5 : 2}
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl p-2 text-white font-medium focus:outline-none focus:border-sky-500 cursor-pointer overflow-y-auto text-xs"
                >
                  {filteredAvailableRoutes.length === 0 && filteredAvailableShifts.length === 0 ? (
                    <option disabled value="" className="py-2 text-slate-400 italic">
                      {t.stops?.noRoutesOrShiftsMatch || 'No routes or shifts match your search'}
                    </option>
                  ) : (
                    <>
                      {filteredAvailableRoutes.length > 0 && (
                        <optgroup label={`${t.stops?.routesGroup || 'Routes (All Shifts)'} (${filteredAvailableRoutes.length})`}>
                          {filteredAvailableRoutes.map((r) => (
                            <option key={r.id} value={`route:${r.id}:${r.routeNo}`} className="py-1">
                              Route {r.routeNo} — {r.routeName} ({t.stops?.allShifts || 'All Shifts'})
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {filteredAvailableShifts.length > 0 && (
                        <optgroup label={`${t.stops?.shiftsGroup || 'Individual Shifts'} (${filteredAvailableShifts.length})`}>
                          {filteredAvailableShifts.map((s) => (
                            <option key={s.id} value={`shift:${s.routeId}:${s.routeNo}:${s.id}`} className="py-1">
                              Shift {s.routeNo} • {s.shiftType} ({s.runDays}) {s.shiftSchools ? `— ${s.shiftSchools}` : ''}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </>
                  )}
                </select>
              </div>

              {/* Student Context Card */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Student Rider:</span>
                  <span className="font-bold text-white">
                    {firstName || lastName ? `${firstName} ${lastName}` : 'Current Student'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Home Address:</span>
                  <span className="font-mono text-slate-200 truncate max-w-[240px]" title={studentAddress}>
                    {studentAddress || 'Not entered'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Attending School:</span>
                  <span className="text-sky-300 font-semibold truncate max-w-[240px]" title={currentSchoolName}>
                    {currentSchoolName || 'Not assigned'}
                  </span>
                </div>
              </div>

              {/* Notice & Calculation Info */}
              <div className="p-2.5 rounded-xl bg-sky-500/5 border border-sky-500/15 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center space-x-1.5 text-sky-400 font-semibold">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Automatic Dispatch Stop Rules</span>
                </div>
                <p>
                  {t.stops?.travelEstimateNotice || 'Pickup and dropoff times are calculated using the 28-minute transit estimate to/from school.'}
                </p>
                <p className="text-slate-500">
                  If the shift already includes a stop with the student's address, the student will be added to that existing stop.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={assigning}
                onClick={handleConfirmAssign}
                className="px-4 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-xl transition text-xs font-bold shadow-md shadow-sky-500/20 disabled:opacity-50 flex items-center space-x-1.5"
              >
                <span>{assigning ? 'Assigning...' : (t.stops?.assignButton || 'Assign & Generate Stops')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
