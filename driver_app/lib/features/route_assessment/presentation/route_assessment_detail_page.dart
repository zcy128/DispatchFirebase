import 'package:flutter/material.dart';
import '../../../core/theme.dart';
import '../../../core/widgets/attachment_picker_widget.dart';
import '../models/route_assessment_model.dart';

class RouteAssessmentDetailPage extends StatelessWidget {
  final RouteAssessmentModel assessment;

  const RouteAssessmentDetailPage({
    super.key,
    required this.assessment,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: Text('Assessment: ${assessment.routeId}'),
        centerTitle: true,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ─── Status Badge Card ─────────────────────────────────────────────
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
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: assessment.assessmentType == '0'
                              ? Colors.blue.withValues(alpha: 0.15)
                              : Colors.purple.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          assessment.typeLabel,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: assessment.assessmentType == '0' ? Colors.blue : Colors.purple,
                          ),
                        ),
                      ),
                      _buildStatusChip(assessment.status),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    assessment.routeId,
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${assessment.school ?? "School"} • ${assessment.schoolBoard ?? "Board"} • ${assessment.schoolYear}',
                    style: TextStyle(fontSize: 12, color: isDark ? Colors.grey[400] : Colors.grey[600]),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Conducted by ${assessment.conductedByDriver} on ${assessment.assessmentDate != null ? assessment.assessmentDate!.toLocal().toString().split(" ")[0] : assessment.createdAt.toLocal().toString().split(" ")[0]}',
                    style: const TextStyle(fontSize: 11, color: Colors.grey),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 12),

          // ─── Office Processing Status ──────────────────────────────────────
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
                    'SAFETY OFFICE REVIEW',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1,
                      color: AppColors.primary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Text('Assigned To: ', style: TextStyle(fontSize: 12, color: Colors.grey)),
                      Text(
                        assessment.assignedTo ?? 'Unassigned',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(
                        assessment.isCompleted ? Icons.check_circle : Icons.radio_button_unchecked,
                        size: 16,
                        color: assessment.isCompleted ? Colors.green : Colors.grey,
                      ),
                      const SizedBox(width: 6),
                      Text('Completed: ${assessment.isCompleted ? "Yes" : "No"}', style: const TextStyle(fontSize: 12)),
                      const SizedBox(width: 16),
                      Icon(
                        assessment.isSubmitted ? Icons.check_circle : Icons.radio_button_unchecked,
                        size: 16,
                        color: assessment.isSubmitted ? Colors.blue : Colors.grey,
                      ),
                      const SizedBox(width: 6),
                      Text('Submitted: ${assessment.isSubmitted ? "Yes" : "No"}', style: const TextStyle(fontSize: 12)),
                    ],
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 12),

          // ─── Summary ───────────────────────────────────────────────────────
          if (assessment.summary != null && assessment.summary!.isNotEmpty) ...[
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
                    const SizedBox(height: 8),
                    Text(assessment.summary!, style: const TextStyle(fontSize: 13)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
          ],

          // ─── 11 Safety Questions ───────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'SAFETY CHECKLIST (9 ITEMS)',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1,
                    color: Colors.grey,
                  ),
                ),
                Text(
                  '${assessment.flaggedConcernsCount} Flagged',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: assessment.flaggedConcernsCount > 0 ? Colors.red : Colors.green,
                  ),
                ),
              ],
            ),
          ),

          _buildQuestionItem(1, 'Sight Lines & Blind Spots', assessment.visibilityProblemCheck, assessment.visibilityProblem, isDark),
          _buildQuestionItem(2, 'Highway & High-Speed Stops', assessment.highwayStopConcernCheck, assessment.highwayStopConcern, isDark),
          _buildQuestionItem(3, 'Student Loading & School Zones', assessment.locationProblemCheck, assessment.locationProblem, isDark),
          _buildQuestionItem(4, 'Unsafe Turnarounds & Maneuvers', assessment.unsafeTurnaroundCheck, assessment.unsafeTurnaround, isDark),
          _buildQuestionItem(5, 'Complex Intersections & Railway Crossings', assessment.intersectionCheck, assessment.intersection, isDark),
          _buildQuestionItem(6, 'Roadway Width, Surface & Clearance', assessment.roadwayCheck, assessment.roadway, isDark),
          _buildQuestionItem(7, 'Non-Weather Environmental Hazards', assessment.nonweatherRiskCheck, assessment.nonweatherRisk, isDark),
          _buildQuestionItem(8, 'Weather & Seasonal Road Hazards', assessment.weatherRiskCheck, assessment.weatherRisk, isDark),
          _buildQuestionItem(9, 'General Safety Concerns & Notes', assessment.safetyConcernCheck, assessment.safetyConcern, isDark),

          const SizedBox(height: 12),

          // ─── Attachments ───────────────────────────────────────────────────
          if (assessment.attachmentUrls.isNotEmpty)
            AttachmentPickerWidget(
              storageFolder: 'route_assessments',
              title: 'Attached Route Photos (${assessment.attachmentUrls.length})',
              initialUrls: assessment.attachmentUrls,
              readOnly: true,
            ),

          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildStatusChip(RouteAssessmentStatus status) {
    Color bg;
    Color fg;
    IconData icon;

    switch (status) {
      case RouteAssessmentStatus.submitted:
        bg = Colors.blue.withValues(alpha: 0.15);
        fg = Colors.blue;
        icon = Icons.send;
        break;
      case RouteAssessmentStatus.completed:
        bg = Colors.green.withValues(alpha: 0.15);
        fg = Colors.green;
        icon = Icons.check_circle;
        break;
      case RouteAssessmentStatus.working:
        bg = Colors.amber.withValues(alpha: 0.15);
        fg = Colors.amber[800]!;
        icon = Icons.access_time;
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: fg),
          const SizedBox(width: 4),
          Text(status.label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: fg)),
        ],
      ),
    );
  }

  Widget _buildQuestionItem(int num, String title, bool isChecked, String? comment, bool isDark) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isChecked
            ? (isDark ? Colors.red.withValues(alpha: 0.18) : Colors.red.withValues(alpha: 0.08))
            : (isDark ? Colors.grey[900] : Colors.grey[50]),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isChecked
              ? (isDark ? Colors.redAccent : Colors.red[300]!)
              : (isDark ? Colors.grey[800]! : Colors.grey[200]!),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                isChecked ? Icons.warning_amber_rounded : Icons.check,
                size: 16,
                color: isChecked ? Colors.red : Colors.green,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  '$num. $title',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: isChecked ? (isDark ? Colors.red[300] : Colors.red[800]) : null,
                  ),
                ),
              ),
              Text(
                isChecked ? 'YES' : 'NO',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: isChecked ? Colors.red : Colors.green,
                ),
              ),
            ],
          ),
          if (isChecked && comment != null && comment.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              comment,
              style: TextStyle(fontSize: 11, color: isDark ? Colors.grey[300] : Colors.grey[800]),
            ),
          ],
        ],
      ),
    );
  }
}
