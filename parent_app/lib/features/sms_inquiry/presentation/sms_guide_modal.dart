import 'package:flutter/material.dart';
import '../../../core/theme.dart';

class SmsGuideModal extends StatelessWidget {
  const SmsGuideModal({super.key});

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.sms_outlined, color: AppColors.primary, size: 24),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('SMS Instant Bus Inquiry', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        Text('Twilio Automated Response', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, size: 20),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Text(
                'No data or app needed! Send a text message from your registered phone to our automated transit hotline:',
                style: TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
              ),
              const SizedBox(height: 12),

              // Phone number badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: AppColors.surfaceMuted,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.phone_rounded, size: 18, color: AppColors.primary),
                    SizedBox(width: 8),
                    Text(
                      '(613) 555-0188',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              const Text('How it works:', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              _buildStepItem('1', 'Text "ETA" or "WHERE"', 'Our Twilio API automatically verifies your phone and looks up your children\'s active bus.'),
              const SizedBox(height: 8),
              _buildStepItem('2', 'Multi-Child Support', 'If you have multiple children, text "1" or "2" to get detailed stop & delay info for that child.'),
              const SizedBox(height: 8),
              _buildStepItem('3', 'Sample SMS Reply', '[PCY Dispatch] Emma Watson (Bus #42): En Route. Sched: 07:35 | ETA: 07:37 AM (~5 mins away).'),

              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Got It'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStepItem(String badge, String title, String subtitle) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        CircleAvatar(
          radius: 11,
          backgroundColor: AppColors.primary.withValues(alpha: 0.15),
          child: Text(badge, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primary)),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
              const SizedBox(height: 2),
              Text(subtitle, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary, height: 1.3)),
            ],
          ),
        ),
      ],
    );
  }
}
