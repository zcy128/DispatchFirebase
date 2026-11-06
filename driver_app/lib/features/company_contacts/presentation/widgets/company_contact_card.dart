import 'package:flutter/material.dart';
import '../../../../core/theme.dart';
import '../../models/company_contact_model.dart';

/// Card widget presenting individual company contact with direct call & email actions.
class CompanyContactCard extends StatelessWidget {
  final CompanyContactModel contact;
  final VoidCallback onCall;
  final VoidCallback onEmail;

  const CompanyContactCard({
    super.key,
    required this.contact,
    required this.onCall,
    required this.onEmail,
  });

  static Color getDeptColor(String department) {
    switch (department.toLowerCase()) {
      case 'emergency':
        return const Color(0xFFF43F5E); // Rose
      case 'operations':
        return const Color(0xFF3B82F6); // Blue
      case 'fleet':
        return const Color(0xFF10B981); // Emerald
      case 'hr':
        return const Color(0xFFEC4899); // Pink
      case 'training':
        return const Color(0xFFF59E0B); // Amber
      case 'finance':
        return const Color(0xFF14B8A6); // Teal
      default:
        return AppColors.primary;
    }
  }

  static IconData getDeptIcon(String department) {
    switch (department.toLowerCase()) {
      case 'emergency':
        return Icons.emergency_rounded;
      case 'operations':
        return Icons.headset_mic_rounded;
      case 'fleet':
        return Icons.build_circle_rounded;
      case 'hr':
        return Icons.badge_rounded;
      case 'finance':
        return Icons.receipt_long_rounded;
      case 'training':
        return Icons.school_rounded;
      default:
        return Icons.business_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final deptColor = getDeptColor(contact.department);
    final deptIcon = getDeptIcon(contact.department);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: contact.is24x7
              ? deptColor.withValues(alpha: 0.45)
              : (isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder),
          width: contact.is24x7 ? 1.5 : 1,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header Row: Dept Icon + Name + 24/7 Badge
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(9),
                  decoration: BoxDecoration(
                    color: deptColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(deptIcon, color: deptColor, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              contact.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 14.5,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          if (contact.is24x7) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.error.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(5),
                              ),
                              child: const Text(
                                '24/7 LIVE',
                                style: TextStyle(
                                  color: AppColors.error,
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        contact.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12,
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

            if (contact.notes != null && contact.notes!.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(
                contact.notes!,
                style: const TextStyle(fontSize: 11.5, color: Colors.grey),
              ),
            ],

            const SizedBox(height: 12),

            // Operating Hours & Department Tag
            Row(
              children: [
                Icon(
                  Icons.access_time_rounded,
                  size: 13,
                  color: isDark ? Colors.grey.shade400 : Colors.grey.shade600,
                ),
                const SizedBox(width: 5),
                Expanded(
                  child: Text(
                    contact.hours,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 11,
                      color: isDark
                          ? AppColors.textSecondaryDark
                          : AppColors.textSecondaryLight,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                    color: deptColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    contact.department.toUpperCase(),
                    style: TextStyle(
                      color: deptColor,
                      fontSize: 9.5,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 12),
            const Divider(height: 1),
            const SizedBox(height: 10),

            // Action Buttons: Call & Email
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: onCall,
                    icon: const Icon(Icons.phone_in_talk_rounded, size: 15),
                    label: Text(
                      contact.extension != null && contact.extension!.isNotEmpty
                          ? '${contact.phone} (${contact.extension})'
                          : contact.phone,
                      style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold),
                      overflow: TextOverflow.ellipsis,
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: deptColor,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Tooltip(
                  message: 'Send Email to ${contact.email}',
                  child: OutlinedButton(
                    onPressed: onEmail,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: isDark ? Colors.white70 : Colors.black87,
                      side: BorderSide(
                        color: isDark
                            ? AppColors.darkCardBorder
                            : AppColors.lightCardBorder,
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    child: const Icon(Icons.mail_outline_rounded, size: 16),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
