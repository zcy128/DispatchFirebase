import 'package:flutter/material.dart';
import '../../../core/api_client.dart';
import '../../../core/models.dart';
import '../../../core/theme.dart';

/// Modal sheet for parents to review and update personal profile info:
/// Phone number, email address, display name, and home address.
class EditProfileSheet extends StatefulWidget {
  final ApiClient apiClient;
  final String parentContact;
  final ParentUser? initialUser;
  final String? initialAddress;
  final Function(ParentUser updatedUser)? onProfileUpdated;

  const EditProfileSheet({
    super.key,
    required this.apiClient,
    required this.parentContact,
    this.initialUser,
    this.initialAddress,
    this.onProfileUpdated,
  });

  @override
  State<EditProfileSheet> createState() => _EditProfileSheetState();
}

class _EditProfileSheetState extends State<EditProfileSheet> {
  final _formKey = GlobalKey<FormState>();

  late TextEditingController _nameController;
  late TextEditingController _phoneController;
  late TextEditingController _emailController;
  late TextEditingController _addressController;

  bool _isLoading = true;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    final user = widget.initialUser;
    final isEmail = widget.parentContact.contains('@');

    _nameController = TextEditingController(text: user?.displayName ?? '');
    _phoneController = TextEditingController(
      text: user?.phone.isNotEmpty == true ? user!.phone : (isEmail ? '' : widget.parentContact),
    );
    _emailController = TextEditingController(
      text: user?.email.isNotEmpty == true ? user!.email : (isEmail ? widget.parentContact : ''),
    );
    _addressController = TextEditingController(
      text: user?.homeAddress.isNotEmpty == true ? user!.homeAddress : (widget.initialAddress ?? ''),
    );

    _loadProfile();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _addressController.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    try {
      final user = await widget.apiClient.fetchProfile(widget.parentContact);
      if (mounted) {
        setState(() {
          if (_nameController.text.isEmpty && user.displayName.isNotEmpty) {
            _nameController.text = user.displayName;
          }
          if (_phoneController.text.isEmpty && user.phone.isNotEmpty) {
            _phoneController.text = user.phone;
          }
          if (_emailController.text.isEmpty && user.email.isNotEmpty) {
            _emailController.text = user.email;
          }
          if (_addressController.text.isEmpty && user.homeAddress.isNotEmpty) {
            _addressController.text = user.homeAddress;
          }
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _handleSave() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSaving = true);
    try {
      final updated = await widget.apiClient.updateProfile(
        contact: widget.parentContact,
        displayName: _nameController.text.trim(),
        phone: _phoneController.text.trim(),
        email: _emailController.text.trim(),
        homeAddress: _addressController.text.trim(),
      );

      if (widget.onProfileUpdated != null) {
        widget.onProfileUpdated!(updated);
      }

      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Row(
              children: [
                Icon(Icons.check_circle_rounded, color: Colors.white, size: 18),
                SizedBox(width: 8),
                Text('Profile details successfully updated.'),
              ],
            ),
            backgroundColor: AppColors.success,
            duration: Duration(seconds: 3),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to update profile: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.of(context).viewInsets.bottom + 24),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Drag Handle
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.border,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Header
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.person_outline_rounded, color: AppColors.primary, size: 22),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Personal Information',
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.bold,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Update contact phone, email, and home address',
                            style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, color: AppColors.textMuted),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                if (_isLoading)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.symmetric(vertical: 32),
                      child: CircularProgressIndicator(),
                    ),
                  )
                else ...[
                  // Full Name
                  const Text(
                    'Parent / Guardian Name',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 6),
                  TextFormField(
                    controller: _nameController,
                    decoration: InputDecoration(
                      hintText: 'e.g. Sarah Thompson',
                      hintStyle: const TextStyle(fontSize: 13, color: AppColors.textMuted),
                      prefixIcon: const Icon(Icons.badge_outlined, size: 18, color: AppColors.textMuted),
                      filled: true,
                      fillColor: AppColors.surfaceMuted,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    ),
                    validator: (val) {
                      if (val == null || val.trim().isEmpty) {
                        return 'Please enter your name';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Phone Number
                  const Text(
                    'Phone Number',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 6),
                  TextFormField(
                    controller: _phoneController,
                    keyboardType: TextInputType.phone,
                    decoration: InputDecoration(
                      hintText: 'e.g. (613) 555-0199',
                      hintStyle: const TextStyle(fontSize: 13, color: AppColors.textMuted),
                      prefixIcon: const Icon(Icons.phone_outlined, size: 18, color: AppColors.textMuted),
                      filled: true,
                      fillColor: AppColors.surfaceMuted,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    ),
                    validator: (val) {
                      if (val == null || val.trim().isEmpty) {
                        return 'Phone number cannot be empty';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Email Address
                  const Text(
                    'Email Address',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 6),
                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    decoration: InputDecoration(
                      hintText: 'e.g. sarah.thompson@example.com',
                      hintStyle: const TextStyle(fontSize: 13, color: AppColors.textMuted),
                      prefixIcon: const Icon(Icons.mail_outline_rounded, size: 18, color: AppColors.textMuted),
                      filled: true,
                      fillColor: AppColors.surfaceMuted,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Home Address
                  const Text(
                    'Home Address (Primary Residence)',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 6),
                  TextFormField(
                    controller: _addressController,
                    maxLines: 2,
                    decoration: InputDecoration(
                      hintText: 'e.g. 142 Richmond Rd, Ottawa, ON K1Z 6X2',
                      hintStyle: const TextStyle(fontSize: 13, color: AppColors.textMuted),
                      prefixIcon: const Icon(Icons.home_outlined, size: 18, color: AppColors.textMuted),
                      filled: true,
                      fillColor: AppColors.surfaceMuted,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    ),
                    validator: (val) {
                      if (val == null || val.trim().isEmpty) {
                        return 'Home address is required for transit assignment';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Synchronize Notice
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.info.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.info.withValues(alpha: 0.2)),
                    ),
                    child: const Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.info_outline_rounded, color: AppColors.info, size: 16),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Address and contact modifications are automatically submitted to the fleet dispatch office to update student route rosters.',
                            style: TextStyle(fontSize: 11, color: AppColors.textSecondary, height: 1.35),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Save Button
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      onPressed: _isSaving ? null : _handleSave,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        elevation: 0,
                      ),
                      child: _isSaving
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Text(
                              'Save Changes',
                              style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                            ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
