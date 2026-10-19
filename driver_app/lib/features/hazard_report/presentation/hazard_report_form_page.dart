import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import '../../../core/theme.dart';
import '../../../core/feedback_utils.dart';
import '../../../core/widgets/attachment_picker_widget.dart';
import '../bloc/hazard_report_bloc.dart';
import '../bloc/hazard_report_event.dart';
import '../bloc/hazard_report_state.dart';
import '../models/hazard_report_model.dart';
import '../repository/hazard_report_repository.dart';

class HazardReportFormPage extends StatelessWidget {
  final String driverId;
  final String driverName;
  final String defaultRouteNo;
  final String defaultVehicleUnit;

  const HazardReportFormPage({
    super.key,
    required this.driverId,
    required this.driverName,
    this.defaultRouteNo = '',
    this.defaultVehicleUnit = '',
  });

  @override
  Widget build(BuildContext context) {
    HazardReportBloc? existingBloc;
    try {
      existingBloc = context.read<HazardReportBloc>();
    } catch (_) {
      existingBloc = null;
    }

    final view = _HazardReportFormView(
      driverId: driverId,
      driverName: driverName,
      defaultRouteNo: defaultRouteNo,
      defaultVehicleUnit: defaultVehicleUnit,
    );

    if (existingBloc != null) {
      return view;
    }

    return BlocProvider<HazardReportBloc>(
      create: (ctx) => HazardReportBloc(
        repository: ctx.read<HazardReportRepository>(),
      ),
      child: view,
    );
  }
}

class _HazardReportFormView extends StatefulWidget {
  final String driverId;
  final String driverName;
  final String defaultRouteNo;
  final String defaultVehicleUnit;

  const _HazardReportFormView({
    required this.driverId,
    required this.driverName,
    required this.defaultRouteNo,
    required this.defaultVehicleUnit,
  });

  @override
  State<_HazardReportFormView> createState() => _HazardReportFormViewState();
}

class _HazardReportFormViewState extends State<_HazardReportFormView> {
  final _formKey = GlobalKey<FormState>();

  late TextEditingController _routeController;
  late TextEditingController _unitController;
  late TextEditingController _phoneController;
  late TextEditingController _personInvolvedController;
  late TextEditingController _locationController;
  late TextEditingController _witnessesController;
  late TextEditingController _descriptionController;
  late TextEditingController _suggestionController;

  DateTime _eventDateTime = DateTime.now();

  // Hazard Type Checkboxes
  bool _trippingHazard = false;
  bool _trafficHazard = false;
  bool _equipmentHazard = false;
  bool _performanceHazard = false;
  bool _snowHazard = false;
  bool _spillHazard = false;
  bool _otherHazard = false;

  // Close Call Checkboxes
  bool _unsafeAction = false;
  bool _unsafeCondition = false;
  bool _happenedtoMe = false;
  bool _happenedtoSomeone = false;
  bool _ofanarea = false;
  bool _ofEquipment = false;

  List<String> _attachmentUrls = [];

  @override
  void initState() {
    super.initState();
    _routeController = TextEditingController(text: widget.defaultRouteNo);
    _unitController = TextEditingController(text: widget.defaultVehicleUnit);
    _phoneController = TextEditingController();
    _personInvolvedController = TextEditingController();
    _locationController = TextEditingController();
    _witnessesController = TextEditingController();
    _descriptionController = TextEditingController();
    _suggestionController = TextEditingController();
  }

  @override
  void dispose() {
    _routeController.dispose();
    _unitController.dispose();
    _phoneController.dispose();
    _personInvolvedController.dispose();
    _locationController.dispose();
    _witnessesController.dispose();
    _descriptionController.dispose();
    _suggestionController.dispose();
    super.dispose();
  }

  Future<void> _pickDateTime() async {
    final pickedDate = await showDatePicker(
      context: context,
      initialDate: _eventDateTime,
      firstDate: DateTime.now().subtract(const Duration(days: 90)),
      lastDate: DateTime.now().add(const Duration(days: 1)),
    );
    if (pickedDate == null || !mounted) return;

    final pickedTime = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_eventDateTime),
    );
    if (pickedTime == null || !mounted) return;

    setState(() {
      _eventDateTime = DateTime(
        pickedDate.year,
        pickedDate.month,
        pickedDate.day,
        pickedTime.hour,
        pickedTime.minute,
      );
    });
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;

    final atLeastOneSelected = _trippingHazard ||
        _trafficHazard ||
        _equipmentHazard ||
        _performanceHazard ||
        _snowHazard ||
        _spillHazard ||
        _otherHazard ||
        _unsafeAction ||
        _unsafeCondition ||
        _happenedtoMe ||
        _happenedtoSomeone ||
        _ofanarea ||
        _ofEquipment;

    if (!atLeastOneSelected) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select at least one hazard or close-call category.'),
          backgroundColor: AppColors.warning,
        ),
      );
      return;
    }

    final formattedEventTime =
        DateFormat('yyyy-MM-dd HH:mm').format(_eventDateTime);

    final report = HazardReportModel(
      id: '',
      reportedBy: widget.driverName,
      reportedByEmployeeId: widget.driverId,
      personInvolved: _personInvolvedController.text.trim().isNotEmpty
          ? _personInvolvedController.text.trim()
          : null,
      unitNumber: _unitController.text.trim().isNotEmpty
          ? _unitController.text.trim()
          : null,
      routeId: _routeController.text.trim().isNotEmpty
          ? _routeController.text.trim()
          : null,
      phone: _phoneController.text.trim().isNotEmpty
          ? _phoneController.text.trim()
          : null,
      eventTime: formattedEventTime,
      eventLocation: _locationController.text.trim().isNotEmpty
          ? _locationController.text.trim()
          : null,
      witnesses: _witnessesController.text.trim().isNotEmpty
          ? _witnessesController.text.trim()
          : null,
      eventDescription: _descriptionController.text.trim(),
      suggestion: _suggestionController.text.trim().isNotEmpty
          ? _suggestionController.text.trim()
          : null,
      trippingHazard: _trippingHazard,
      trafficHazard: _trafficHazard,
      equipmentHazard: _equipmentHazard,
      performanceHazard: _performanceHazard,
      snowHazard: _snowHazard,
      spillHazard: _spillHazard,
      otherHazard: _otherHazard,
      unsafeAction: _unsafeAction,
      unsafeCondition: _unsafeCondition,
      happenedtoMe: _happenedtoMe,
      happenedtoSomeone: _happenedtoSomeone,
      ofanarea: _ofanarea,
      ofEquipment: _ofEquipment,
      attachmentUrls: _attachmentUrls,
      createdAt: DateTime.now(),
    );

    context.read<HazardReportBloc>().add(SubmitHazardReport(report));
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return BlocListener<HazardReportBloc, HazardReportState>(
      listener: (context, state) {
        if (state is HazardReportSubmitSuccess) {
          AppFeedback.showSuccess(
            context,
            message: 'Hazard report submitted successfully to dispatch.',
          );
          Navigator.of(context).pop();
        } else if (state is HazardReportSubmitFailure) {
          AppFeedback.showError(
            context,
            title: 'Hazard Report Submission Failed',
            message: state.error,
          );
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text(
            'Report Safety Hazard',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          elevation: 0,
        ),
        body: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
            children: [
              // ─── Header Info Card ──────────────────────────────────────────
              _buildHeaderCard(isDark),
              const SizedBox(height: 18),

              // ─── Type of Hazard ───────────────────────────────────────────
              _buildHazardTypeCard(isDark),
              const SizedBox(height: 18),

              // ─── Type of Close Call / Near Miss ───────────────────────────
              _buildCloseCallCard(isDark),
              const SizedBox(height: 18),

              // ─── Event Date, Time & Location ───────────────────────────────
              _buildEventDetailsCard(isDark),
              const SizedBox(height: 18),

              // ─── Description of Event ──────────────────────────────────────
              _buildDescriptionCard(isDark),
              const SizedBox(height: 18),

              // ─── Photo Attachments ─────────────────────────────────────────
              AttachmentPickerWidget(
                initialUrls: _attachmentUrls,
                onAttachmentsChanged: (urls) {
                  setState(() {
                    _attachmentUrls = urls;
                  });
                },
              ),
              const SizedBox(height: 24),

              // ─── Submit Action Button ──────────────────────────────────────
              BlocBuilder<HazardReportBloc, HazardReportState>(
                builder: (context, state) {
                  final isSubmitting = state is HazardReportSubmitting;
                  return ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFD97706),
                      foregroundColor: Colors.white,
                      minimumSize: const Size.fromHeight(50),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      elevation: 2,
                    ),
                    onPressed: isSubmitting ? null : _submit,
                    icon: isSubmitting
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: AlwaysStoppedAnimation(Colors.white),
                            ),
                          )
                        : const Icon(Icons.send_rounded, size: 20),
                    label: Text(
                      isSubmitting ? 'Submitting Report...' : 'Submit Hazard Report',
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  );
                },
              ),
              const SizedBox(height: 32),
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
        color: isDark ? AppColors.darkCard : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFD97706).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.warning_amber_rounded,
                  color: Color(0xFFD97706),
                  size: 20,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.driverName,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      'Employee ID: ${widget.driverId}',
                      style: TextStyle(
                        fontSize: 11,
                        color: isDark
                            ? AppColors.textSecondaryDark
                            : AppColors.textSecondaryLight,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: _routeController,
                  decoration: const InputDecoration(
                    labelText: 'Route # (Optional)',
                    prefixIcon: Icon(Icons.alt_route_rounded, size: 18),
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextFormField(
                  controller: _unitController,
                  decoration: const InputDecoration(
                    labelText: 'Vehicle Unit #',
                    prefixIcon: Icon(Icons.directions_bus_rounded, size: 18),
                    isDense: true,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildHazardTypeCard(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'TYPE OF HAZARD',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.8,
              color: Color(0xFFD97706),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Select all hazards that apply to this situation:',
            style: TextStyle(
              fontSize: 11,
              color: isDark
                  ? AppColors.textSecondaryDark
                  : AppColors.textSecondaryLight,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _buildChoiceChip(
                label: 'Tripping Hazard',
                selected: _trippingHazard,
                onSelected: (v) => setState(() => _trippingHazard = v),
              ),
              _buildChoiceChip(
                label: 'Traffic Hazard',
                selected: _trafficHazard,
                onSelected: (v) => setState(() => _trafficHazard = v),
              ),
              _buildChoiceChip(
                label: 'Equipment Hazard',
                selected: _equipmentHazard,
                onSelected: (v) => setState(() => _equipmentHazard = v),
              ),
              _buildChoiceChip(
                label: 'Performance Hazard',
                selected: _performanceHazard,
                onSelected: (v) => setState(() => _performanceHazard = v),
              ),
              _buildChoiceChip(
                label: 'Snow, Ice or Road',
                selected: _snowHazard,
                onSelected: (v) => setState(() => _snowHazard = v),
              ),
              _buildChoiceChip(
                label: 'Spill',
                selected: _spillHazard,
                onSelected: (v) => setState(() => _spillHazard = v),
              ),
              _buildChoiceChip(
                label: 'Other Hazard',
                selected: _otherHazard,
                onSelected: (v) => setState(() => _otherHazard = v),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCloseCallCard(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'TYPE OF CLOSE CALL / NEAR MISS',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.8,
              color: Color(0xFF4F46E5),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Select context if this was a near-miss or unsafe condition:',
            style: TextStyle(
              fontSize: 11,
              color: isDark
                  ? AppColors.textSecondaryDark
                  : AppColors.textSecondaryLight,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _buildChoiceChip(
                label: 'Unsafe Action',
                selected: _unsafeAction,
                onSelected: (v) => setState(() => _unsafeAction = v),
                color: const Color(0xFF4F46E5),
              ),
              _buildChoiceChip(
                label: 'Unsafe Condition',
                selected: _unsafeCondition,
                onSelected: (v) => setState(() => _unsafeCondition = v),
                color: const Color(0xFF4F46E5),
              ),
              _buildChoiceChip(
                label: 'Happened to Me',
                selected: _happenedtoMe,
                onSelected: (v) => setState(() => _happenedtoMe = v),
                color: const Color(0xFF4F46E5),
              ),
              _buildChoiceChip(
                label: 'Happened to Someone',
                selected: _happenedtoSomeone,
                onSelected: (v) => setState(() => _happenedtoSomeone = v),
                color: const Color(0xFF4F46E5),
              ),
              _buildChoiceChip(
                label: 'Of an Area',
                selected: _ofanarea,
                onSelected: (v) => setState(() => _ofanarea = v),
                color: const Color(0xFF4F46E5),
              ),
              _buildChoiceChip(
                label: 'Of Equipment',
                selected: _ofEquipment,
                onSelected: (v) => setState(() => _ofEquipment = v),
                color: const Color(0xFF4F46E5),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildChoiceChip({
    required String label,
    required bool selected,
    required ValueChanged<bool> onSelected,
    Color color = const Color(0xFFD97706),
  }) {
    return FilterChip(
      label: Text(label),
      selected: selected,
      onSelected: onSelected,
      selectedColor: color.withValues(alpha: 0.18),
      checkmarkColor: color,
      labelStyle: TextStyle(
        fontSize: 12,
        fontWeight: selected ? FontWeight.bold : FontWeight.normal,
        color: selected ? color : null,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(
          color: selected ? color : Colors.grey.shade300,
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
    );
  }

  Widget _buildEventDetailsCard(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'EVENT INFORMATION',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.8,
              color: Colors.grey,
            ),
          ),
          const SizedBox(height: 12),
          InkWell(
            onTap: _pickDateTime,
            borderRadius: BorderRadius.circular(10),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              decoration: BoxDecoration(
                border: Border.all(color: Colors.grey.shade400),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  const Icon(Icons.access_time_rounded, size: 18, color: Color(0xFFD97706)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Time of Event',
                          style: TextStyle(fontSize: 11, color: Colors.grey),
                        ),
                        Text(
                          DateFormat('yyyy-MM-dd hh:mm a').format(_eventDateTime),
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.calendar_today_rounded, size: 16, color: Colors.grey),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _locationController,
            decoration: const InputDecoration(
              labelText: 'Location of Event',
              hintText: 'e.g. 5th Ave & Main St / School Bus Bay #3',
              prefixIcon: Icon(Icons.pin_drop_rounded, size: 18),
              isDense: true,
            ),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _witnessesController,
            decoration: const InputDecoration(
              labelText: 'Witnesses (Optional)',
              hintText: 'Names or contact details of witnesses',
              prefixIcon: Icon(Icons.people_outline_rounded, size: 18),
              isDense: true,
            ),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _personInvolvedController,
            decoration: const InputDecoration(
              labelText: 'Person(s) Involved (Optional)',
              hintText: 'Names of individuals involved',
              prefixIcon: Icon(Icons.person_outline_rounded, size: 18),
              isDense: true,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDescriptionCard(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'DESCRIPTION & SUGGESTIONS',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.8,
              color: Colors.grey,
            ),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _descriptionController,
            maxLines: 4,
            validator: (v) {
              if (v == null || v.trim().isEmpty) {
                return 'Please describe the hazard or event in detail.';
              }
              return null;
            },
            decoration: const InputDecoration(
              labelText: 'Description of Event *',
              hintText: 'Explain what happened, the unsafe condition, or the hazard observed...',
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _suggestionController,
            maxLines: 2,
            decoration: const InputDecoration(
              labelText: 'Suggested Corrective Action (Optional)',
              hintText: 'Any recommendations on how to fix or prevent this issue?',
              alignLabelWithHint: true,
            ),
          ),
        ],
      ),
    );
  }
}
