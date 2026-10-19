import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/theme.dart';
import '../../../core/feedback_utils.dart';
import '../../defect/presentation/create_defect_report_page.dart';
import '../bloc/pretrip_bloc.dart';
import '../bloc/pretrip_event.dart';
import '../bloc/pretrip_state.dart';
import '../models/pretrip_model.dart';
import '../repository/pretrip_repository.dart';

class PreTripChecklistPage extends StatefulWidget {
  final String vehicleUnit;
  final String driverId;
  final String driverName;
  final String currentDate;

  const PreTripChecklistPage({
    super.key,
    required this.vehicleUnit,
    required this.driverId,
    required this.driverName,
    required this.currentDate,
  });

  @override
  State<PreTripChecklistPage> createState() => _PreTripChecklistPageState();
}

class _PreTripChecklistPageState extends State<PreTripChecklistPage> {
  final PageController _pageController = PageController();
  final TextEditingController _odometerCtrl = TextEditingController();
  final TextEditingController _defectNotesCtrl = TextEditingController();

  int _currentPage = 0;
  // +1 for the final summary/signature page
  int get _totalPages => kSchedule5Categories.length + 1;

  bool _isExpressMode = true; // Default to Quick / Express Mode
  bool _allChecked = true;
  int _currentVehicleOdometer = 0;
  bool _isLoadingOdometer = false;

  @override
  void initState() {
    super.initState();
    _fetchCurrentVehicleOdometer();
  }

  @override
  void dispose() {
    _pageController.dispose();
    _odometerCtrl.dispose();
    _defectNotesCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchCurrentVehicleOdometer() async {
    setState(() => _isLoadingOdometer = true);
    try {
      final repo = context.read<PreTripRepository>();
      final odo = await repo.getVehicleOdometer(widget.vehicleUnit);
      if (mounted) {
        setState(() {
          _currentVehicleOdometer = odo;
          if (odo > 0 && _odometerCtrl.text.isEmpty) {
            _odometerCtrl.text = odo.toString();
          }
          _isLoadingOdometer = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoadingOdometer = false);
    }
  }

  void _nextPage() {
    if (_currentPage < _totalPages - 1) {
      _pageController.nextPage(
          duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
    }
  }

  void _prevPage() {
    if (_currentPage > 0) {
      _pageController.previousPage(
          duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
    }
  }

  void _openDefectReport() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => CreateDefectReportPage(
          defaultVehicleUnit: widget.vehicleUnit,
          driverId: widget.driverId,
          driverName: widget.driverName,
        ),
      ),
    );
  }

  void _promptDefectReport(ChecklistItem item, InspectionItemStatus status) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            Icon(
              status == InspectionItemStatus.majorDefect
                  ? Icons.error_outline_rounded
                  : Icons.warning_amber_rounded,
              color: status == InspectionItemStatus.majorDefect
                  ? AppColors.error
                  : AppColors.warning,
            ),
            const SizedBox(width: 8),
            const Expanded(
              child: Text('Defect Identified',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'You marked "${item.title}" as ${status.label}.',
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: 8),
            Text(
              'Would you like to file a Vehicle Defect Report for Bus #${widget.vehicleUnit} now so dispatch and maintenance are alerted?',
              style: const TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Continue Pre-Trip'),
          ),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: status == InspectionItemStatus.majorDefect
                  ? AppColors.error
                  : AppColors.warning,
              foregroundColor: Colors.white,
            ),
            onPressed: () {
              Navigator.pop(ctx);
              _openDefectReport();
            },
            icon: const Icon(Icons.assignment_late_rounded, size: 16),
            label: const Text('File Defect Report'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return BlocListener<PreTripBloc, PreTripState>(
      listener: (context, state) {
        if (state is PreTripSubmitSuccess || state is PreTripStatusLoaded) {
          AppFeedback.showSuccess(
            context,
            message: 'Pre-trip inspection submitted successfully.',
          );
          if (mounted) Navigator.of(context).pop();
        }
        if (state is PreTripError) {
          AppFeedback.showError(
            context,
            title: 'Inspection Submission Failed',
            message: state.message,
          );
        }
      },
      child: Scaffold(
        backgroundColor: isDark ? AppColors.darkBg : AppColors.lightBg,
        appBar: AppBar(
          elevation: 0,
          backgroundColor: isDark ? AppColors.darkCard : Colors.white,
          leading: IconButton(
            icon: const Icon(Icons.close_rounded),
            onPressed: () {
              showDialog(
                context: context,
                builder: (_) => AlertDialog(
                  title: const Text('Cancel Inspection?'),
                  content: const Text(
                      'Your progress will be lost. Are you sure?'),
                  actions: [
                    TextButton(
                        onPressed: () => Navigator.pop(context),
                        child: const Text('Keep Going')),
                    TextButton(
                      onPressed: () {
                        Navigator.pop(context); // close dialog
                        Navigator.pop(context); // close page
                        // Reload status
                        context.read<PreTripBloc>().add(LoadPreTripStatusEvent(
                              vehicleUnit: widget.vehicleUnit,
                              date: widget.currentDate,
                            ));
                      },
                      child: const Text('Discard',
                          style: TextStyle(color: AppColors.error)),
                    ),
                  ],
                ),
              );
            },
          ),
          title: BlocBuilder<PreTripBloc, PreTripState>(
            builder: (context, state) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Pre-Trip Inspection',
                      style:
                          TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  Text(
                    'Bus #${widget.vehicleUnit} · ${widget.currentDate}',
                    style: const TextStyle(fontSize: 11, color: Colors.grey),
                  ),
                ],
              );
            },
          ),
        ),
        body: BlocBuilder<PreTripBloc, PreTripState>(
          builder: (context, state) {
            if (state is! PreTripInProgress) {
              return const Center(
                  child: CircularProgressIndicator(color: AppColors.primary));
            }

            return Column(
              children: [
                // Mode selector: Express Mode vs Full Checklist
                _buildModeSelector(isDark),

                if (_isExpressMode) ...[
                  Expanded(
                    child: _buildExpressModeView(context, state, isDark),
                  ),
                  _buildExpressSubmitBar(context, state, isDark),
                ] else ...[
                  // Progress bar
                  _buildProgressBar(state, isDark),

                  // Category PageView
                  Expanded(
                    child: PageView.builder(
                      controller: _pageController,
                      physics: const NeverScrollableScrollPhysics(),
                      onPageChanged: (i) => setState(() => _currentPage = i),
                      itemCount: _totalPages,
                      itemBuilder: (context, index) {
                        if (index < kSchedule5Categories.length) {
                          return _buildCategoryPage(context, state,
                              kSchedule5Categories[index], isDark);
                        }
                        return _buildSummaryPage(context, state, isDark);
                      },
                    ),
                  ),

                  // Navigation buttons
                  _buildNavButtons(context, state, isDark),
                ],
              ],
            );
          },
        ),
      ),
    );
  }

  // ─── Mode Selector Tab ───────────────────────────────────────────────────

  Widget _buildModeSelector(bool isDark) {
    return Container(
      color: isDark ? AppColors.darkCard : Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          color: isDark ? Colors.grey.shade900 : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            Expanded(
              child: GestureDetector(
                onTap: () {
                  if (!_isExpressMode) {
                    setState(() => _isExpressMode = true);
                  }
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(
                    color: _isExpressMode
                        ? AppColors.primary
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.flash_on_rounded,
                        size: 16,
                        color: _isExpressMode
                            ? const Color(0xFF0F172A)
                            : Colors.grey,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'Express Mode',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: _isExpressMode
                              ? FontWeight.bold
                              : FontWeight.normal,
                          color: _isExpressMode
                              ? const Color(0xFF0F172A)
                              : Colors.grey,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(width: 4),
            Expanded(
              child: GestureDetector(
                onTap: () {
                  if (_isExpressMode) {
                    setState(() => _isExpressMode = false);
                  }
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(
                    color: !_isExpressMode
                        ? AppColors.primary
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.format_list_bulleted_rounded,
                        size: 16,
                        color: !_isExpressMode
                            ? const Color(0xFF0F172A)
                            : Colors.grey,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'Full Checklist',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: !_isExpressMode
                              ? FontWeight.bold
                              : FontWeight.normal,
                          color: !_isExpressMode
                              ? const Color(0xFF0F172A)
                              : Colors.grey,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── Express Mode View ───────────────────────────────────────────────────

  Widget _buildExpressModeView(
      BuildContext context, PreTripInProgress state, bool isDark) {
    final enteredOdo = int.tryParse(_odometerCtrl.text.trim()) ?? 0;
    final isOdoTooLow =
        _currentVehicleOdometer > 0 && enteredOdo > 0 && enteredOdo < _currentVehicleOdometer;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Banner
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
              border:
                  Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.flash_on_rounded,
                      color: AppColors.primary, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Express Inspection Mode',
                        style: TextStyle(
                            fontSize: 14, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Quick departure sign-off: verify odometer reading and certify all components pass Ontario Schedule 5 standards.',
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
          ),

          const SizedBox(height: 16),

          // Odometer Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isDark ? AppColors.darkCard : Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isOdoTooLow
                    ? AppColors.error
                    : (isDark
                        ? AppColors.darkCardBorder
                        : AppColors.lightCardBorder),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.speed_rounded,
                            size: 18, color: AppColors.primary),
                        SizedBox(width: 8),
                        Text(
                          'Odometer Reading (km)',
                          style: TextStyle(
                              fontSize: 14, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    if (_isLoadingOdometer)
                      const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    else if (_currentVehicleOdometer > 0)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: isDark
                              ? Colors.grey.shade800
                              : Colors.grey.shade100,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          'Current: $_currentVehicleOdometer km',
                          style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: Colors.grey),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _odometerCtrl,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    hintText: _currentVehicleOdometer > 0
                        ? 'e.g. $_currentVehicleOdometer'
                        : 'Enter odometer reading...',
                    suffixText: 'km',
                    prefixIcon: const Icon(Icons.pin_rounded, size: 18),
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 12),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  style: const TextStyle(
                      fontSize: 15, fontWeight: FontWeight.bold),
                  onChanged: (_) => setState(() {}),
                ),
                if (isOdoTooLow) ...[
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Icons.error_outline_rounded,
                          size: 14, color: AppColors.error),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          'Reading cannot be less than vehicle odometer ($_currentVehicleOdometer km).',
                          style: const TextStyle(
                              fontSize: 11,
                              color: AppColors.error,
                              fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                ] else if (enteredOdo > 0 &&
                    enteredOdo >= _currentVehicleOdometer) ...[
                  const SizedBox(height: 6),
                  const Row(
                    children: [
                      Icon(Icons.check_circle_rounded,
                          size: 14, color: AppColors.success),
                      SizedBox(width: 4),
                      Text(
                        'Valid odometer reading.',
                        style: TextStyle(
                            fontSize: 11,
                            color: AppColors.success,
                            fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),

          const SizedBox(height: 16),

          // All Checked Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isDark ? AppColors.darkCard : Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: _allChecked
                    ? AppColors.success.withValues(alpha: 0.5)
                    : AppColors.warning.withValues(alpha: 0.5),
                width: 1.5,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color:
                            (_allChecked ? AppColors.success : AppColors.warning)
                                .withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(
                        _allChecked
                            ? Icons.check_circle_outline_rounded
                            : Icons.rule_rounded,
                        color:
                            _allChecked ? AppColors.success : AppColors.warning,
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'All Items Checked & Passed',
                            style: TextStyle(
                                fontSize: 15, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'I confirm that all vehicle components (brakes, steering, tires, emergency exits, lamps, mirrors, wipers, etc.) have been physically inspected and are roadworthy.',
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
                    Switch(
                      value: _allChecked,
                      activeThumbColor: AppColors.success,
                      activeTrackColor: AppColors.success.withValues(alpha: 0.5),
                      onChanged: (val) {
                        setState(() {
                          _allChecked = val;
                        });
                        if (val) {
                          context.read<PreTripBloc>().add(
                                StartPreTripInspectionEvent(
                                  vehicleUnit: widget.vehicleUnit,
                                  inspectorId: widget.driverId,
                                  inspectorName: widget.driverName,
                                  date: widget.currentDate,
                                ),
                              );
                        }
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: isDark ? Colors.grey.shade800 : Colors.grey.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        _allChecked
                            ? Icons.done_all_rounded
                            : Icons.warning_amber_rounded,
                        size: 16,
                        color:
                            _allChecked ? AppColors.success : AppColors.warning,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _allChecked
                              ? 'All 48 Schedule 5 inspection items certified as passed.'
                              : 'Inspection items are not all certified.',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: _allChecked
                                ? AppColors.success
                                : AppColors.warning,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Defect prompt card
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: isDark ? AppColors.darkCard : Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isDark
                    ? AppColors.darkCardBorder
                    : AppColors.lightCardBorder,
              ),
            ),
            child: Row(
              children: [
                const Icon(Icons.build_circle_outlined,
                    color: AppColors.warning, size: 24),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Found an issue or defect?',
                        style: TextStyle(
                            fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Switch to Full Checklist or file a Defect Report directly.',
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
                OutlinedButton.icon(
                  onPressed: _openDefectReport,
                  icon: const Icon(Icons.report_problem_outlined, size: 14),
                  label: const Text('File Defect'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.warning,
                    side: const BorderSide(color: AppColors.warning),
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    textStyle: const TextStyle(fontSize: 11),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Optional defect notes
          _buildTextField(
            controller: _defectNotesCtrl,
            label: 'Inspection Notes (optional)',
            hint: 'Any remarks or observations...',
            maxLines: 2,
            isDark: isDark,
          ),

          const SizedBox(height: 16),

          // Inspector Info Card
          _buildInspectorInfoCard(isDark),

          const SizedBox(height: 80),
        ],
      ),
    );
  }

  // ─── Express Submit Bar ──────────────────────────────────────────────────

  Widget _buildExpressSubmitBar(
      BuildContext context, PreTripInProgress state, bool isDark) {
    final enteredOdo = int.tryParse(_odometerCtrl.text.trim()) ?? 0;
    final isOdoValid = enteredOdo > 0 &&
        (_currentVehicleOdometer == 0 || enteredOdo >= _currentVehicleOdometer);
    final canSubmit = _allChecked && isOdoValid;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : Colors.white,
        border: Border(
          top: BorderSide(
            color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
          ),
        ),
      ),
      child: BlocBuilder<PreTripBloc, PreTripState>(
        builder: (context, s) {
          final submitting = s is PreTripSubmitting;
          return ElevatedButton.icon(
            onPressed: (!canSubmit || submitting)
                ? null
                : () => _submitInspection(context),
            icon: submitting
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.check_circle_rounded, size: 18),
            label: Text(
                submitting ? 'Submitting...' : 'Submit Pre-Trip Inspection'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.success,
              foregroundColor: Colors.white,
              disabledBackgroundColor:
                  isDark ? Colors.grey.shade800 : Colors.grey.shade300,
              disabledForegroundColor: Colors.grey,
              minimumSize: const Size(double.infinity, 48),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          );
        },
      ),
    );
  }

  // ─── Full Checklist Category & Items ─────────────────────────────────────

  Widget _buildProgressBar(PreTripInProgress state, bool isDark) {
    final progress = (_currentPage + 1) / _totalPages;
    return Container(
      color: isDark ? AppColors.darkCard : Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                _currentPage < kSchedule5Categories.length
                    ? 'Category ${_currentPage + 1} of ${kSchedule5Categories.length}'
                    : 'Summary & Review',
                style: const TextStyle(fontSize: 12, color: Colors.grey),
              ),
              Text(
                '${(progress * 100).round()}%',
                style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: AppColors.primary),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress,
              backgroundColor:
                  isDark ? Colors.grey.shade800 : Colors.grey.shade200,
              valueColor:
                  const AlwaysStoppedAnimation<Color>(AppColors.primary),
              minHeight: 6,
            ),
          ),
          if (state.defectCount > 0) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                Icon(Icons.warning_amber_rounded,
                    size: 14,
                    color: state.hasMajorDefect
                        ? AppColors.error
                        : AppColors.warning),
                const SizedBox(width: 4),
                Text(
                  '${state.defectCount} defect${state.defectCount > 1 ? 's' : ''} noted',
                  style: TextStyle(
                    fontSize: 11,
                    color: state.hasMajorDefect
                        ? AppColors.error
                        : AppColors.warning,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildCategoryPage(BuildContext context, PreTripInProgress state,
      ChecklistCategory category, bool isDark) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Category header
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                  color: AppColors.primary.withValues(alpha: 0.2)),
            ),
            child: Row(
              children: [
                const Icon(Icons.fact_check_outlined,
                    color: AppColors.primary, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        category.title,
                        style: const TextStyle(
                            fontSize: 15, fontWeight: FontWeight.bold),
                      ),
                      if (category.isSchoolBusSpecific)
                        const Text(
                          'School Bus Specific',
                          style: TextStyle(fontSize: 11, color: Colors.grey),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Items
          ...category.items.map((item) {
            final result = state.items[item.code];
            final currentStatus =
                result?.status ?? InspectionItemStatus.pass;
            return _buildItemCard(context, item, currentStatus,
                result?.notes ?? '', isDark);
          }),
        ],
      ),
    );
  }

  Widget _buildItemCard(BuildContext context, ChecklistItem item,
      InspectionItemStatus currentStatus, String currentNotes, bool isDark) {
    Color statusColor;
    switch (currentStatus) {
      case InspectionItemStatus.majorDefect:
        statusColor = AppColors.error;
        break;
      case InspectionItemStatus.minorDefect:
        statusColor = AppColors.warning;
        break;
      case InspectionItemStatus.notApplicable:
        statusColor = Colors.grey;
        break;
      default:
        statusColor = AppColors.success;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: currentStatus == InspectionItemStatus.pass
              ? (isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder)
              : statusColor.withValues(alpha: 0.4),
          width: currentStatus == InspectionItemStatus.pass ? 1 : 1.5,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  item.title,
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w500),
                ),
              ),
              if (item.isSchoolBusSpecific)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text(
                    'SB',
                    style: TextStyle(
                        fontSize: 9,
                        color: AppColors.primary,
                        fontWeight: FontWeight.bold),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          // Status selector
          Row(
            children: InspectionItemStatus.values.map((s) {
              final isSelected = currentStatus == s;
              Color color;
              switch (s) {
                case InspectionItemStatus.majorDefect:
                  color = AppColors.error;
                  break;
                case InspectionItemStatus.minorDefect:
                  color = AppColors.warning;
                  break;
                case InspectionItemStatus.notApplicable:
                  color = Colors.grey;
                  break;
                default:
                  color = AppColors.success;
              }
              return Expanded(
                child: GestureDetector(
                  onTap: () {
                    context.read<PreTripBloc>().add(UpdatePreTripItemEvent(
                          itemCode: item.code,
                          status: s,
                          notes: currentNotes,
                        ));
                    if (s == InspectionItemStatus.minorDefect ||
                        s == InspectionItemStatus.majorDefect) {
                      _promptDefectReport(item, s);
                    }
                  },
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 2),
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? color.withValues(alpha: 0.2)
                          : (isDark
                              ? Colors.grey.shade800
                              : Colors.grey.shade100),
                      borderRadius: BorderRadius.circular(6),
                      border: isSelected
                          ? Border.all(color: color, width: 1.5)
                          : null,
                    ),
                    child: Text(
                      s.label,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: isSelected
                            ? FontWeight.bold
                            : FontWeight.normal,
                        color: isSelected ? color : Colors.grey,
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          // Notes field — only shown when there's a defect
          if (currentStatus == InspectionItemStatus.minorDefect ||
              currentStatus == InspectionItemStatus.majorDefect) ...[
            const SizedBox(height: 8),
            TextFormField(
              initialValue: currentNotes,
              decoration: InputDecoration(
                hintText: 'Describe defect...',
                hintStyle: const TextStyle(fontSize: 12, color: Colors.grey),
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 10, vertical: 8),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: statusColor),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: statusColor, width: 1.5),
                ),
              ),
              style: const TextStyle(fontSize: 12),
              onChanged: (v) {
                context.read<PreTripBloc>().add(UpdatePreTripItemEvent(
                      itemCode: item.code,
                      status: currentStatus,
                      notes: v,
                    ));
              },
            ),
          ],
        ],
      ),
    );
  }

  // ─── Full Checklist Summary & Review Page ─────────────────────────────────

  Widget _buildSummaryPage(
      BuildContext context, PreTripInProgress state, bool isDark) {
    final defects = state.items.values
        .where((i) =>
            i.status == InspectionItemStatus.minorDefect ||
            i.status == InspectionItemStatus.majorDefect)
        .toList();
    final passCount = state.items.values
        .where((i) => i.status == InspectionItemStatus.pass)
        .length;
    final naCount = state.items.values
        .where((i) => i.status == InspectionItemStatus.notApplicable)
        .length;
    final enteredOdo = int.tryParse(_odometerCtrl.text.trim()) ?? 0;
    final isOdoTooLow =
        _currentVehicleOdometer > 0 && enteredOdo > 0 && enteredOdo < _currentVehicleOdometer;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Overall result banner
          _buildOverallBanner(state, isDark),

          const SizedBox(height: 16),

          // Stat chips
          Row(
            children: [
              _KpiChip(
                  label: 'Pass', value: '$passCount', color: AppColors.success),
              const SizedBox(width: 8),
              _KpiChip(
                  label: 'Defects',
                  value: '${defects.length}',
                  color: state.hasMajorDefect
                      ? AppColors.error
                      : defects.isNotEmpty
                          ? AppColors.warning
                          : AppColors.success),
              const SizedBox(width: 8),
              _KpiChip(
                  label: 'N/A',
                  value: '$naCount',
                  color: Colors.grey),
            ],
          ),

          if (defects.isNotEmpty) ...[
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'DEFECTS NOTED',
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: Colors.grey,
                      letterSpacing: 1),
                ),
                TextButton.icon(
                  onPressed: _openDefectReport,
                  icon: const Icon(Icons.assignment_late_rounded, size: 14),
                  label: const Text('File Defect Report'),
                  style: TextButton.styleFrom(
                    foregroundColor: state.hasMajorDefect
                        ? AppColors.error
                        : AppColors.warning,
                    textStyle: const TextStyle(fontSize: 11),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            ...defects.map((d) => _buildDefectRow(d, isDark)),
          ],

          const SizedBox(height: 16),

          // Odometer
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: isDark ? AppColors.darkCard : Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: isOdoTooLow
                    ? AppColors.error
                    : (isDark
                        ? AppColors.darkCardBorder
                        : AppColors.lightCardBorder),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Odometer Reading (km)',
                        style: TextStyle(
                            fontSize: 13, fontWeight: FontWeight.w600)),
                    if (_currentVehicleOdometer > 0)
                      Text(
                        'Current: $_currentVehicleOdometer km',
                        style: const TextStyle(
                            fontSize: 11,
                            color: Colors.grey,
                            fontWeight: FontWeight.w600),
                      ),
                  ],
                ),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _odometerCtrl,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    hintText: _currentVehicleOdometer > 0
                        ? 'e.g. $_currentVehicleOdometer'
                        : 'e.g. 123456',
                    suffixText: 'km',
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 10),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  style: const TextStyle(fontSize: 13),
                  onChanged: (_) => setState(() {}),
                ),
                if (isOdoTooLow) ...[
                  const SizedBox(height: 6),
                  Text(
                    'Reading cannot be less than vehicle odometer ($_currentVehicleOdometer km).',
                    style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.error,
                        fontWeight: FontWeight.w600),
                  ),
                ],
              ],
            ),
          ),

          const SizedBox(height: 12),

          // Additional defect notes
          _buildTextField(
            controller: _defectNotesCtrl,
            label: 'Additional Defect Notes (optional)',
            hint: 'Describe any other observations...',
            maxLines: 3,
            isDark: isDark,
          ),

          const SizedBox(height: 16),

          // Inspector info card
          _buildInspectorInfoCard(isDark),

          const SizedBox(height: 8),

          Text(
            'This inspection report will be automatically recorded under your employee account name '
            'in accordance with Ontario Regulation 199/07 Schedule 5.',
            style: TextStyle(
                fontSize: 11,
                color: isDark
                    ? AppColors.textSecondaryDark
                    : AppColors.textSecondaryLight),
          ),

          const SizedBox(height: 80),
        ],
      ),
    );
  }

  Widget _buildOverallBanner(PreTripInProgress state, bool isDark) {
    Color color;
    IconData icon;
    String label;
    if (state.hasMajorDefect) {
      color = AppColors.error;
      icon = Icons.cancel_rounded;
      label = 'Major defects present — vehicle may be unsafe. Report immediately.';
    } else if (state.defectCount > 0) {
      color = AppColors.warning;
      icon = Icons.warning_amber_rounded;
      label = 'Minor defects noted. Report to maintenance.';
    } else {
      color = AppColors.success;
      icon = Icons.check_circle_rounded;
      label = 'All items passed. Vehicle is roadworthy.';
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(width: 12),
          Expanded(
            child: Text(label,
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: color)),
          ),
        ],
      ),
    );
  }

  Widget _buildDefectRow(InspectionItemResult d, bool isDark) {
    final color = d.status == InspectionItemStatus.majorDefect
        ? AppColors.error
        : AppColors.warning;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              d.status == InspectionItemStatus.majorDefect ? 'MAJOR' : 'MINOR',
              style: TextStyle(
                  fontSize: 9, fontWeight: FontWeight.bold, color: color),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(d.title,
                    style: const TextStyle(
                        fontSize: 12, fontWeight: FontWeight.w500)),
                if (d.notes.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(d.notes,
                      style:
                          const TextStyle(fontSize: 11, color: Colors.grey)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInspectorInfoCard(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : Colors.grey.shade50,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isDark
              ? AppColors.darkCardBorder
              : AppColors.lightCardBorder,
        ),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: AppColors.primary.withValues(alpha: 0.15),
            child: const Icon(Icons.person_rounded,
                color: AppColors.primary, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Inspector Name',
                  style: TextStyle(fontSize: 11, color: Colors.grey),
                ),
                Text(
                  widget.driverName.isNotEmpty
                      ? widget.driverName
                      : widget.driverId,
                  style: const TextStyle(
                      fontSize: 14, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.success.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(6),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.verified_user_rounded,
                    size: 13, color: AppColors.success),
                SizedBox(width: 4),
                Text(
                  'Auto-filled',
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: AppColors.success),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required bool isDark,
    TextInputType keyboardType = TextInputType.text,
    int maxLines = 1,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style:
                const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        TextFormField(
          controller: controller,
          keyboardType: keyboardType,
          maxLines: maxLines,
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(fontSize: 13, color: Colors.grey),
            isDense: true,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(
                  color: isDark
                      ? AppColors.darkCardBorder
                      : AppColors.lightCardBorder),
            ),
          ),
          style: const TextStyle(fontSize: 13),
        ),
      ],
    );
  }

  Widget _buildNavButtons(
      BuildContext context, PreTripInProgress state, bool isDark) {
    final isLastPage = _currentPage == _totalPages - 1;
    final enteredOdo = int.tryParse(_odometerCtrl.text.trim()) ?? 0;
    final isOdoValid = enteredOdo > 0 &&
        (_currentVehicleOdometer == 0 || enteredOdo >= _currentVehicleOdometer);

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : Colors.white,
        border: Border(
          top: BorderSide(
            color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
          ),
        ),
      ),
      child: Row(
        children: [
          if (_currentPage > 0)
            OutlinedButton.icon(
              onPressed: _prevPage,
              icon: const Icon(Icons.chevron_left_rounded, size: 18),
              label: const Text('Back'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primary,
                side: const BorderSide(color: AppColors.primary),
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
            ),
          const Spacer(),
          if (!isLastPage)
            ElevatedButton.icon(
              onPressed: _nextPage,
              icon: const Icon(Icons.chevron_right_rounded, size: 18),
              label: Text(_currentPage < kSchedule5Categories.length - 1
                  ? 'Next'
                  : 'Review & Complete'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: const Color(0xFF0F172A),
                minimumSize: const Size(0, 44),
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              ),
            )
          else
            BlocBuilder<PreTripBloc, PreTripState>(
              builder: (context, s) {
                final submitting = s is PreTripSubmitting;
                return ElevatedButton.icon(
                  onPressed: (!isOdoValid || submitting)
                      ? null
                      : () => _submitInspection(context),
                  icon: submitting
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.send_rounded, size: 18),
                  label:
                      Text(submitting ? 'Submitting...' : 'Submit Inspection'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.success,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor:
                        isDark ? Colors.grey.shade800 : Colors.grey.shade300,
                    disabledForegroundColor: Colors.grey,
                    minimumSize: const Size(0, 44),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 20, vertical: 12),
                  ),
                );
              },
            ),
        ],
      ),
    );
  }

  void _submitInspection(BuildContext context) {
    final odoText = _odometerCtrl.text.trim();
    final odo = int.tryParse(odoText) ?? 0;

    if (odo <= 0) {
      AppFeedback.showError(
        context,
        title: 'Odometer Required',
        message: 'Please enter a valid odometer reading.',
      );
      return;
    }

    if (_currentVehicleOdometer > 0 && odo < _currentVehicleOdometer) {
      AppFeedback.showError(
        context,
        title: 'Invalid Odometer',
        message:
            'Entered odometer ($odo km) cannot be less than current recorded vehicle odometer ($_currentVehicleOdometer km).',
      );
      return;
    }

    if (_isExpressMode && !_allChecked) {
      AppFeedback.showError(
        context,
        title: 'Checklist Required',
        message:
            'In Express Mode, you must certify that all items passed. If defects were found, please switch to Full Checklist.',
      );
      return;
    }

    final now = DateTime.now();
    final timeStr =
        '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
    final inspectorName =
        widget.driverName.isNotEmpty ? widget.driverName : widget.driverId;

    context.read<PreTripBloc>().add(SubmitPreTripInspectionEvent(
          odometer: odo,
          defectNotes: _defectNotesCtrl.text.trim(),
          signatureName: inspectorName,
          inspectionTime: timeStr,
        ));
  }
}

class _KpiChip extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _KpiChip(
      {required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Column(
          children: [
            Text(value,
                style: TextStyle(
                    fontSize: 18, fontWeight: FontWeight.bold, color: color)),
            const SizedBox(height: 2),
            Text(label,
                style: const TextStyle(fontSize: 11, color: Colors.grey)),
          ],
        ),
      ),
    );
  }
}
