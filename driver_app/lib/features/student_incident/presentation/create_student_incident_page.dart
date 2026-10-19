import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import '../../../core/theme.dart';
import '../../../core/feedback_utils.dart';
import '../../dispatch/repository/dispatch_repository.dart';
import '../bloc/student_incident_bloc.dart';
import '../bloc/student_incident_event.dart';
import '../bloc/student_incident_state.dart';
import '../models/student_incident_model.dart';
import '../repository/student_incident_repository.dart';

class CreateStudentIncidentPage extends StatelessWidget {
  final String driverId;
  final String driverName;
  final String defaultRouteNo;
  final String defaultRouteName;

  const CreateStudentIncidentPage({
    super.key,
    required this.driverId,
    required this.driverName,
    this.defaultRouteNo = '',
    this.defaultRouteName = '',
  });

  @override
  Widget build(BuildContext context) {
    StudentIncidentBloc? existingBloc;
    try {
      existingBloc = context.read<StudentIncidentBloc>();
    } catch (_) {
      existingBloc = null;
    }

    final view = _CreateStudentIncidentView(
      driverId: driverId,
      driverName: driverName,
      defaultRouteNo: defaultRouteNo,
      defaultRouteName: defaultRouteName,
    );

    if (existingBloc != null) {
      return view;
    }

    return BlocProvider<StudentIncidentBloc>(
      create: (ctx) => StudentIncidentBloc(
        repository: ctx.read<StudentIncidentRepository>(),
      ),
      child: view,
    );
  }
}

class _CreateStudentIncidentView extends StatefulWidget {
  final String driverId;
  final String driverName;
  final String defaultRouteNo;
  final String defaultRouteName;

  const _CreateStudentIncidentView({
    required this.driverId,
    required this.driverName,
    required this.defaultRouteNo,
    required this.defaultRouteName,
  });

  @override
  State<_CreateStudentIncidentView> createState() =>
      _CreateStudentIncidentViewState();
}

class _CreateStudentIncidentViewState
    extends State<_CreateStudentIncidentView> {
  final _formKey = GlobalKey<FormState>();

  // Date and Time
  DateTime _incidentDate = DateTime.now();
  TimeOfDay _incidentTime = TimeOfDay.now();

  // Student Roster
  List<RosterStudentOption> _rosterStudents = [];
  String? _selectedRosterKey;
  bool _manualStudentEntry = false;

  // Form Controllers
  final _studentNameCtrl = TextEditingController();
  final _studentNoCtrl = TextEditingController();
  final _gradeCtrl = TextEditingController();
  final _schoolNameCtrl = TextEditingController();
  final _routeNoCtrl = TextEditingController();
  final _routeNameCtrl = TextEditingController();
  int? _studentId;
  int? _schoolId;
  int? _routeId;
  String _shiftType = '';

  // Incident Details
  final Set<String> _selectedCategories = {};
  final _typeOtherCtrl = TextEditingController();
  final _locationCtrl = TextEditingController();
  final _descriptionCtrl = TextEditingController();
  final _otherStudentsCtrl = TextEditingController();
  final _witnessesCtrl = TextEditingController();
  final _immediateActionCtrl = TextEditingController();

  // Safety & Notification Checkpoints
  bool _studentRemovedFromBus = false;
  bool _firstAidRequired = false;
  bool _parentsNotified = false;
  final _parentsDetailCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _routeNoCtrl.text = widget.defaultRouteNo;
    _routeNameCtrl.text = widget.defaultRouteName;
    _locationCtrl.text = 'On School Bus';

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadRosterForDate(_incidentDate);
    });
  }

  @override
  void dispose() {
    _studentNameCtrl.dispose();
    _studentNoCtrl.dispose();
    _gradeCtrl.dispose();
    _schoolNameCtrl.dispose();
    _routeNoCtrl.dispose();
    _routeNameCtrl.dispose();
    _typeOtherCtrl.dispose();
    _locationCtrl.dispose();
    _descriptionCtrl.dispose();
    _otherStudentsCtrl.dispose();
    _witnessesCtrl.dispose();
    _immediateActionCtrl.dispose();
    _parentsDetailCtrl.dispose();
    super.dispose();
  }

  void _loadRosterForDate(DateTime date) {
    try {
      final dispatchRepo = context.read<DispatchRepository>();
      final incidentRepo = context.read<StudentIncidentRepository>();
      final options = incidentRepo.getRosterStudentsFromDispatches(
        date: date,
        driverId: widget.driverId,
        dispatchRepo: dispatchRepo,
      );

      setState(() {
        _rosterStudents = options;
        if (options.isNotEmpty && !_manualStudentEntry) {
          if (_selectedRosterKey == null ||
              !options.any((o) => o.key == _selectedRosterKey)) {
            _selectedRosterKey = options.first.key;
            _applyRosterSelection(options.first);
          }
        } else if (options.isEmpty) {
          _manualStudentEntry = true;
          _selectedRosterKey = null;
        }
      });
    } catch (e) {
      debugPrint('[CreateStudentIncidentPage] Error loading roster: $e');
    }
  }

  void _applyRosterSelection(RosterStudentOption opt) {
    _studentId = opt.studentId;
    _studentNoCtrl.text = opt.studentNo;
    _studentNameCtrl.text = opt.studentName;
    _gradeCtrl.text = opt.grade;
    _schoolNameCtrl.text = opt.schoolName;
    _routeNoCtrl.text = opt.routeNo;
    _routeNameCtrl.text = opt.routeName ?? '';
    _routeId = opt.routeId;
    _shiftType = opt.shiftType ?? '';
  }

  Future<void> _selectDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _incidentDate,
      firstDate: DateTime.now().subtract(const Duration(days: 30)),
      lastDate: DateTime.now(),
    );
    if (picked != null && picked != _incidentDate) {
      setState(() {
        _incidentDate = picked;
      });
      _loadRosterForDate(picked);
    }
  }

  Future<void> _selectTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _incidentTime,
    );
    if (picked != null && picked != _incidentTime) {
      setState(() {
        _incidentTime = picked;
      });
    }
  }

  void _submitIncident() {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    if (_selectedCategories.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select at least one incident category.'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    final dateStr = DateFormat('yyyy-MM-dd').format(_incidentDate);
    final timeStr =
        '${_incidentTime.hour.toString().padLeft(2, '0')}:${_incidentTime.minute.toString().padLeft(2, '0')}';

    final incident = StudentIncident(
      id: '',
      incidentDate: dateStr,
      incidentTime: timeStr,
      studentId: _studentId ?? 0,
      studentNo: _studentNoCtrl.text.trim(),
      studentName: _studentNameCtrl.text.trim(),
      grade: _gradeCtrl.text.trim(),
      schoolId: _schoolId,
      schoolName: _schoolNameCtrl.text.trim(),
      routeId: _routeId,
      routeNo: _routeNoCtrl.text.trim(),
      routeName: _routeNameCtrl.text.trim(),
      shiftType: _shiftType,
      driverId: widget.driverId,
      driverName: widget.driverName,
      location: _locationCtrl.text.trim(),
      incidentTypes: _selectedCategories.toList(),
      typeOther: _typeOtherCtrl.text.trim(),
      description: _descriptionCtrl.text.trim(),
      otherStudentsInvolved: _otherStudentsCtrl.text.trim(),
      witnesses: _witnessesCtrl.text.trim(),
      immediateActionTaken: _immediateActionCtrl.text.trim(),
      studentRemovedFromBus: _studentRemovedFromBus,
      firstAidRequired: _firstAidRequired,
      parentsNotified: _parentsNotified,
      parentsNotificationDetail: _parentsDetailCtrl.text.trim(),
      status: StudentIncidentStatus.submitted,
      createdAt: DateTime.now().toUtc(),
      updatedAt: DateTime.now().toUtc(),
    );

    context.read<StudentIncidentBloc>().add(
          SubmitStudentIncidentEvent(incident),
        );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return BlocListener<StudentIncidentBloc, StudentIncidentState>(
      listener: (context, state) {
        if (state is StudentIncidentSubmitSuccess) {
          AppFeedback.showSuccess(
            context,
            message: 'Student incident report submitted successfully.',
          );
          Navigator.of(context).pop(true);
        } else if (state is StudentIncidentSubmitFailure) {
          AppFeedback.showError(
            context,
            title: 'Incident Report Submission Failed',
            message: state.error,
          );
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Report Student Incident'),
          elevation: 0,
        ),
        body: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
            children: [
              // ─── Header Info Card ───────────────────────────────────────
              _buildHeaderCard(isDark),
              const SizedBox(height: 16),

              // ─── Step 1: Date & Time ─────────────────────────────────────
              _buildDateTimeCard(isDark),
              const SizedBox(height: 16),

              // ─── Step 2: Student Selection ──────────────────────────────
              _buildStudentCard(isDark),
              const SizedBox(height: 16),

              // ─── Step 3: Incident Categories ─────────────────────────────
              _buildCategoriesCard(isDark),
              const SizedBox(height: 16),

              // ─── Step 4: Incident Details ────────────────────────────────
              _buildIncidentDetailsCard(isDark),
              const SizedBox(height: 16),

              // ─── Step 5: Safety & Notification Checks ───────────────────
              _buildSafetyChecksCard(isDark),
              const SizedBox(height: 24),

              // ─── Submit Button ──────────────────────────────────────────
              _buildSubmitButton(isDark),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeaderCard(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFD97706).withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: const Color(0xFFD97706).withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.shield_outlined,
            color: Color(0xFFD97706),
            size: 28,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Driver Student Incident Report',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Reporting Driver: ${widget.driverName.isNotEmpty ? widget.driverName : widget.driverId}',
                  style: TextStyle(
                    fontSize: 13,
                    color: isDark ? Colors.grey[300] : Colors.grey[700],
                  ),
                ),
                Text(
                  'All reports are sent to Dispatch and School Administration for review.',
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? Colors.grey[400] : Colors.grey[600],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDateTimeCard(bool isDark) {
    final dateStr = DateFormat('EEE, MMM d, yyyy').format(_incidentDate);
    final timeStr = _incidentTime.format(context);

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.calendar_today, size: 18, color: Color(0xFF2563EB)),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '1. DATE & TIME OF INCIDENT',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _selectDate,
                    icon: const Icon(Icons.date_range, size: 18),
                    label: Text(
                      dateStr,
                      style: const TextStyle(fontSize: 13),
                    ),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                        vertical: 12,
                        horizontal: 10,
                      ),
                      alignment: Alignment.centerLeft,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _selectTime,
                    icon: const Icon(Icons.access_time, size: 18),
                    label: Text(
                      timeStr,
                      style: const TextStyle(fontSize: 13),
                    ),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                        vertical: 12,
                        horizontal: 10,
                      ),
                      alignment: Alignment.centerLeft,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStudentCard(bool isDark) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Expanded(
                  child: Row(
                    children: [
                      Icon(Icons.person_outline, size: 18, color: Color(0xFF2563EB)),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          '2. STUDENT INFORMATION',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                TextButton(
                  onPressed: () {
                    setState(() {
                      _manualStudentEntry = !_manualStudentEntry;
                      if (_manualStudentEntry) {
                        _selectedRosterKey = null;
                      } else if (_rosterStudents.isNotEmpty) {
                        _selectedRosterKey = _rosterStudents.first.key;
                        _applyRosterSelection(_rosterStudents.first);
                      }
                    });
                  },
                  child: Text(
                    _manualStudentEntry
                        ? 'Select from Roster'
                        : 'Manual Entry',
                    style: const TextStyle(fontSize: 12),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),

            // Roster Dropdown if active and available
            if (!_manualStudentEntry && _rosterStudents.isNotEmpty) ...[
              const Text(
                'Select student from today\'s assigned manifest:',
                style: TextStyle(fontSize: 12, color: Colors.grey),
              ),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: isDark
                        ? AppColors.darkCardBorder
                        : AppColors.lightCardBorder,
                  ),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    isExpanded: true,
                    value: _selectedRosterKey,
                    items: _rosterStudents.map((stu) {
                      return DropdownMenuItem<String>(
                        value: stu.key,
                        child: Text(
                          '${stu.studentName} (${stu.displaySubtitle})',
                          style: const TextStyle(fontSize: 13),
                          overflow: TextOverflow.ellipsis,
                        ),
                      );
                    }).toList(),
                    onChanged: (key) {
                      if (key == null) return;
                      final match = _rosterStudents.firstWhere((s) => s.key == key);
                      setState(() {
                        _selectedRosterKey = key;
                        _applyRosterSelection(match);
                      });
                    },
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],

            if (_rosterStudents.isEmpty && !_manualStudentEntry) ...[
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.amber.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.info_outline, size: 16, color: Colors.amber),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'No student manifest found for selected date. Using manual entry.',
                        style: TextStyle(fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],

            // Student Name Field
            TextFormField(
              controller: _studentNameCtrl,
              decoration: const InputDecoration(
                labelText: 'Student Full Name *',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.badge_outlined, size: 20),
                isDense: true,
              ),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Student name is required' : null,
            ),
            const SizedBox(height: 12),

            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _gradeCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Grade / Class',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _studentNoCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Student # (Optional)',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // School Name Field
            TextFormField(
              controller: _schoolNameCtrl,
              decoration: const InputDecoration(
                labelText: 'School Name',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.school_outlined, size: 20),
                isDense: true,
              ),
            ),
            const SizedBox(height: 12),

            // Route Number & Name
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _routeNoCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Route # *',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                    validator: (v) =>
                        (v == null || v.trim().isEmpty) ? 'Route # required' : null,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _routeNameCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Route Name (Optional)',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCategoriesCard(bool isDark) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.category_outlined, size: 18, color: Color(0xFF2563EB)),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '3. INCIDENT CATEGORIES (SELECT ALL THAT APPLY) *',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: IncidentCategoryConstants.categoryLabels.entries.map((e) {
                final isSelected = _selectedCategories.contains(e.key);
                return FilterChip(
                  label: Text(e.value),
                  selected: isSelected,
                  selectedColor: const Color(0xFF2563EB).withValues(alpha: 0.18),
                  checkmarkColor: const Color(0xFF2563EB),
                  labelStyle: TextStyle(
                    fontSize: 13,
                    color: isSelected
                        ? const Color(0xFF2563EB)
                        : (isDark ? Colors.white70 : Colors.black87),
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  ),
                  onSelected: (selected) {
                    setState(() {
                      if (selected) {
                        _selectedCategories.add(e.key);
                      } else {
                        _selectedCategories.remove(e.key);
                      }
                    });
                  },
                );
              }).toList(),
            ),

            if (_selectedCategories.contains('other')) ...[
              const SizedBox(height: 12),
              TextFormField(
                controller: _typeOtherCtrl,
                decoration: const InputDecoration(
                  labelText: 'Specify Other Category',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildIncidentDetailsCard(bool isDark) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.description_outlined,
                    size: 18, color: Color(0xFF2563EB)),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '4. INCIDENT DESCRIPTION & DETAILS',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Location
            TextFormField(
              controller: _locationCtrl,
              decoration: const InputDecoration(
                labelText: 'Specific Location (e.g. Row 5 aisle, Stop #3) *',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.location_on_outlined, size: 20),
                isDense: true,
              ),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Location is required' : null,
            ),
            const SizedBox(height: 12),

            // Description
            TextFormField(
              controller: _descriptionCtrl,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Detailed Description of What Occurred *',
                hintText:
                    'Describe the sequence of events clearly and objectively...',
                border: OutlineInputBorder(),
                alignLabelWithHint: true,
              ),
              validator: (v) => (v == null || v.trim().isEmpty)
                  ? 'Please provide a description of the incident'
                  : null,
            ),
            const SizedBox(height: 12),

            // Other Students Involved
            TextFormField(
              controller: _otherStudentsCtrl,
              decoration: const InputDecoration(
                labelText: 'Other Students Involved (Optional)',
                hintText: 'Names or seat numbers of other students',
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
            const SizedBox(height: 12),

            // Witnesses
            TextFormField(
              controller: _witnessesCtrl,
              decoration: const InputDecoration(
                labelText: 'Witnesses (Optional)',
                hintText: 'Students or monitor who witnessed the event',
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
            const SizedBox(height: 12),

            // Immediate Action Taken
            TextFormField(
              controller: _immediateActionCtrl,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Immediate Action Taken by Driver',
                hintText:
                    'e.g. Pulled bus over safely, separated students, reassigned seats',
                border: OutlineInputBorder(),
                alignLabelWithHint: true,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSafetyChecksCard(bool isDark) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.health_and_safety_outlined,
                    size: 18, color: Color(0xFF2563EB)),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '5. SAFETY & NOTIFICATION CHECKPOINTS',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Student Removed
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text(
                'Was student removed from the bus?',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
              ),
              subtitle: const Text(
                'e.g. Returned to school or picked up by authority',
                style: TextStyle(fontSize: 12, color: Colors.grey),
              ),
              value: _studentRemovedFromBus,
              onChanged: (val) => setState(() => _studentRemovedFromBus = val),
            ),
            const Divider(height: 1),

            // First Aid Required
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text(
                'Was first aid or medical attention required?',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
              ),
              subtitle: const Text(
                'Ice pack, bandage, or paramedic contacted',
                style: TextStyle(fontSize: 12, color: Colors.grey),
              ),
              value: _firstAidRequired,
              onChanged: (val) => setState(() => _firstAidRequired = val),
            ),
            const Divider(height: 1),

            // Parents Notified
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text(
                'Were parents / guardians notified by driver or monitor?',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
              ),
              value: _parentsNotified,
              onChanged: (val) => setState(() => _parentsNotified = val),
            ),

            if (_parentsNotified) ...[
              const SizedBox(height: 8),
              TextFormField(
                controller: _parentsDetailCtrl,
                decoration: const InputDecoration(
                  labelText: 'Parent Notification Details',
                  hintText: 'e.g. Phone call made at 3:45 PM, spoke with mother',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildSubmitButton(bool isDark) {
    return BlocBuilder<StudentIncidentBloc, StudentIncidentState>(
      builder: (context, state) {
        final isSubmitting = state is StudentIncidentSubmitting;

        return SizedBox(
          width: double.infinity,
          height: 48,
          child: ElevatedButton.icon(
            onPressed: isSubmitting ? null : _submitIncident,
            icon: isSubmitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.send_outlined, size: 20),
            label: Text(
              isSubmitting
                  ? 'Submitting Report...'
                  : 'Submit Student Incident Report',
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFD97706),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          ),
        );
      },
    );
  }
}
