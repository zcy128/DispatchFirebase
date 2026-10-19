import 'package:flutter/material.dart';
import '../../../core/api_client.dart';
import '../../../core/models.dart';
import '../../../core/theme.dart';

class NotificationSettingsSheet extends StatefulWidget {
  final ApiClient apiClient;
  const NotificationSettingsSheet({super.key, required this.apiClient});

  @override
  State<NotificationSettingsSheet> createState() => _NotificationSettingsSheetState();
}

class _NotificationSettingsSheetState extends State<NotificationSettingsSheet> {
  ParentNotificationConfig _config = ParentNotificationConfig();
  bool _isLoading = true;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await widget.apiClient.fetchPreferences();
      setState(() {
        _config = res;
        _isLoading = false;
      });
    } catch (_) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _save() async {
    setState(() => _isSaving = true);
    try {
      await widget.apiClient.savePreferences(_config);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Alert preferences saved successfully!')),
        );
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to save: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        child: _isLoading
            ? const Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator()))
            : SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: AppColors.border,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Notification Alerts',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close_rounded),
                        onPressed: () => Navigator.of(context).pop(),
                      ),
                    ],
                  ),
                  const Text(
                    'Customize when and how you want to be notified about your child’s bus.',
                    style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 20),

                  // Section 1: Alert Triggers
                  const Text('ALERT TRIGGERS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted, letterSpacing: 0.5)),
                  const SizedBox(height: 8),

                  SwitchListTile.adaptive(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Approaching Stop Alert', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                    subtitle: Text('Notify me ${_config.approachingMinutes} minutes before arrival', style: const TextStyle(fontSize: 12)),
                    value: _config.notifyApproaching,
                    onChanged: (val) => setState(() => _config.notifyApproaching = val),
                  ),
                  if (_config.notifyApproaching)
                    Padding(
                      padding: const EdgeInsets.only(left: 8, right: 8, bottom: 8),
                      child: Row(
                        children: [
                          const Text('3 min', style: TextStyle(fontSize: 12, color: AppColors.textMuted)),
                          Expanded(
                            child: Slider(
                              value: _config.approachingMinutes.toDouble(),
                              min: 3,
                              max: 15,
                              divisions: 4,
                              label: '${_config.approachingMinutes}m',
                              onChanged: (v) => setState(() => _config.approachingMinutes = v.round()),
                            ),
                          ),
                          const Text('15 min', style: TextStyle(fontSize: 12, color: AppColors.textMuted)),
                        ],
                      ),
                    ),

                  SwitchListTile.adaptive(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Delay & Traffic Alert', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                    subtitle: const Text('Alert if bus is running late by > 10 minutes', style: TextStyle(fontSize: 12)),
                    value: _config.notifyDelay,
                    onChanged: (val) => setState(() => _config.notifyDelay = val),
                  ),

                  SwitchListTile.adaptive(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Boarding & Dropoff Scan', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                    subtitle: const Text('Alert when child boards or safely exits the bus', style: TextStyle(fontSize: 12)),
                    value: _config.notifyBoarding,
                    onChanged: (val) => setState(() {
                      _config.notifyBoarding = val;
                      _config.notifyDropoff = val;
                    }),
                  ),

                  const Divider(height: 32),

                  // Section 2: Delivery Channels
                  const Text('DELIVERY CHANNELS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted, letterSpacing: 0.5)),
                  const SizedBox(height: 8),

                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Push Notification (App)', style: TextStyle(fontSize: 14)),
                    secondary: const Icon(Icons.notifications_active_outlined, color: AppColors.primary),
                    value: _config.channelPush,
                    onChanged: (val) => setState(() => _config.channelPush = val ?? true),
                  ),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('SMS Text Message (Twilio)', style: TextStyle(fontSize: 14)),
                    secondary: const Icon(Icons.sms_outlined, color: AppColors.success),
                    value: _config.channelSms,
                    onChanged: (val) => setState(() => _config.channelSms = val ?? false),
                  ),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Email Updates', style: TextStyle(fontSize: 14)),
                    secondary: const Icon(Icons.mail_outline, color: AppColors.info),
                    value: _config.channelEmail,
                    onChanged: (val) => setState(() => _config.channelEmail = val ?? false),
                  ),

                  const SizedBox(height: 24),

                  ElevatedButton(
                    onPressed: _isSaving ? null : _save,
                    child: _isSaving
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('Save Alert Settings'),
                  ),
                  const SizedBox(height: 12),
                ],
              ),
            ),
      ),
    );
  }
}
