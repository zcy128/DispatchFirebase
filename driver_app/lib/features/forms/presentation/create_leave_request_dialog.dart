import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/theme.dart';
import '../../../core/feedback_utils.dart';
import '../bloc/time_off_bloc.dart';
import '../bloc/time_off_event.dart';
import '../models/time_off_model.dart';

class CreateLeaveRequestDialog extends StatefulWidget {
  final String employeeId;
  final String employeeName;

  const CreateLeaveRequestDialog({
    super.key,
    required this.employeeId,
    required this.employeeName,
  });

  static Future<void> show(
    BuildContext context, {
    required String employeeId,
    required String employeeName,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => BlocProvider.value(
        value: context.read<TimeOffBloc>(),
        child: CreateLeaveRequestDialog(
          employeeId: employeeId,
          employeeName: employeeName,
        ),
      ),
    );
  }

  @override
  State<CreateLeaveRequestDialog> createState() => _CreateLeaveRequestDialogState();
}

class _CreateLeaveRequestDialogState extends State<CreateLeaveRequestDialog> {
  final _formKey = GlobalKey<FormState>();
  TimeOffLeaveType _selectedLeaveType = TimeOffLeaveType.vacation;
  TimeOffShiftType _selectedShiftType = TimeOffShiftType.all;
  late DateTime _startDate;
  late DateTime _endDate;
  final _commentsController = TextEditingController();
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    // Default to 3 days in the future
    _startDate = DateTime(now.year, now.month, now.day).add(const Duration(days: 3));
    _endDate = _startDate;
  }

  @override
  void dispose() {
    _commentsController.dispose();
    super.dispose();
  }

  String _formatDate(DateTime dt) {
    return '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')}';
  }

  Future<void> _selectStartDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _startDate,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: const ColorScheme.dark(
            primary: AppColors.primary,
            onPrimary: Colors.black,
            surface: AppColors.darkCard,
            onSurface: Colors.white,
          ),
        ),
        child: child!,
      ),
    );

    if (picked != null) {
      setState(() {
        _startDate = picked;
        if (_endDate.isBefore(_startDate)) {
          _endDate = _startDate;
        }
      });
    }
  }

  Future<void> _selectEndDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _endDate.isBefore(_startDate) ? _startDate : _endDate,
      firstDate: _startDate,
      lastDate: DateTime.now().add(const Duration(days: 365)),
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: const ColorScheme.dark(
            primary: AppColors.primary,
            onPrimary: Colors.black,
            surface: AppColors.darkCard,
            onSurface: Colors.white,
          ),
        ),
        child: child!,
      ),
    );

    if (picked != null) {
      setState(() {
        _endDate = picked;
      });
    }
  }

  void _handleSubmit() {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isSubmitting = true;
    });

    final nowStr = DateTime.now().toIso8601String();
    final newRequest = TimeOffRequestModel(
      id: 'TOR-${DateTime.now().millisecondsSinceEpoch}',
      employeeId: widget.employeeId,
      employeeName: widget.employeeName,
      leaveType: _selectedLeaveType,
      startDate: _formatDate(_startDate),
      endDate: _formatDate(_endDate),
      shiftType: _selectedShiftType,
      comments: _commentsController.text.trim(),
      status: TimeOffStatus.pending,
      requestedByUserId: widget.employeeId,
      requestedByName: widget.employeeName,
      createdAt: nowStr,
      updatedAt: nowStr,
    );

    context.read<TimeOffBloc>().add(CreateTimeOffRequestEvent(newRequest));

    Navigator.of(context).pop();
    AppFeedback.showSuccess(
      context,
      message: 'Leave request submitted to Dispatch for approval.',
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final durationDays = _endDate.difference(_startDate).inDays + 1;

    return Container(
      margin: EdgeInsets.only(top: 60, bottom: bottomInset),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkBg : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border.all(
          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
          width: 1,
        ),
      ),
      child: SafeArea(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header Handle
              Center(
                child: Container(
                  margin: const EdgeInsets.only(top: 12, bottom: 8),
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade600,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),

              // Title Bar
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(
                        Icons.edit_calendar_rounded,
                        color: AppColors.primary,
                        size: 22,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'New Leave Request',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            'Submit time-off application for dispatcher review',
                            style: TextStyle(
                              fontSize: 12,
                              color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1),

              // Form Scrollable Body
              Flexible(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Applicant Info Tag
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: isDark ? AppColors.darkCard : AppColors.lightCard,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
                          ),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.badge_outlined, size: 18, color: AppColors.primary),
                            const SizedBox(width: 8),
                            Text(
                              'Applicant: ${widget.employeeName} (${widget.employeeId})',
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Leave Type Dropdown
                      const Text(
                        'Leave Type *',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 6),
                      DropdownButtonFormField<TimeOffLeaveType>(
                        initialValue: _selectedLeaveType,
                        decoration: InputDecoration(
                          filled: true,
                          fillColor: isDark ? AppColors.darkCard : AppColors.lightCard,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(
                              color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
                            ),
                          ),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        ),
                        dropdownColor: isDark ? AppColors.darkCard : Colors.white,
                        items: TimeOffLeaveType.values.map((type) {
                          return DropdownMenuItem(
                            value: type,
                            child: Text(type.label),
                          );
                        }).toList(),
                        onChanged: (val) {
                          if (val != null) setState(() => _selectedLeaveType = val);
                        },
                      ),
                      const SizedBox(height: 16),

                      // Shift Coverage Dropdown
                      const Text(
                        'Shift Coverage *',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 6),
                      DropdownButtonFormField<TimeOffShiftType>(
                        initialValue: _selectedShiftType,
                        decoration: InputDecoration(
                          filled: true,
                          fillColor: isDark ? AppColors.darkCard : AppColors.lightCard,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(
                              color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
                            ),
                          ),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        ),
                        dropdownColor: isDark ? AppColors.darkCard : Colors.white,
                        items: TimeOffShiftType.values.map((st) {
                          return DropdownMenuItem(
                            value: st,
                            child: Text(st.label),
                          );
                        }).toList(),
                        onChanged: (val) {
                          if (val != null) setState(() => _selectedShiftType = val);
                        },
                      ),
                      const SizedBox(height: 16),

                      // Requested Dates (Start and End)
                      Row(
                        children: [
                          const Icon(Icons.date_range_rounded, size: 16, color: AppColors.primary),
                          const SizedBox(width: 6),
                          const Text(
                            'Requested Dates *',
                            style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                          ),
                          const Spacer(),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              '$durationDays ${durationDays == 1 ? 'day' : 'days'}',
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: AppColors.primary,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),

                      Row(
                        children: [
                          // Start Date
                          Expanded(
                            child: InkWell(
                              onTap: _selectStartDate,
                              borderRadius: BorderRadius.circular(12),
                              child: Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: isDark ? AppColors.darkCard : AppColors.lightCard,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
                                  ),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Start Date',
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      _formatDate(_startDate),
                                      style: const TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),

                          // End Date
                          Expanded(
                            child: InkWell(
                              onTap: _selectEndDate,
                              borderRadius: BorderRadius.circular(12),
                              child: Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: isDark ? AppColors.darkCard : AppColors.lightCard,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
                                  ),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'End Date',
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      _formatDate(_endDate),
                                      style: const TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),

                      // Reason / Comments Field
                      const Text(
                        'Reason & Notes',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _commentsController,
                        maxLines: 3,
                        decoration: InputDecoration(
                          hintText: 'Provide details or special notes for dispatch approval...',
                          hintStyle: TextStyle(
                            fontSize: 13,
                            color: isDark ? Colors.grey.shade600 : Colors.grey.shade400,
                          ),
                          filled: true,
                          fillColor: isDark ? AppColors.darkCard : AppColors.lightCard,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(
                              color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
                            ),
                          ),
                          contentPadding: const EdgeInsets.all(12),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // Bottom Submit Action
              Padding(
                padding: const EdgeInsets.all(20),
                child: SizedBox(
                  height: 48,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.black,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      elevation: 0,
                    ),
                    onPressed: _isSubmitting ? null : _handleSubmit,
                    child: _isSubmitting
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.5,
                              color: Colors.black,
                            ),
                          )
                        : const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.send_rounded, size: 18),
                              SizedBox(width: 8),
                              Text(
                                'Submit Leave Request',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
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
      ),
    );
  }
}
