import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

Future<void> placePhoneCall(
  BuildContext context,
  String? phone,
  String contactName,
) async {
  final raw = phone?.trim() ?? '';
  final dialable = raw.replaceAll(RegExp(r'[^\d+]'), '');
  if (raw.isEmpty || dialable.isEmpty) {
    _showPhoneNotice(context, 'No phone number is on file for $contactName.');
    return;
  }

  final uri = Uri(scheme: 'tel', path: dialable);
  try {
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
      return;
    }
  } catch (_) {}

  await Clipboard.setData(ClipboardData(text: raw));
  if (context.mounted) {
    _showPhoneNotice(context, 'Could not open the dialer. Copied $raw.');
  }
}

void _showPhoneNotice(BuildContext context, String message) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(message),
      behavior: SnackBarBehavior.floating,
      duration: const Duration(seconds: 2),
    ),
  );
}
