import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/app_mode.dart';
import '../../../core/theme.dart';
import '../bloc/auth_bloc.dart';

class OtpScreen extends StatefulWidget {
  final String contact;
  final String? devCode;
  final int matchedCount;

  const OtpScreen({
    super.key,
    required this.contact,
    this.devCode,
    required this.matchedCount,
  });

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  final TextEditingController _codeController = TextEditingController();

  @override
  void initState() {
    super.initState();
    if (AppMode.isDemo && widget.devCode != null && widget.devCode!.isNotEmpty) {
      _codeController.text = widget.devCode!;
    }
  }

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  void _verify() {
    final code = _codeController.text.trim();
    if (code.length >= 4) {
      context.read<AuthBloc>().add(VerifyOtpEvent(widget.contact, code));
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter the 6-digit verification passcode')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => context.read<AuthBloc>().add(LogoutEvent()),
        ),
        title: const Text('Enter Passcode'),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(
                    Icons.mark_email_read_outlined,
                    size: 64,
                    color: AppColors.primary,
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'Check your messages',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'We sent a 6-digit passcode to:\n${widget.contact}',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 15,
                      color: AppColors.textSecondary,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 8),

                  // Matched student count badge
                  Center(
                    child: Chip(
                      avatar: const Icon(Icons.school_rounded, size: 16, color: AppColors.success),
                      label: Text(
                        '${widget.matchedCount} student(s) linked to this contact',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                      ),
                      backgroundColor: AppColors.success.withValues(alpha: 0.1),
                      side: BorderSide.none,
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Dev Code helper if available
                  if (AppMode.isDemo && widget.devCode != null && widget.devCode!.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: InkWell(
                        onTap: () {
                          _codeController.text = widget.devCode!;
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: Colors.amber.shade50,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: Colors.amber.shade300),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.bolt_rounded, size: 18, color: Colors.amber.shade800),
                              const SizedBox(width: 8),
                              Text(
                                'Dev Passcode: ${widget.devCode} (Tap to autofill)',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.amber.shade900,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),

                  // Passcode Input
                  TextField(
                    controller: _codeController,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 10,
                      color: AppColors.primaryDark,
                    ),
                    decoration: InputDecoration(
                      hintText: '••••••',
                      counterText: '',
                      contentPadding: const EdgeInsets.symmetric(vertical: 16),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: const BorderSide(color: AppColors.primary, width: 2.5),
                      ),
                    ),
                    onSubmitted: (_) => _verify(),
                  ),
                  const SizedBox(height: 24),

                  // Verify & Enter Button
                  BlocBuilder<AuthBloc, AuthState>(
                    builder: (context, state) {
                      final isLoading = state is AuthLoadingState;
                      return ElevatedButton(
                        onPressed: isLoading ? null : _verify,
                        child: isLoading
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                              )
                            : const Text('Verify & Open Bus Tracker'),
                      );
                    },
                  ),
                  const SizedBox(height: 16),

                  // Resend / Back
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      TextButton(
                        onPressed: () {
                          context.read<AuthBloc>().add(RequestOtpEvent(widget.contact));
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('New passcode requested!')),
                          );
                        },
                        child: const Text('Resend passcode'),
                      ),
                      const Text('•', style: TextStyle(color: AppColors.textMuted)),
                      TextButton(
                        onPressed: () => context.read<AuthBloc>().add(LogoutEvent()),
                        child: const Text('Change contact'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
