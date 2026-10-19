import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/theme.dart';
import '../../../core/feedback_utils.dart';
import '../../../core/widgets/attachment_picker_widget.dart';
import '../bloc/route_assessment_bloc.dart';
import '../bloc/route_assessment_event.dart';
import '../bloc/route_assessment_state.dart';
import '../models/route_assessment_model.dart';
import '../repository/route_assessment_repository.dart';

class RouteAssessmentFormPage extends StatelessWidget {
  final String driverId;
  final String driverName;
  final String? defaultRouteId;

  const RouteAssessmentFormPage({
    super.key,
    required this.driverId,
    required this.driverName,
    this.defaultRouteId,
  });

  @override
  Widget build(BuildContext context) {
    RouteAssessmentBloc? existingBloc;
    try {
      existingBloc = context.read<RouteAssessmentBloc>();
    } catch (_) {
      existingBloc = null;
    }

    final view = _RouteAssessmentFormView(
      driverId: driverId,
      driverName: driverName,
      defaultRouteId: defaultRouteId,
    );

    if (existingBloc != null) {
      return view;
    }

    return BlocProvider<RouteAssessmentBloc>(
      create: (ctx) => RouteAssessmentBloc(
        repository: ctx.read<RouteAssessmentRepository>(),
      ),
      child: view,
    );
  }
}

class _RouteAssessmentFormView extends StatefulWidget {
  final String driverId;
  final String driverName;
  final String? defaultRouteId;

  const _RouteAssessmentFormView({
    required this.driverId,
    required this.driverName,
    this.defaultRouteId,
  });

  @override
  State<_RouteAssessmentFormView> createState() => _RouteAssessmentFormViewState();
}

class _RouteAssessmentFormViewState extends State<_RouteAssessmentFormView> {
  final _formKey = GlobalKey<FormState>();

  String _assessmentType = '0'; // 0 = New Route, 1 = Change in Route
  late final TextEditingController _routeIdCtrl;
  late final TextEditingController _schoolBoardCtrl;
  late final TextEditingController _schoolCtrl;
  late final TextEditingController _schoolYearCtrl;
  late final TextEditingController _summaryCtrl;

  DateTime _assessmentDate = DateTime.now();

  // 11 Core Assessment Safety Checklist Questions
  bool _visibilityProblemCheck = false;
  final TextEditingController _visibilityProblemCtrl = TextEditingController();

  bool _highwayStopConcernCheck = false;
  final TextEditingController _highwayStopConcernCtrl = TextEditingController();

  bool _locationProblemCheck = false;
  final TextEditingController _locationProblemCtrl = TextEditingController();

  bool _unsafeTurnaroundCheck = false;
  final TextEditingController _unsafeTurnaroundCtrl = TextEditingController();

  bool _intersectionCheck = false;
  final TextEditingController _intersectionCtrl = TextEditingController();

  bool _roadwayCheck = false;
  final TextEditingController _roadwayCtrl = TextEditingController();

  bool _nonweatherRiskCheck = false;
  final TextEditingController _nonweatherRiskCtrl = TextEditingController();

  bool _weatherRiskCheck = false;
  final TextEditingController _weatherRiskCtrl = TextEditingController();

  bool _safetyConcernCheck = false;
  final TextEditingController _safetyConcernCtrl = TextEditingController();

  List<String> _attachmentUrls = [];

  @override
  void initState() {
    super.initState();
    _routeIdCtrl = TextEditingController(text: widget.defaultRouteId ?? '');
    _schoolBoardCtrl = TextEditingController(text: 'Public School Board');
    _schoolCtrl = TextEditingController(text: 'Hillcrest High');
    _schoolYearCtrl = TextEditingController(text: '2026-2027');
    _summaryCtrl = TextEditingController();
  }

  @override
  void dispose() {
    _routeIdCtrl.dispose();
    _schoolBoardCtrl.dispose();
    _schoolCtrl.dispose();
    _schoolYearCtrl.dispose();
    _summaryCtrl.dispose();
    _visibilityProblemCtrl.dispose();
    _highwayStopConcernCtrl.dispose();
    _locationProblemCtrl.dispose();
    _unsafeTurnaroundCtrl.dispose();
    _intersectionCtrl.dispose();
    _roadwayCtrl.dispose();
    _nonweatherRiskCtrl.dispose();
    _weatherRiskCtrl.dispose();
    _safetyConcernCtrl.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;

    final now = DateTime.now();
    final model = RouteAssessmentModel(
      id: '',
      assessmentType: _assessmentType,
      routeId: _routeIdCtrl.text.trim(),
      schoolBoard: _schoolBoardCtrl.text.trim(),
      school: _schoolCtrl.text.trim(),
      schoolYear: _schoolYearCtrl.text.trim(),
      assessmentDate: _assessmentDate,
      conductedByDriver: widget.driverName,
      conductedByEmployeeId: widget.driverId,
      summary: _summaryCtrl.text.trim(),

      visibilityProblemCheck: _visibilityProblemCheck,
      visibilityProblem: _visibilityProblemCheck ? _visibilityProblemCtrl.text.trim() : null,

      highwayStopConcernCheck: _highwayStopConcernCheck,
      highwayStopConcern: _highwayStopConcernCheck ? _highwayStopConcernCtrl.text.trim() : null,

      locationProblemCheck: _locationProblemCheck,
      locationProblem: _locationProblemCheck ? _locationProblemCtrl.text.trim() : null,

      unsafeTurnaroundCheck: _unsafeTurnaroundCheck,
      unsafeTurnaround: _unsafeTurnaroundCheck ? _unsafeTurnaroundCtrl.text.trim() : null,

      intersectionCheck: _intersectionCheck,
      intersection: _intersectionCheck ? _intersectionCtrl.text.trim() : null,

      roadwayCheck: _roadwayCheck,
      roadway: _roadwayCheck ? _roadwayCtrl.text.trim() : null,

      nonweatherRiskCheck: _nonweatherRiskCheck,
      nonweatherRisk: _nonweatherRiskCheck ? _nonweatherRiskCtrl.text.trim() : null,

      weatherRiskCheck: _weatherRiskCheck,
      weatherRisk: _weatherRiskCheck ? _weatherRiskCtrl.text.trim() : null,

      safetyConcernCheck: _safetyConcernCheck,
      safetyConcern: _safetyConcernCheck ? _safetyConcernCtrl.text.trim() : null,

      statusInt: 0,
      statusStr: 'Working',
      attachmentUrls: _attachmentUrls,
      createdAt: now,
      updatedAt: now,
    );

    context.read<RouteAssessmentBloc>().add(SubmitRouteAssessment(model));
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return BlocListener<RouteAssessmentBloc, RouteAssessmentState>(
      listener: (context, state) {
        if (state is RouteAssessmentSubmitSuccess) {
          AppFeedback.showSuccess(
            context,
            message: 'Route Assessment submitted successfully!',
          );
          Navigator.of(context).pop();
        } else if (state is RouteAssessmentError) {
          AppFeedback.showError(
            context,
            title: 'Route Assessment Submission Failed',
            message: state.message,
          );
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('New Route Assessment'),
          centerTitle: true,
        ),
        body: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // ─── Header Info Card ──────────────────────────────────────────
              Card(
                elevation: 0,
                color: isDark ? Colors.grey[900] : Colors.grey[50],
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: BorderSide(
                    color: isDark ? Colors.grey[800]! : Colors.grey[200]!,
                  ),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'ASSESSMENT TYPE',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1,
                          color: Colors.grey,
                        ),
                      ),
                      const SizedBox(height: 10),

                      // Segmented Radio Buttons
                      Row(
                        children: [
                          Expanded(
                            child: ChoiceChip(
                              label: const Text('New Route (Dry Run)'),
                              selected: _assessmentType == '0',
                              selectedColor: AppColors.primary.withValues(alpha: 0.2),
                              onSelected: (val) {
                                if (val) setState(() => _assessmentType = '0');
                              },
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: ChoiceChip(
                              label: const Text('Change in Route'),
                              selected: _assessmentType == '1',
                              selectedColor: AppColors.primary.withValues(alpha: 0.2),
                              onSelected: (val) {
                                if (val) setState(() => _assessmentType = '1');
                              },
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        _assessmentType == '0'
                          ? 'Completed prior to school year during route Dry Run.'
                          : 'Completed whenever a change occurs (new student, address change, stop order).',
                        style: TextStyle(fontSize: 11, color: isDark ? Colors.grey[400] : Colors.grey[600]),
                      ),
                      const Divider(height: 24),

                      // Route ID
                      TextFormField(
                        controller: _routeIdCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Route ID / Name *',
                          hintText: 'e.g. Route 001 Hillcrest',
                          prefixIcon: Icon(Icons.alt_route),
                        ),
                        validator: (val) => val == null || val.trim().isEmpty ? 'Route ID is required' : null,
                      ),
                      const SizedBox(height: 14),

                      // School & Board
                      Row(
                        children: [
                          Expanded(
                            child: TextFormField(
                              controller: _schoolCtrl,
                              decoration: const InputDecoration(
                                labelText: 'School Name',
                                prefixIcon: Icon(Icons.school_outlined),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: TextFormField(
                              controller: _schoolBoardCtrl,
                              decoration: const InputDecoration(
                                labelText: 'School Board',
                                prefixIcon: Icon(Icons.account_balance_outlined),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),

                      // School Year & Date
                      Row(
                        children: [
                          Expanded(
                            child: TextFormField(
                              controller: _schoolYearCtrl,
                              decoration: const InputDecoration(
                                labelText: 'School Year',
                                prefixIcon: Icon(Icons.calendar_today_outlined),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: InkWell(
                              onTap: () async {
                                final picked = await showDatePicker(
                                  context: context,
                                  initialDate: _assessmentDate,
                                  firstDate: DateTime(2020),
                                  lastDate: DateTime(2035),
                                );
                                if (picked != null) {
                                  setState(() => _assessmentDate = picked);
                                }
                              },
                              child: InputDecorator(
                                decoration: const InputDecoration(
                                  labelText: 'Assessment Date',
                                  prefixIcon: Icon(Icons.event),
                                ),
                                child: Text(
                                  '${_assessmentDate.year}-${_assessmentDate.month.toString().padLeft(2, '0')}-${_assessmentDate.day.toString().padLeft(2, '0')}',
                                  style: const TextStyle(fontSize: 13),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),

                      // Driver display
                      InputDecorator(
                        decoration: const InputDecoration(
                          labelText: 'Conducted By (Driver)',
                          prefixIcon: Icon(Icons.person_outline),
                        ),
                        child: Text(
                          '${widget.driverName} (${widget.driverId})',
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 16),

              // ─── Findings Summary ──────────────────────────────────────────
              Card(
                elevation: 0,
                color: isDark ? Colors.grey[900] : Colors.grey[50],
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: BorderSide(
                    color: isDark ? Colors.grey[800]! : Colors.grey[200]!,
                  ),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'SUMMARY OF FINDINGS',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1,
                          color: Colors.grey,
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextFormField(
                        controller: _summaryCtrl,
                        maxLines: 3,
                        decoration: const InputDecoration(
                          hintText: 'Summarize overall route safety findings, concerns, or dry-run observations...',
                          alignLabelWithHint: true,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 16),

              // ─── 11 Safety Checklist Questions ─────────────────────────────
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 4, vertical: 6),
                child: Text(
                  'SAFETY ASSESSMENT CHECKLIST (9 ITEMS)',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1,
                    color: Colors.grey,
                  ),
                ),
              ),

              // Q1: Sight Lines & Blind Spots
              _buildQuestionCard(
                questionNumber: 1,
                title: 'Sight Lines & Blind Spots',
                description: 'Are there poor sight lines, blind spots, or visual obstructions on this route or at stop locations? (e.g., hill crests, sharp curves, dense foliage, buildings, or heavy fog)',
                isChecked: _visibilityProblemCheck,
                onCheckChanged: (val) => setState(() => _visibilityProblemCheck = val),
                commentCtrl: _visibilityProblemCtrl,
                commentHint: 'Specify stop location, visual obstruction, and safety risk...',
                isDark: isDark,
              ),

              // Q2: Highway & High-Speed Stops
              _buildQuestionCard(
                questionNumber: 2,
                title: 'Highway & High-Speed Stops',
                description: 'Are there any student stops located on primary or secondary highways and high-speed roads? (e.g., high traffic volume, high approach speeds, poor deceleration visibility, or frequent red light infractions)',
                isChecked: _highwayStopConcernCheck,
                onCheckChanged: (val) => setState(() => _highwayStopConcernCheck = val),
                commentCtrl: _highwayStopConcernCtrl,
                commentHint: 'Specify highway name, milepost / cross street, and observed risk...',
                isDark: isDark,
              ),

              // Q3: Student Loading & School Zones
              _buildQuestionCard(
                questionNumber: 3,
                title: 'Student Loading & School Zones',
                description: 'Do any pick-up, drop-off, or school sites have insufficient physical space or unsafe conditions for loading and unloading? (e.g., overcrowded stops, lack of sidewalks, poor signage, or traffic congestion)',
                isChecked: _locationProblemCheck,
                onCheckChanged: (val) => setState(() => _locationProblemCheck = val),
                commentCtrl: _locationProblemCtrl,
                commentHint: 'Describe location, space constraints, or crowding hazards...',
                isDark: isDark,
              ),

              // Q4: Unsafe Turnarounds & Maneuvers
              _buildQuestionCard(
                questionNumber: 4,
                title: 'Unsafe Turnarounds & Maneuvers',
                description: 'Are there any turnaround locations that present hazards as defined in school bus operating standards? (e.g., backing across traffic lanes, blind turns, narrow driveways, or physical obstacles)',
                isChecked: _unsafeTurnaroundCheck,
                onCheckChanged: (val) => setState(() => _unsafeTurnaroundCheck = val),
                commentCtrl: _unsafeTurnaroundCtrl,
                commentHint: 'Specify turnaround location, obstacles, and oncoming traffic hazards...',
                isDark: isDark,
              ),

              // Q5: Complex Intersections & Railway Crossings
              _buildQuestionCard(
                questionNumber: 5,
                title: 'Complex Intersections & Railway Crossings',
                description: 'Are there roadway crossings of concern along this route, such as uncontrolled intersections, blind merges, or active railway crossings? (e.g., difficult left turns, high-speed cross-traffic, or obstructed signals)',
                isChecked: _intersectionCheck,
                onCheckChanged: (val) => setState(() => _intersectionCheck = val),
                commentCtrl: _intersectionCtrl,
                commentHint: 'Detail intersection or rail crossing location and specific hazards...',
                isDark: isDark,
              ),

              // Q6: Roadway Width, Surface & Clearance
              _buildQuestionCard(
                questionNumber: 6,
                title: 'Roadway Width, Surface & Clearance',
                description: 'Are there any roadways where road structure, width, or overhead height is inadequate for the safe passage of the bus? (e.g., severe heaves, unpaved or rutted surfaces, narrow bridges, soft shoulders, or low branches)',
                isChecked: _roadwayCheck,
                onCheckChanged: (val) => setState(() => _roadwayCheck = val),
                commentCtrl: _roadwayCtrl,
                commentHint: 'Specify road name, bridge / shoulder hazard, or low clearance spot...',
                isDark: isDark,
              ),

              // Q7: Non-Weather Environmental Hazards
              _buildQuestionCard(
                questionNumber: 7,
                title: 'Non-Weather Environmental Hazards',
                description: 'Are there non-weather variable hazards encountered along this route? (e.g., frequent wildlife crossing zones, long-term construction projects, agricultural equipment, or heavy commercial traffic)',
                isChecked: _nonweatherRiskCheck,
                onCheckChanged: (val) => setState(() => _nonweatherRiskCheck = val),
                commentCtrl: _nonweatherRiskCtrl,
                commentHint: 'Describe location of wildlife crossings, active work zones, or hazards...',
                isDark: isDark,
              ),

              // Q8: Weather & Seasonal Road Hazards
              _buildQuestionCard(
                questionNumber: 8,
                title: 'Weather & Seasonal Road Hazards',
                description: 'Are there sections prone to severe weather or seasonal driving hazards? (e.g., wind-blown drifting snow, unplowed rural stretches, ice-prone bridge decks, steep slippery grades, or localized flash flooding)',
                isChecked: _weatherRiskCheck,
                onCheckChanged: (val) => setState(() => _weatherRiskCheck = val),
                commentCtrl: _weatherRiskCtrl,
                commentHint: 'Describe weather-vulnerable sections, ice-prone bridges, or snow drifts...',
                isDark: isDark,
              ),

              // Q9: General Safety Concerns & Notes
              _buildQuestionCard(
                questionNumber: 9,
                title: 'General Safety Concerns & Notes',
                description: 'Do you have any other safety concerns, operational difficulties, or route adjustment recommendations regarding this route?',
                isChecked: _safetyConcernCheck,
                onCheckChanged: (val) => setState(() => _safetyConcernCheck = val),
                commentCtrl: _safetyConcernCtrl,
                commentHint: 'Provide any additional safety concerns, driver observations, or notes...',
                isDark: isDark,
              ),

              const SizedBox(height: 16),

              // ─── Photo Attachments ─────────────────────────────────────────
              AttachmentPickerWidget(
                storageFolder: 'route_assessments',
                title: 'Route & Stop Photos (Optional)',
                initialUrls: _attachmentUrls,
                onAttachmentsChanged: (urls) {
                  setState(() {
                    _attachmentUrls = urls;
                  });
                },
              ),

              const SizedBox(height: 24),

              // ─── Submit Button ─────────────────────────────────────────────
              BlocBuilder<RouteAssessmentBloc, RouteAssessmentState>(
                builder: (context, state) {
                  final isSubmitting = state is RouteAssessmentSubmitting;
                  return ElevatedButton.icon(
                    onPressed: isSubmitting ? null : _submit,
                    icon: isSubmitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Icon(Icons.send_rounded),
                    label: Text(isSubmitting ? 'Submitting Assessment...' : 'Submit Route Assessment'),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      elevation: 1,
                    ),
                  );
                },
              ),
              const SizedBox(height: 40),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildQuestionCard({
    required int questionNumber,
    required String title,
    required String description,
    required bool isChecked,
    required ValueChanged<bool> onCheckChanged,
    required TextEditingController commentCtrl,
    required String commentHint,
    required bool isDark,
  }) {
    return Card(
      elevation: 0,
      color: isChecked
          ? (isDark ? Colors.red.withValues(alpha: 0.18) : Colors.red.withValues(alpha: 0.08))
          : (isDark ? Colors.grey[900] : Colors.grey[50]),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: isChecked
              ? (isDark ? Colors.redAccent : Colors.red[300]!)
              : (isDark ? Colors.grey[800]! : Colors.grey[200]!),
        ),
      ),
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 12,
                  backgroundColor: isChecked ? Colors.red.withValues(alpha: 0.2) : AppColors.primary.withValues(alpha: 0.15),
                  child: Text(
                    '$questionNumber',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: isChecked ? Colors.red : AppColors.primary,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                ),
                Switch.adaptive(
                  value: isChecked,
                  activeThumbColor: Colors.redAccent,
                  onChanged: onCheckChanged,
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              description,
              style: TextStyle(fontSize: 12, color: isDark ? Colors.grey[400] : Colors.grey[600]),
            ),
            if (isChecked) ...[
              const SizedBox(height: 10),
              TextFormField(
                controller: commentCtrl,
                maxLines: 2,
                decoration: InputDecoration(
                  hintText: commentHint,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  contentPadding: const EdgeInsets.all(10),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
