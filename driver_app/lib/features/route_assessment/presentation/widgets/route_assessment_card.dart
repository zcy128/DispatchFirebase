import 'package:flutter/material.dart';
import '../../../../core/theme.dart';
import '../../models/route_assessment_model.dart';

class RouteAssessmentCard extends StatelessWidget {
  final RouteAssessmentModel item;
  final VoidCallback onTap;

  const RouteAssessmentCard({
    super.key,
    required this.item,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final risks = item.flaggedConcernsCount;
    final isTypeZero = item.assessmentType == '0';
    final typeColor = isTypeZero ? Colors.blue : Colors.purple;
    final dateStr = item.assessmentDate != null
        ? item.assessmentDate!.toLocal().toString().split(' ')[0]
        : item.createdAt.toLocal().toString().split(' ')[0];

    return Card(
      elevation: 0,
      color: isDark ? AppColors.darkCard : AppColors.lightCard,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(
          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top Row: Type Label & Status Badge (overflow safe)
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Flexible(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: typeColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        item.typeLabel,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: typeColor,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  _buildStatusBadge(item.status),
                ],
              ),
              const SizedBox(height: 8),

              // Route ID
              Text(
                item.routeId,
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 4),

              // School & School Year
              Text(
                '${item.school ?? "School"} • ${item.schoolYear}',
                style: TextStyle(
                  fontSize: 12,
                  color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),

              // Summary snippet
              if (item.summary != null && item.summary!.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  item.summary!,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? Colors.grey[300] : Colors.grey[700],
                  ),
                ),
              ],

              const Divider(height: 16),

              // Bottom Row: Date & Risk/Clear badge (overflow safe)
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      dateStr,
                      style: const TextStyle(fontSize: 11, color: Colors.grey),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (risks > 0)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.red.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.warning_amber_rounded, size: 12, color: Colors.red),
                              const SizedBox(width: 3),
                              Text(
                                '$risks Risk${risks > 1 ? "s" : ""}',
                                style: const TextStyle(
                                  fontSize: 10,
                                  color: Colors.red,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        )
                      else
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.green.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Text(
                            'Clear',
                            style: TextStyle(
                              fontSize: 10,
                              color: Colors.green,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      if (item.attachmentUrls.isNotEmpty) ...[
                        const SizedBox(width: 8),
                        Icon(Icons.attach_file, size: 14, color: Colors.grey[500]),
                        Text(
                          '${item.attachmentUrls.length}',
                          style: TextStyle(fontSize: 11, color: Colors.grey[500]),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusBadge(RouteAssessmentStatus status) {
    Color color;
    IconData icon;
    switch (status) {
      case RouteAssessmentStatus.submitted:
        color = Colors.blue;
        icon = Icons.send;
        break;
      case RouteAssessmentStatus.completed:
        color = Colors.green;
        icon = Icons.check_circle;
        break;
      case RouteAssessmentStatus.working:
        color = Colors.amber[800]!;
        icon = Icons.access_time;
        break;
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12, color: color),
        const SizedBox(width: 4),
        Text(
          status.label,
          style: TextStyle(
            fontSize: 11,
            color: color,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }
}
