import React, { useState, useEffect } from 'react';
import { School, SchoolBoard } from '../../types/school';
import { X, School as SchoolIcon, Clock, MapPin, Check } from 'lucide-react';

interface SchoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (schoolData: Partial<School>) => Promise<void>;
  initialData?: School | null;
  boards: SchoolBoard[];
}

export const SchoolModal: React.FC<SchoolModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  boards
}) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'schedule' | 'contact' | 'notes'>('basic');

  // Basic Info
  const [schoolName, setSchoolName] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [schoolBoardId, setSchoolBoardId] = useState<number>(5);
  const [isActive, setIsActive] = useState(true);

  // Bell Schedules
  const [startTime, setStartTime] = useState('08:30');
  const [dismissalTime, setDismissalTime] = useState('15:00');
  const [earlyDismissalDay, setEarlyDismissalDay] = useState('');
  const [earlyDismissalTime, setEarlyDismissalTime] = useState('');

  // Contacts
  const [schoolPhone, setSchoolPhone] = useState('');
  const [schoolFax, setSchoolFax] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPersonCellPhone, setContactPersonCellPhone] = useState('');
  const [contactPersonEmail, setContactPersonEmail] = useState('');

  // Location & Notes
  const [gpsLatitude, setGpsLatitude] = useState<number | undefined>(45.4215);
  const [gpsLongitude, setGpsLongitude] = useState<number | undefined>(-75.6972);
  const [parkingNotes, setParkingNotes] = useState('');
  const [schoolNotes, setSchoolNotes] = useState('');

  useEffect(() => {
    if (initialData) {
      setSchoolName(initialData.schoolName || '');
      setSchoolAddress(initialData.schoolAddress || '');
      setSchoolBoardId(initialData.schoolBoardId || (boards[0]?.schoolBoardId ?? 5));
      setIsActive(initialData.isActive ?? true);

      setStartTime(initialData.startTime || '08:30');
      setDismissalTime(initialData.dismissalTime || '15:00');
      setEarlyDismissalDay(initialData.earlyDismissalDay || '');
      setEarlyDismissalTime(initialData.earlyDismissalTime || '');

      setSchoolPhone(initialData.schoolPhone || '');
      setSchoolFax(initialData.schoolFax || '');
      setContactPerson(initialData.contactPerson || '');
      setContactPersonCellPhone(initialData.contactPersonCellPhone || '');
      setContactPersonEmail(initialData.contactPersonEmail || '');

      setGpsLatitude(initialData.gpsLatitude);
      setGpsLongitude(initialData.gpsLongitude);
      setParkingNotes(initialData.parkingNotes || '');
      setSchoolNotes(initialData.schoolNotes || '');
    } else {
      setSchoolName('');
      setSchoolAddress('');
      setSchoolBoardId(boards[0]?.schoolBoardId ?? 5);
      setIsActive(true);

      setStartTime('08:30');
      setDismissalTime('15:00');
      setEarlyDismissalDay('');
      setEarlyDismissalTime('');

      setSchoolPhone('');
      setSchoolFax('');
      setContactPerson('');
      setContactPersonCellPhone('');
      setContactPersonEmail('');

      setGpsLatitude(45.4215);
      setGpsLongitude(-75.6972);
      setParkingNotes('');
      setSchoolNotes('');
    }
    setActiveTab('basic');
  }, [initialData, isOpen, boards]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const selectedBoard = boards.find(b => b.schoolBoardId === Number(schoolBoardId));

    try {
      await onSave({
        schoolName: schoolName.trim(),
        schoolAddress: schoolAddress.trim(),
        schoolBoardId: Number(schoolBoardId),
        schoolBoardName: selectedBoard?.schoolBoardName || '',
        schoolBoardCode: selectedBoard?.schoolBoardCode || '',
        isActive,
        startTime,
        dismissalTime,
        earlyDismissalDay: earlyDismissalDay || undefined,
        earlyDismissalTime: earlyDismissalTime || undefined,
        schoolPhone: schoolPhone.trim() || undefined,
        schoolFax: schoolFax.trim() || undefined,
        contactPerson: contactPerson.trim() || undefined,
        contactPersonCellPhone: contactPersonCellPhone.trim() || undefined,
        contactPersonEmail: contactPersonEmail.trim() || undefined,
        gpsLatitude: gpsLatitude ? Number(gpsLatitude) : undefined,
        gpsLongitude: gpsLongitude ? Number(gpsLongitude) : undefined,
        parkingNotes: parkingNotes.trim() || undefined,
        schoolNotes: schoolNotes.trim() || undefined,
        studentNum: initialData?.studentNum || 0
      });
      onClose();
    } catch (err) {
      console.error('Failed to save school:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 text-slate-100 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <SchoolIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {initialData ? `Edit School: ${initialData.schoolName}` : 'Add New School Campus'}
              </h3>
              <p className="text-xs text-slate-400">Master School Registry & Bell Timetables</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center space-x-1 border-b border-slate-800 pt-3 pb-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('basic')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'basic'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            General Profile
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('schedule')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'schedule'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Bell Schedules
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('contact')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'contact'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Administration & Contact
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('notes')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'notes'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Bus Loop & Notes
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* TAB 1: BASIC PROFILE */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  School Name *
                </label>
                <input
                  type="text"
                  required
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="e.g. Lisgar Collegiate Institute"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500 transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    School Board Authority *
                  </label>
                  <select
                    value={schoolBoardId}
                    onChange={(e) => setSchoolBoardId(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500 transition"
                  >
                    {boards.map((b) => (
                      <option key={b.schoolBoardId} value={b.schoolBoardId}>
                        {b.schoolBoardCode} - {b.schoolBoardName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Operational Status
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsActive(!isActive)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-bold transition ${
                      isActive
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    }`}
                  >
                    <span>{isActive ? 'Active Campus' : 'Inactive / Closed'}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800">
                      Click to toggle
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Campus Street Address *
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={schoolAddress}
                    onChange={(e) => setSchoolAddress(e.target.value)}
                    placeholder="e.g. 29 Lisgar St, Ottawa, ON K2P 0B9"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    GPS Latitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={gpsLatitude ?? ''}
                    onChange={(e) => setGpsLatitude(e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="45.4215"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500 transition font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    GPS Longitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={gpsLongitude ?? ''}
                    onChange={(e) => setGpsLongitude(e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="-75.6972"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500 transition font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SCHEDULE */}
          {activeTab === 'schedule' && (
            <div className="space-y-4">
              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 flex items-start space-x-3">
                <Clock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300">
                  <p className="font-semibold text-white">Daily Dispatch Bell Timetable</p>
                  <p className="text-slate-400 mt-0.5">
                    Routes and shift assignments calculate run start times based on morning entry bell and afternoon dismissal.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Morning Start Bell (Entry Time) *
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500 transition font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Afternoon Dismissal Bell (Exit Time) *
                  </label>
                  <input
                    type="time"
                    required
                    value={dismissalTime}
                    onChange={(e) => setDismissalTime(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500 transition font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
                  Early Dismissal Schedule (Optional)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Early Dismissal Day
                    </label>
                    <select
                      value={earlyDismissalDay}
                      onChange={(e) => setEarlyDismissalDay(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500 transition"
                    >
                      <option value="">No early dismissal</option>
                      <option value="Monday">Every Monday</option>
                      <option value="Tuesday">Every Tuesday</option>
                      <option value="Wednesday">Every Wednesday</option>
                      <option value="Thursday">Every Thursday</option>
                      <option value="Friday">Every Friday</option>
                      <option value="Last Friday of Month">Last Friday of Month</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Early Dismissal Time
                    </label>
                    <input
                      type="time"
                      value={earlyDismissalTime}
                      onChange={(e) => setEarlyDismissalTime(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500 transition font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CONTACTS */}
          {activeTab === 'contact' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Main Office Phone
                  </label>
                  <input
                    type="text"
                    value={schoolPhone}
                    onChange={(e) => setSchoolPhone(e.target.value)}
                    placeholder="613-555-0100"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    School Fax
                  </label>
                  <input
                    type="text"
                    value={schoolFax}
                    onChange={(e) => setSchoolFax(e.target.value)}
                    placeholder="613-555-0101"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500 transition"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 space-y-4">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Designated Dispatch Contact / Principal
                </h4>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Contact Person Name
                  </label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="e.g. Principal Jane Doe / VP Operations"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500 transition"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Direct Mobile / Emergency Phone
                    </label>
                    <input
                      type="text"
                      value={contactPersonCellPhone}
                      onChange={(e) => setContactPersonCellPhone(e.target.value)}
                      placeholder="613-555-0199"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Contact Email
                    </label>
                    <input
                      type="email"
                      value={contactPersonEmail}
                      onChange={(e) => setContactPersonEmail(e.target.value)}
                      placeholder="principal@school.ca"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500 transition"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BUS LOOP & NOTES */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Bus Loading Zone & Parking Directions
                </label>
                <textarea
                  rows={3}
                  value={parkingNotes}
                  onChange={(e) => setParkingNotes(e.target.value)}
                  placeholder="e.g. Dedicated bus drop-off loop located at West Gate. Do not block emergency lane."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  School Dispatch & Access Notes
                </label>
                <textarea
                  rows={3}
                  value={schoolNotes}
                  onChange={(e) => setSchoolNotes(e.target.value)}
                  placeholder="e.g. Main office intercom required before 08:15 AM. Special education vans park at Door 4."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500 transition"
                />
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <div className="text-[10px] text-slate-500">
              * Required fields. All changes sync in real-time.
            </div>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center space-x-1.5 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{loading ? 'Saving...' : initialData ? 'Update School' : 'Create School'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
