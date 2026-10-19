import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import '../../../core/theme.dart';
import '../../../core/feedback_utils.dart';
import '../bloc/defect_bloc.dart';
import '../bloc/defect_event.dart';
import '../bloc/defect_state.dart';
import '../models/defect_model.dart';
import '../repository/defect_repository.dart';

class CreateDefectReportPage extends StatelessWidget {
  final String defaultVehicleUnit;
  final String driverId;
  final String driverName;
  final List<String> fleetVehicles;

  const CreateDefectReportPage({
    super.key,
    required this.defaultVehicleUnit,
    required this.driverId,
    required this.driverName,
    this.fleetVehicles = const [],
  });

  @override
  Widget build(BuildContext context) {
    DefectBloc? existingBloc;
    try {
      existingBloc = context.read<DefectBloc>();
    } catch (_) {
      existingBloc = null;
    }

    final view = _CreateDefectReportView(
      defaultVehicleUnit: defaultVehicleUnit,
      driverId: driverId,
      driverName: driverName,
      fleetVehicles: fleetVehicles,
    );

    if (existingBloc != null) {
      return view;
    }

    return BlocProvider<DefectBloc>(
      create: (ctx) => DefectBloc(
        repository: ctx.read<DefectRepository>(),
      ),
      child: view,
    );
  }
}

class _CreateDefectReportView extends StatefulWidget {
  final String defaultVehicleUnit;
  final String driverId;
  final String driverName;
  final List<String> fleetVehicles;

  const _CreateDefectReportView({
    required this.defaultVehicleUnit,
    required this.driverId,
    required this.driverName,
    this.fleetVehicles = const [],
  });

  @override
  State<_CreateDefectReportView> createState() =>
      _CreateDefectReportViewState();
}

class _CreateDefectReportViewState extends State<_CreateDefectReportView>
    with SingleTickerProviderStateMixin {
  late String _selectedVehicleUnit;
  final TextEditingController _odometerCtrl = TextEditingController();
  final TextEditingController _defectNotesCtrl = TextEditingController();
  final Map<String, DefectItemStatus> _itemStatuses = {};
  final Map<String, String> _itemNotes = {};

  bool _confirmedAccurate = false;
  late TabController _tabController;

  final List<DefectCheckItemTemplate> _dailyItems = DefectCheckItemTemplate
      .standardItems
      .where((i) => i.group == 'Daily Check')
      .toList();

  final List<DefectCheckItemTemplate> _periodicItems = DefectCheckItemTemplate
      .standardItems
      .where((i) => i.group == 'Periodic Check')
      .toList();

  @override
  void initState() {
    super.initState();
    _selectedVehicleUnit = widget.defaultVehicleUnit.isNotEmpty
        ? widget.defaultVehicleUnit
        : (widget.fleetVehicles.isNotEmpty ? widget.fleetVehicles.first : '1001');

    for (final item in DefectCheckItemTemplate.standardItems) {
      _itemStatuses[item.key] = DefectItemStatus.ok;
    }

    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _odometerCtrl.dispose();
    _defectNotesCtrl.dispose();
    super.dispose();
  }

  int get _flaggedDefectCount => _itemStatuses.values
      .where((status) => status == DefectItemStatus.defect)
      .length;

  List<String> get _availableVehicles {
    final Set<String> set = {};
    if (widget.defaultVehicleUnit.isNotEmpty) {
      set.add(widget.defaultVehicleUnit);
    }
    if (_selectedVehicleUnit.isNotEmpty) {
      set.add(_selectedVehicleUnit);
    }
    for (final v in widget.fleetVehicles) {
      if (v.trim().isNotEmpty) {
        set.add(v.trim());
      }
    }
    if (set.isEmpty) {
      set.add('1001');
    }
    final list = set.toList();
    list.sort();
    return list;
  }

  void _submit() {
    final odo = int.tryParse(_odometerCtrl.text.trim()) ?? 0;
    if (odo <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a valid odometer reading.'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    final hasDefects = _flaggedDefectCount > 0;
    final notes = _defectNotesCtrl.text.trim();

    if (hasDefects && notes.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please describe the defects found in the notes field.'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    if (!_confirmedAccurate) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please confirm that the report is accurate.'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    final now = DateTime.now();
    final dateStr = DateFormat('yyyy-MM-dd').format(now);
    final timeStr = DateFormat('HH:mm').format(now);

    final reportItems = DefectCheckItemTemplate.standardItems.map((tmpl) {
      return DefectReportItem(
        id: tmpl.key,
        name: tmpl.label,
        category: tmpl.group,
        status: _itemStatuses[tmpl.key] ?? DefectItemStatus.ok,
        notes: _itemNotes[tmpl.key] ?? '',
      );
    }).toList();

    final availableVehicles = _availableVehicles;
    final vehicleToSubmit = availableVehicles.contains(_selectedVehicleUnit)
        ? _selectedVehicleUnit
        : availableVehicles.first;

    final report = VehicleDefectReport(
      id: '',
      vehicleId: int.tryParse(vehicleToSubmit) ?? 0,
      vehicleUnitNumber: vehicleToSubmit,
      odometer: odo,
      reportedByUserId: widget.driverId,
      reportedByName: widget.driverName,
      reportDate: dateStr,
      reportTime: timeStr,
      items: reportItems,
      defectNotes: notes,
      noDefectsFound: !hasDefects,
      confirmedAccurate: _confirmedAccurate,
      status: DefectReportStatus.submitted,
      createdAt: now,
      updatedAt: now,
    );

    context.read<DefectBloc>().add(SubmitDefectReportEvent(report));
  }

  @override
  Widget build(BuildContext context) {
    final availableVehicles = _availableVehicles;
    final currentVehicle = availableVehicles.contains(_selectedVehicleUnit)
        ? _selectedVehicleUnit
        : availableVehicles.first;

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textPrimary =
        isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight;
    final textSecondary =
        isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight;
    final cardBg = isDark ? AppColors.darkCard : AppColors.lightCard;
    final cardBorder =
        isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder;

    return BlocListener<DefectBloc, DefectState>(
      listener: (context, state) {
        if (state is DefectSubmitSuccess) {
          AppFeedback.showSuccess(
            context,
            message: 'Defect report submitted successfully.',
          );
          Navigator.of(context).pop(true);
        } else if (state is DefectError) {
          AppFeedback.showError(
            context,
            title: 'Defect Submission Failed',
            message: state.message,
          );
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text(
            'Report Vehicle Defect',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          bottom: TabBar(
            controller: _tabController,
            indicatorColor: AppColors.primary,
            labelColor: AppColors.primary,
            unselectedLabelColor: textSecondary,
            tabs: [
              Tab(
                text: 'Daily Check (${_dailyItems.length})',
                icon: const Icon(Icons.checklist, size: 20),
              ),
              Tab(
                text: 'Periodic Check (${_periodicItems.length})',
                icon: const Icon(Icons.build_circle_outlined, size: 20),
              ),
            ],
          ),
        ),
        body: Column(
          children: [
            // Vehicle & Odometer Top Bar
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              color: isDark ? AppColors.darkBg : const Color(0xFFF1F5F9),
              child: Row(
                children: [
                  Expanded(
                    flex: 4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(
                        color: cardBg,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: cardBorder),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: currentVehicle,
                          isExpanded: true,
                          items: availableVehicles
                              .map((unit) => DropdownMenuItem(
                                    value: unit,
                                    child: Text(
                                      'Unit #$unit',
                                      style: TextStyle(
                                        color: textPrimary,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ))
                              .toList(),
                          onChanged: (val) {
                            if (val != null) {
                              setState(() => _selectedVehicleUnit = val);
                            }
                          },
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 5,
                    child: TextField(
                      controller: _odometerCtrl,
                      keyboardType: TextInputType.number,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      style: TextStyle(color: textPrimary, fontSize: 14),
                      decoration: InputDecoration(
                        isDense: true,
                        hintText: 'Odometer (km)',
                        prefixIcon: const Icon(Icons.speed, size: 20),
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 12),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Tab View for Checklist Items
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  _buildItemsList(_dailyItems, isDark, cardBg, cardBorder,
                      textPrimary, textSecondary),
                  _buildItemsList(_periodicItems, isDark, cardBg, cardBorder,
                      textPrimary, textSecondary),
                ],
              ),
            ),

            // Bottom Summary & Submit Section
            _buildBottomSection(isDark, cardBg, cardBorder, textPrimary, textSecondary),
          ],
        ),
      ),
    );
  }

  Widget _buildItemsList(
    List<DefectCheckItemTemplate> items,
    bool isDark,
    Color cardBg,
    Color cardBorder,
    Color textPrimary,
    Color textSecondary,
  ) {
    return ListView.separated(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      itemCount: items.length,
      separatorBuilder: (context, index) => const SizedBox(height: 8),
      itemBuilder: (context, idx) {
        final item = items[idx];
        final currentStatus = _itemStatuses[item.key] ?? DefectItemStatus.ok;
        final hasDefect = currentStatus == DefectItemStatus.defect;

        return Container(
          decoration: BoxDecoration(
            color: hasDefect
                ? (isDark
                    ? const Color(0xFF451A1A)
                    : const Color(0xFFFEF2F2))
                : cardBg,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: hasDefect ? AppColors.error : cardBorder,
              width: hasDefect ? 1.5 : 1.0,
            ),
          ),
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      item.label,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: hasDefect ? AppColors.error : textPrimary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  // Segmented Status Selector
                  _buildStatusButton(
                    item.key,
                    DefectItemStatus.ok,
                    'OK',
                    currentStatus == DefectItemStatus.ok,
                    AppColors.success,
                    isDark,
                  ),
                  const SizedBox(width: 6),
                  _buildStatusButton(
                    item.key,
                    DefectItemStatus.defect,
                    'Defect',
                    currentStatus == DefectItemStatus.defect,
                    AppColors.error,
                    isDark,
                  ),
                  const SizedBox(width: 6),
                  _buildStatusButton(
                    item.key,
                    DefectItemStatus.notApplicable,
                    'N/A',
                    currentStatus == DefectItemStatus.notApplicable,
                    Colors.grey,
                    isDark,
                  ),
                ],
              ),
              if (hasDefect) ...[
                const SizedBox(height: 8),
                TextFormField(
                  initialValue: _itemNotes[item.key] ?? '',
                  onChanged: (val) => _itemNotes[item.key] = val,
                  style: TextStyle(color: textPrimary, fontSize: 13),
                  decoration: InputDecoration(
                    isDense: true,
                    hintText: 'Notes on ${item.label} defect (optional)...',
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  Widget _buildStatusButton(
    String itemKey,
    DefectItemStatus status,
    String label,
    bool isSelected,
    Color activeColor,
    bool isDark,
  ) {
    return InkWell(
      onTap: () {
        setState(() {
          _itemStatuses[itemKey] = status;
        });
      },
      borderRadius: BorderRadius.circular(8),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected
              ? activeColor.withValues(alpha: isDark ? 0.25 : 0.15)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected
                ? activeColor
                : (isDark ? const Color(0xFF475569) : const Color(0xFFCBD5E1)),
            width: isSelected ? 1.5 : 1.0,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
            color: isSelected
                ? activeColor
                : (isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
          ),
        ),
      ),
    );
  }

  Widget _buildBottomSection(
    bool isDark,
    Color cardBg,
    Color cardBorder,
    Color textPrimary,
    Color textSecondary,
  ) {
    final defectCount = _flaggedDefectCount;
    final isSubmitting = context.watch<DefectBloc>().state is DefectSubmitting;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: cardBg,
        border: Border(top: BorderSide(color: cardBorder)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 8,
            offset: const Offset(0, -3),
          ),
        ],
      ),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Defect general notes
            TextField(
              controller: _defectNotesCtrl,
              maxLines: 2,
              style: TextStyle(color: textPrimary, fontSize: 13),
              decoration: InputDecoration(
                isDense: true,
                hintText: defectCount > 0
                    ? 'Overall defect description (required)...'
                    : 'Additional notes or comments (optional)...',
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
            const SizedBox(height: 10),

            // Confirmation Checkbox
            Row(
              children: [
                SizedBox(
                  height: 24,
                  width: 24,
                  child: Checkbox(
                    value: _confirmedAccurate,
                    activeColor: AppColors.primary,
                    onChanged: (val) {
                      setState(() => _confirmedAccurate = val ?? false);
                    },
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'I confirm that the vehicle condition reported above is accurate.',
                    style: TextStyle(fontSize: 12, color: textSecondary),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Submit Button
            ElevatedButton(
              onPressed: isSubmitting ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor:
                    defectCount > 0 ? AppColors.error : AppColors.primary,
                foregroundColor:
                    defectCount > 0 ? Colors.white : const Color(0xFF0F172A),
                minimumSize: const Size(0, 48),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: isSubmitting
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2.5),
                    )
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          defectCount > 0
                              ? Icons.warning_amber_rounded
                              : Icons.check_circle_outline,
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          defectCount > 0
                              ? 'Submit Defect Report ($defectCount Flagged)'
                              : 'Submit Report (No Defects)',
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
