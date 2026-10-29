import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/theme.dart';
import '../models/company_contact_model.dart';
import '../repository/company_contacts_repository.dart';

class CompanyContactsPage extends StatefulWidget {
  final CompanyContactsRepository? repository;

  const CompanyContactsPage({
    super.key,
    this.repository,
  });

  @override
  State<CompanyContactsPage> createState() => _CompanyContactsPageState();
}

class _CompanyContactsPageState extends State<CompanyContactsPage> {
  late final CompanyContactsRepository _repository;
  String _searchQuery = '';
  String _selectedDepartment = 'ALL';

  @override
  void initState() {
    super.initState();
    _repository = widget.repository ?? CompanyContactsRepository();
  }

  Future<void> _makePhoneCall(BuildContext context, String phoneNumber) async {
    final cleanPhone = phoneNumber.replaceAll(RegExp(r'[^\d+]'), '');
    final Uri launchUri = Uri(
      scheme: 'tel',
      path: cleanPhone,
    );
    try {
      if (await canLaunchUrl(launchUri)) {
        await launchUrl(launchUri);
      } else {
        await Clipboard.setData(ClipboardData(text: phoneNumber));
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Phone number copied: $phoneNumber'),
              behavior: SnackBarBehavior.floating,
              duration: const Duration(seconds: 2),
            ),
          );
        }
      }
    } catch (_) {
      await Clipboard.setData(ClipboardData(text: phoneNumber));
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Phone number copied: $phoneNumber'),
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 2),
          ),
        );
      }
    }
  }

  Future<void> _sendEmail(BuildContext context, String email) async {
    final Uri launchUri = Uri(
      scheme: 'mailto',
      path: email,
    );
    try {
      if (await canLaunchUrl(launchUri)) {
        await launchUrl(launchUri);
      } else {
        await Clipboard.setData(ClipboardData(text: email));
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Email address copied: $email'),
              behavior: SnackBarBehavior.floating,
              duration: const Duration(seconds: 2),
            ),
          );
        }
      }
    } catch (_) {
      await Clipboard.setData(ClipboardData(text: email));
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Email address copied: $email'),
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 2),
          ),
        );
      }
    }
  }

  Color _getDeptColor(String department) {
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

  IconData _getDeptIcon(String department) {
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

    return Scaffold(
      appBar: AppBar(
        elevation: 0,
        backgroundColor: isDark ? AppColors.darkCard : Colors.white,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Company Contacts',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
            ),
            Text(
              'Corporate Emergency Hotlines & Operations Directory',
              style: TextStyle(
                fontSize: 11,
                color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
              ),
            ),
          ],
        ),
      ),
      body: StreamBuilder<List<CompanyContactModel>>(
        stream: _repository.streamContacts(),
        builder: (context, snapshot) {
          final allContacts = snapshot.data ?? CompanyContactsRepository.defaultContacts;

          final departments = ['ALL', ...allContacts.map((c) => c.department).toSet()];

          final filteredContacts = allContacts.where((contact) {
            final matchesDept = _selectedDepartment == 'ALL' ||
                contact.department.toLowerCase() == _selectedDepartment.toLowerCase();
            final matchesSearch = _searchQuery.isEmpty ||
                contact.name.toLowerCase().contains(_searchQuery.toLowerCase()) ||
                contact.title.toLowerCase().contains(_searchQuery.toLowerCase()) ||
                contact.phone.contains(_searchQuery) ||
                contact.department.toLowerCase().contains(_searchQuery.toLowerCase());
            return matchesDept && matchesSearch;
          }).toList();

          return Column(
            children: [
              // Search & Filter header
              Container(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                color: isDark ? AppColors.darkCard : Colors.white,
                child: Column(
                  children: [
                    TextField(
                      decoration: InputDecoration(
                        hintText: 'Search contact, phone or department...',
                        prefixIcon: const Icon(Icons.search_rounded, size: 20),
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: BorderSide(
                            color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
                          ),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: BorderSide(
                            color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
                          ),
                        ),
                      ),
                      onChanged: (val) {
                        setState(() {
                          _searchQuery = val.trim();
                        });
                      },
                    ),
                    const SizedBox(height: 10),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: departments.map((dept) {
                          final isSelected = _selectedDepartment == dept;
                          return Padding(
                            padding: const EdgeInsets.only(right: 6),
                            child: FilterChip(
                              label: Text(dept, style: const TextStyle(fontSize: 11)),
                              selected: isSelected,
                              onSelected: (_) {
                                setState(() {
                                  _selectedDepartment = dept;
                                });
                              },
                              selectedColor: AppColors.primary.withValues(alpha: 0.25),
                              checkmarkColor: AppColors.primary,
                              labelStyle: TextStyle(
                                color: isSelected
                                    ? AppColors.primary
                                    : (isDark ? Colors.white70 : Colors.black87),
                                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                              ),
                              visualDensity: VisualDensity.compact,
                              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                  ],
                ),
              ),

              // Contact cards list
              Expanded(
                child: filteredContacts.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.contact_phone_outlined,
                              size: 48,
                              color: isDark ? Colors.grey.shade700 : Colors.grey.shade400,
                            ),
                            const SizedBox(height: 12),
                            const Text(
                              'No matching contacts found',
                              style: TextStyle(fontSize: 14, color: Colors.grey),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                        itemCount: filteredContacts.length,
                        itemBuilder: (context, index) {
                          final c = filteredContacts[index];
                          final deptColor = _getDeptColor(c.department);
                          final deptIcon = _getDeptIcon(c.department);

                          return Container(
                            margin: const EdgeInsets.only(bottom: 12),
                            decoration: BoxDecoration(
                              color: isDark ? AppColors.darkCard : Colors.white,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: c.is24x7
                                    ? deptColor.withValues(alpha: 0.45)
                                    : (isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder),
                                width: c.is24x7 ? 1.5 : 1,
                              ),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(14),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
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
                                                    c.name,
                                                    style: const TextStyle(
                                                      fontSize: 14.5,
                                                      fontWeight: FontWeight.bold,
                                                    ),
                                                  ),
                                                ),
                                                if (c.is24x7)
                                                  Container(
                                                    padding: const EdgeInsets.symmetric(
                                                        horizontal: 6, vertical: 2),
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
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              c.title,
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

                                  if (c.notes != null && c.notes!.isNotEmpty) ...[
                                    const SizedBox(height: 10),
                                    Text(
                                      c.notes!,
                                      style: const TextStyle(fontSize: 11.5, color: Colors.grey),
                                    ),
                                  ],

                                  const SizedBox(height: 12),
                                  Row(
                                    children: [
                                      Icon(Icons.access_time_rounded,
                                          size: 13,
                                          color: isDark ? Colors.grey.shade400 : Colors.grey.shade600),
                                      const SizedBox(width: 5),
                                      Text(
                                        c.hours,
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: isDark
                                              ? AppColors.textSecondaryDark
                                              : AppColors.textSecondaryLight,
                                        ),
                                      ),
                                      const Spacer(),
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 7, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: deptColor.withValues(alpha: 0.1),
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: Text(
                                          c.department.toUpperCase(),
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
                                          onPressed: () => _makePhoneCall(context, c.phone),
                                          icon: const Icon(Icons.phone_in_talk_rounded, size: 15),
                                          label: Text(
                                            c.extension != null && c.extension!.isNotEmpty
                                                ? '${c.phone} (${c.extension})'
                                                : c.phone,
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
                                      OutlinedButton(
                                        onPressed: () => _sendEmail(context, c.email),
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
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}
