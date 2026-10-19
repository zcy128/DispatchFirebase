import 'package:flutter/material.dart';
import '../../../core/theme.dart';
import '../../../core/widgets/attachment_picker_widget.dart';
import '../models/hazard_report_model.dart';

class HazardReportDetailPage extends StatelessWidget {
  final HazardReportModel report;

  const HazardReportDetailPage({
    super.key,
    required this.report,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final status = report.status;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Hazard #${report.id.length > 6 ? report.id.substring(report.id.length - 6) : report.id}',
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
        children: [
          // ─── Status Banner ─────────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: status.color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: status.color.withValues(alpha: 0.3)),
            ),
            child: Row(
              children: [
                Icon(status.icon, color: status.color, size: 24),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        status.label,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: status.color,
                        ),
                      ),
                      Text(
                        report.isCompleted || report.statusInt == 2
                          ? 'This hazard report has been reviewed and resolved by dispatch.'
                          : report.statusInt == 1
                              ? 'Safety investigation and corrective action in progress.'
                              : 'Pending evaluation by safety office.',
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

          // ─── Event & Route Details ─────────────────────────────────────────
          Container(
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
                  'REPORT DETAILS',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.8,
                    color: Colors.grey,
                  ),
                ),
                const SizedBox(height: 12),
                _buildInfoRow('Reported By', report.reportedBy, isDark),
                if (report.routeId != null)
                  _buildInfoRow('Route', report.routeId!, isDark),
                if (report.unitNumber != null)
                  _buildInfoRow('Vehicle Unit', report.unitNumber!, isDark),
                if (report.eventTime != null)
                  _buildInfoRow('Time of Event', report.eventTime!, isDark),
                if (report.eventLocation != null)
                  _buildInfoRow('Location', report.eventLocation!, isDark),
                if (report.personInvolved != null)
                  _buildInfoRow('Person Involved', report.personInvolved!, isDark),
                if (report.witnesses != null)
                  _buildInfoRow('Witnesses', report.witnesses!, isDark),
                if (report.phone != null)
                  _buildInfoRow('Contact Phone', report.phone!, isDark),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // ─── Hazard & Close Call Classifications ───────────────────────────
          if (report.activeHazardLabels.isNotEmpty || report.activeCloseCallLabels.isNotEmpty) ...[
            Container(
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
                    'CLASSIFICATIONS',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.8,
                      color: Colors.grey,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      ...report.activeHazardLabels.map(
                        (l) => Chip(
                          label: Text(l),
                          backgroundColor: const Color(0xFFD97706).withValues(alpha: 0.15),
                          labelStyle: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFFD97706),
                          ),
                          visualDensity: VisualDensity.compact,
                        ),
                      ),
                      ...report.activeCloseCallLabels.map(
                        (l) => Chip(
                          label: Text(l),
                          backgroundColor: const Color(0xFF4F46E5).withValues(alpha: 0.15),
                          labelStyle: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF4F46E5),
                          ),
                          visualDensity: VisualDensity.compact,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],

          // ─── Event Description ─────────────────────────────────────────────
          Container(
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
                  'EVENT DESCRIPTION',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.8,
                    color: Colors.grey,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  report.eventDescription,
                  style: const TextStyle(fontSize: 13, height: 1.5),
                ),
                if (report.suggestion != null && report.suggestion!.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  const Divider(),
                  const SizedBox(height: 8),
                  const Text(
                    'Suggested Corrective Action:',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: Colors.grey,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    report.suggestion!,
                    style: const TextStyle(fontSize: 12, fontStyle: FontStyle.italic),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),

          // ─── Photo Attachments ─────────────────────────────────────────────
          if (report.attachmentUrls.isNotEmpty) ...[
            AttachmentPickerWidget(
              initialUrls: report.attachmentUrls,
              readOnly: true,
            ),
            const SizedBox(height: 16),
          ],

          // ─── Health & Safety Office Evaluation ─────────────────────────────
          Container(
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
                    const Icon(
                      Icons.shield_outlined,
                      size: 18,
                      color: Color(0xFFD97706),
                    ),
                    const SizedBox(width: 8),
                    const Text(
                      'HEALTH & SAFETY OFFICE EVALUATION',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.8,
                        color: Color(0xFFD97706),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                if (report.officeHazardType != null)
                  _buildInfoRow('Office Type', report.officeHazardType!, isDark),
                if (report.assignedTo != null && report.assignedTo!.isNotEmpty)
                  _buildInfoRow('Assigned To', report.assignedTo!, isDark),
                if (report.actionTaken != null && report.actionTaken!.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  const Text(
                    'Corrective Action Taken:',
                    style: TextStyle(fontSize: 11, color: Colors.grey),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    report.actionTaken!,
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
                  ),
                ],
                const SizedBox(height: 8),
                _buildRiskPills(isDark),
              ],
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value, bool isDark) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12,
                color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRiskPills(bool isDark) {
    final severity = report.serious
        ? 'Serious'
        : report.moderate
            ? 'Moderate'
            : report.minor
                ? 'Minor'
                : 'Not Evaluated';

    final recurrence = report.probableRecurrence
        ? 'Probable'
        : report.occasional
            ? 'Occasional'
            : report.rare
                ? 'Rare'
                : 'Not Evaluated';

    return Row(
      children: [
        Expanded(
          child: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: isDark ? Colors.black26 : Colors.grey.shade50,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Severity:', style: TextStyle(fontSize: 10, color: Colors.grey)),
                Text(
                  severity,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: report.serious
                        ? Colors.red
                        : report.moderate
                            ? Colors.orange
                            : Colors.green,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: isDark ? Colors.black26 : Colors.grey.shade50,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Recurrence:', style: TextStyle(fontSize: 10, color: Colors.grey)),
                Text(
                  recurrence,
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
