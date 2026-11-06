import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/theme.dart';
import '../models/company_contact_model.dart';
import '../repository/company_contacts_repository.dart';
import 'widgets/company_contact_card.dart';
import 'widgets/company_contact_empty_state.dart';
import 'widgets/company_contact_filter_pills.dart';

/// Company Contacts directory page providing emergency and operational numbers.
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
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  String _selectedDepartment = 'ALL';

  @override
  void initState() {
    super.initState();
    _repository = widget.repository ?? CompanyContactsRepository();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _makePhoneCall(String phoneNumber) async {
    final cleanPhone = phoneNumber.replaceAll(RegExp(r'[^\d+]'), '');
    final Uri launchUri = Uri(
      scheme: 'tel',
      path: cleanPhone,
    );
    try {
      final launched = await launchUrl(launchUri, mode: LaunchMode.externalApplication);
      if (!launched && mounted) {
        await _copyToClipboard(phoneNumber, 'Phone number copied: $phoneNumber');
      }
    } catch (_) {
      if (mounted) {
        await _copyToClipboard(phoneNumber, 'Phone number copied: $phoneNumber');
      }
    }
  }

  Future<void> _sendEmail(String email) async {
    final Uri launchUri = Uri(
      scheme: 'mailto',
      path: email,
    );
    try {
      final launched = await launchUrl(launchUri, mode: LaunchMode.externalApplication);
      if (!launched && mounted) {
        await _copyToClipboard(email, 'Email address copied: $email');
      }
    } catch (_) {
      if (mounted) {
        await _copyToClipboard(email, 'Email address copied: $email');
      }
    }
  }

  Future<void> _copyToClipboard(String text, String message) async {
    await Clipboard.setData(ClipboardData(text: text));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ),
    );
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
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
            ),
            Text(
              'Corporate Emergency Hotlines & Operations Directory',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
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
                      controller: _searchController,
                      decoration: InputDecoration(
                        hintText: 'Search contact, phone or department...',
                        prefixIcon: const Icon(Icons.search_rounded, size: 20),
                        suffixIcon: _searchQuery.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.clear, size: 18),
                                onPressed: () {
                                  setState(() {
                                    _searchController.clear();
                                    _searchQuery = '';
                                  });
                                },
                              )
                            : null,
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
                    CompanyContactFilterPills(
                      departments: departments,
                      selectedDepartment: _selectedDepartment,
                      onDepartmentSelected: (dept) {
                        setState(() {
                          _selectedDepartment = dept;
                        });
                      },
                    ),
                  ],
                ),
              ),

              // Contact cards list
              Expanded(
                child: filteredContacts.isEmpty
                    ? CompanyContactEmptyState(
                        hasQuery: _searchQuery.isNotEmpty || _selectedDepartment != 'ALL',
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                        itemCount: filteredContacts.length,
                        itemBuilder: (context, index) {
                          final c = filteredContacts[index];
                          return CompanyContactCard(
                            contact: c,
                            onCall: () => _makePhoneCall(c.phone),
                            onEmail: () => _sendEmail(c.email),
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
