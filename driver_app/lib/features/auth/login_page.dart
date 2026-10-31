import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../../core/api_config.dart';
import '../../core/network/api_client.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/app_mode.dart';
import '../../core/services/device_token_service.dart';
import '../../core/theme.dart';
import '../home/driver_home_page.dart';
import 'driver_session.dart';
import 'forgot_password_dialog.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _obscurePassword = true;
  bool _rememberMe = true;
  bool _isLoading = false;
  bool _notificationAuthorized = false;
  bool _notificationDenied = false;
  String _selectedRole = 'Driver';
  String _appVersion = 'v1.0.0 (Build 1)';
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadSavedPreferences();
    _loadAppVersion();
    _checkNotificationStatus();
  }

  Future<void> _checkNotificationStatus() async {
    try {
      final status = await DeviceTokenService().getPermissionStatus();
      if (mounted) {
        setState(() {
          _notificationAuthorized = (status == AuthorizationStatus.authorized || status == AuthorizationStatus.provisional);
          _notificationDenied = (status == AuthorizationStatus.denied);
        });
      }
    } catch (_) {}
  }

  Future<void> _requestNotificationPermission() async {
    try {
      final settings = await DeviceTokenService().requestPermission();
      if (settings != null && mounted) {
        setState(() {
          _notificationAuthorized = (settings.authorizationStatus == AuthorizationStatus.authorized || settings.authorizationStatus == AuthorizationStatus.provisional);
          _notificationDenied = (settings.authorizationStatus == AuthorizationStatus.denied);
        });
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _loadAppVersion() async {
    try {
      final info = await PackageInfo.fromPlatform();
      if (mounted && info.version.isNotEmpty) {
        setState(() {
          _appVersion = 'v${info.version} (Build ${info.buildNumber})';
        });
      }
    } catch (_) {
      // Fallback kept as default
    }
  }

  Future<void> _loadSavedPreferences() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final remember = prefs.getBool('driver_remember_me') ?? true;
      final savedEmail = prefs.getString('driver_saved_email') ?? '';
      final savedRole = prefs.getString('driver_saved_role') ?? 'Driver';

      if (mounted) {
        setState(() {
          _rememberMe = remember;
          _selectedRole = savedRole;
          if (remember && savedEmail.isNotEmpty) {
            _emailController.text = savedEmail;
          } else if (AppMode.isDemo) {
            _emailController.text = 'driver1d';
            _passwordController.text = LoginResolver.demoPassword;
          }
        });
      }
    } catch (_) {}
  }

  Future<void> _savePreferences() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('driver_remember_me', _rememberMe);
      if (_rememberMe) {
        await prefs.setString('driver_saved_email', _emailController.text.trim());
        await prefs.setString('driver_saved_role', _selectedRole);
      } else {
        await prefs.remove('driver_saved_email');
      }
    } catch (_) {}
  }

  Future<void> _recordLoginLog({
    required bool isSuccess,
    required String username,
    String? employeeName,
    String? failureReason,
  }) async {
    try {
      final now = DateTime.now();
      final dateStr = '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
      await FirebaseFirestore.instance.collection('login_logs').add({
        'timestamp': now.toIso8601String(),
        'date': dateStr,
        'status': isSuccess ? 'success' : 'failure',
        'username': username,
        if (isSuccess && employeeName != null) 'employeeName': employeeName,
        'role': _selectedRole.toLowerCase(),
        'app': 'Driver Mobile App',
        'appVersion': _appVersion,
        if (!isSuccess && failureReason != null) 'failureReason': failureReason,
        'deviceInfo': 'Mobile / Tablet',
        'serverTimestamp': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      debugPrint('Notice: driver app login audit log record: $e');
    }
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) {
      _recordLoginLog(
        isSuccess: false,
        username: _emailController.text.trim(),
        failureReason: 'Form validation failed',
      );
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    // Request notification permission if not yet decided (user gesture context)
    if (!_notificationAuthorized && !_notificationDenied) {
      await _requestNotificationPermission();
    }

    await _savePreferences();

    final emailInput = _emailController.text.trim();
    final password = _passwordController.text;
    LoginResolution resolution;
    try {
      final uri = Uri.parse('${ApiConfig.baseUrl}/api/auth/login');
      final res = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'username': emailInput,
          'password': password,
        }),
      ).timeout(const Duration(seconds: 12));

      resolution = LoginResolver.resolve(
        allowDemoFallback: AppMode.isDemo,
        username: emailInput,
        password: password,
        selectedRole: _selectedRole,
        statusCode: res.statusCode,
        body: _decodeLoginBody(res.body),
      );
    } catch (e) {
      debugPrint('[LoginPage] Backend login notice: $e');
      resolution = LoginResolver.resolve(
        allowDemoFallback: AppMode.isDemo,
        username: emailInput,
        password: password,
        selectedRole: _selectedRole,
        transportFailed: true,
      );
    }

    final session = resolution.session;
    if (session == null) {
      _recordLoginLog(
        isSuccess: false,
        username: emailInput,
        failureReason: resolution.errorMessage,
      );
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _errorMessage = resolution.errorMessage ?? 'Sign-in failed. Try again.';
      });
      return;
    }

    try {
      await _persistSession(session);
    } catch (e) {
      debugPrint('[LoginPage] Session save notice: $e');
    }

    _recordLoginLog(
      isSuccess: true,
      username: emailInput,
      employeeName: session.displayName,
    );

    if (!mounted) return;

    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => DriverHomePage(
          username: session.displayName,
          role: session.role,
          employeeId: session.employeeId,
        ),
      ),
    );
  }

  Map<String, dynamic>? _decodeLoginBody(String raw) {
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) return decoded;
      if (decoded is Map) return Map<String, dynamic>.from(decoded);
    } catch (_) {}
    return null;
  }

  Future<void> _persistSession(DriverSession session) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('driver_saved_role', session.role);
    await prefs.setString('driver_saved_employee_id', session.employeeId);
    await prefs.setString('driver_saved_display_name', session.displayName);
    await prefs.setString('driver_saved_username', session.username);
    final existingToken = prefs.getString('driver_auth_token');
    final hasGenuineExistingToken = existingToken != null &&
        existingToken.trim().isNotEmpty &&
        !existingToken.startsWith('mock-token-');

    if (session.token.isNotEmpty && !session.token.startsWith('mock-token-')) {
      // Genuine token issued by backend
      await prefs.setString('driver_auth_token', session.token);
      AuthenticatedHttpClient.setToken(session.token);
    } else if (hasGenuineExistingToken) {
      // Offline fallback: preserve existing genuine token (MCP token or Firebase JWT token)
      AuthenticatedHttpClient.setToken(existingToken);
    } else {
      // Offline fallback without an existing token: do not store invalid mock token that causes 401
      await prefs.remove('driver_auth_token');
      AuthenticatedHttpClient.setToken(null);
    }
    if (session.overrides != null && session.overrides!.isNotEmpty) {
      await prefs.setString('driver_saved_overrides', jsonEncode(session.overrides));
    } else {
      await prefs.remove('driver_saved_overrides');
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Brand Icon
                    Center(
                      child: Container(
                        width: 92,
                        height: 92,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(22),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.primary.withValues(alpha: 0.25),
                              blurRadius: 20,
                              offset: const Offset(0, 8),
                            ),
                          ],
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(22),
                          child: Image.asset(
                            'assets/images/app_icon.png',
                            fit: BoxFit.cover,
                            errorBuilder: (context, error, stackTrace) {
                              return Container(
                                color: AppColors.primary,
                                child: const Icon(
                                  Icons.directions_bus_rounded,
                                  color: Color(0xFF0F172A),
                                  size: 48,
                                ),
                              );
                            },
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Title & Subtitle
                    Text(
                      'PCY Tech • Driver Hub',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        letterSpacing: -0.5,
                        color: isDark ? Colors.white : AppColors.textPrimaryLight,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Intelligent Fleet Operations & Driver Terminal',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 13,
                        color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Role Selector Toggle
                    Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: isDark ? AppColors.darkCard : const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
                        ),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: _buildRoleButton('Driver', Icons.directions_bus_rounded, isDark),
                          ),
                          Expanded(
                            child: _buildRoleButton('Monitor', Icons.shield_rounded, isDark),
                          ),
                          Expanded(
                            child: _buildRoleButton('Fleet', Icons.build_circle_rounded, isDark),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Error Banner if present
                    if (_errorMessage != null) ...[
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.error.withValues(alpha: 0.12),
                          border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline_rounded, color: AppColors.error, size: 20),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                _errorMessage!,
                                style: const TextStyle(color: AppColors.error, fontSize: 13),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Staff Email / Driver ID
                    TextFormField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      style: TextStyle(
                        fontSize: 15,
                        color: isDark ? Colors.white : Colors.black87,
                      ),
                      decoration: InputDecoration(
                        labelText: 'Staff Email / Driver ID',
                        hintText: 'e.g. driver1d or email',
                        prefixIcon: const Icon(Icons.badge_outlined, size: 22),
                        suffixIcon: _emailController.text.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.clear, size: 18),
                                onPressed: () => setState(() => _emailController.clear()),
                              )
                            : null,
                      ),
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                          return 'Please enter your Staff Email or Driver ID';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),

                    // Password
                    TextFormField(
                      controller: _passwordController,
                      obscureText: _obscurePassword,
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _handleLogin(),
                      style: TextStyle(
                        fontSize: 15,
                        color: isDark ? Colors.white : Colors.black87,
                      ),
                      decoration: InputDecoration(
                        labelText: 'Password',
                        hintText: 'Enter your password',
                        prefixIcon: const Icon(Icons.lock_outline_rounded, size: 22),
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                            size: 20,
                          ),
                          onPressed: () {
                            setState(() {
                              _obscurePassword = !_obscurePassword;
                            });
                          },
                        ),
                      ),
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return 'Please enter your password';
                        }
                        if (value.length < 4) {
                          return 'Password must be at least 4 characters';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),

                    // Remember Me & Forgot Password
                    Wrap(
                      alignment: WrapAlignment.spaceBetween,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      runSpacing: 8,
                      children: [
                        InkWell(
                          onTap: () {
                            setState(() {
                              _rememberMe = !_rememberMe;
                            });
                          },
                          borderRadius: BorderRadius.circular(6),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              SizedBox(
                                width: 20,
                                height: 20,
                                child: Checkbox(
                                  value: _rememberMe,
                                  activeColor: AppColors.primary,
                                  checkColor: const Color(0xFF0F172A),
                                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                  visualDensity: VisualDensity.compact,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                                  onChanged: (val) {
                                    setState(() {
                                      _rememberMe = val ?? true;
                                    });
                                  },
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                'Remember Me',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                                ),
                              ),
                            ],
                          ),
                        ),
                        TextButton(
                          onPressed: () {
                            showDialog(
                              context: context,
                              builder: (_) => const ForgotPasswordDialog(),
                            );
                          },
                          style: TextButton.styleFrom(
                            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                            minimumSize: Size.zero,
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            visualDensity: VisualDensity.compact,
                          ),
                          child: const Text('Forgot Password?'),
                        ),
                      ],
                    ),

                    // Notification Permission Banner
                    Container(
                      margin: const EdgeInsets.only(top: 14, bottom: 4),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: _notificationAuthorized
                            ? AppColors.success.withValues(alpha: 0.1)
                            : _notificationDenied
                                ? Colors.amber.withValues(alpha: 0.12)
                                : AppColors.primary.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: _notificationAuthorized
                              ? AppColors.success.withValues(alpha: 0.3)
                              : _notificationDenied
                                  ? Colors.amber.withValues(alpha: 0.35)
                                  : AppColors.primary.withValues(alpha: 0.35),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(
                                _notificationAuthorized
                                    ? Icons.check_circle_rounded
                                    : _notificationDenied
                                        ? Icons.notifications_off_rounded
                                        : Icons.notifications_active_rounded,
                                size: 18,
                                color: _notificationAuthorized
                                    ? AppColors.success
                                    : (_notificationDenied ? Colors.amber : AppColors.primary),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  _notificationAuthorized
                                      ? 'Push Notifications Active'
                                      : _notificationDenied
                                          ? 'Notifications Blocked in Browser'
                                          : 'Check-in Push Reminders',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 13,
                                    color: _notificationAuthorized
                                        ? AppColors.success
                                        : (isDark ? Colors.white : Colors.black87),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _notificationAuthorized
                                ? 'This device will receive automated check-in reminder alerts.'
                                : _notificationDenied
                                    ? 'Notifications are blocked. Click the lock or settings icon in your browser URL bar to allow notifications.'
                                    : 'Enable browser notifications to receive alerts if you are running late for scheduled check-in.',
                            style: TextStyle(
                              fontSize: 11.5,
                              color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                            ),
                          ),
                          if (!_notificationAuthorized && !_notificationDenied) ...[
                            const SizedBox(height: 8),
                            SizedBox(
                              width: double.infinity,
                              height: 34,
                              child: OutlinedButton.icon(
                                onPressed: _requestNotificationPermission,
                                icon: const Icon(Icons.notifications_none_rounded, size: 16),
                                label: const Text('Enable Notifications Now', style: TextStyle(fontSize: 12)),
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: AppColors.primary,
                                  side: const BorderSide(color: AppColors.primary),
                                  padding: EdgeInsets.zero,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),

                    // Sign In Button
                    SizedBox(
                      width: double.infinity,
                      height: 54,
                      child: ElevatedButton(
                        onPressed: _isLoading ? null : _handleLogin,
                        child: _isLoading
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.5,
                                  valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF0F172A)),
                                ),
                              )
                            : const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text('Sign In to Terminal'),
                                  SizedBox(width: 8),
                                  Icon(Icons.arrow_forward_rounded, size: 20),
                                ],
                              ),
                      ),
                    ),
                    if (AppMode.isDemo) ...[
                      const SizedBox(height: 16),
                      OutlinedButton.icon(
                        onPressed: () {
                          setState(() {
                            _emailController.text = 'driver1d';
                            _passwordController.text = LoginResolver.demoPassword;
                            _selectedRole = 'Driver';
                            _errorMessage = null;
                          });
                        },
                        icon: const Icon(Icons.bolt_rounded, size: 18, color: AppColors.primary),
                        label: const Text(
                          'Fill Demo Driver Account (driver1d)',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                        ),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size(double.infinity, 44),
                          side: BorderSide(
                            color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
                          ),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          foregroundColor: isDark ? Colors.white70 : Colors.black87,
                        ),
                      ),
                    ],
                    const SizedBox(height: 36),

                    // App Version Display
                    Column(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: isDark ? AppColors.darkCard : const Color(0xFFE2E8F0),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 7,
                                height: 7,
                                decoration: const BoxDecoration(
                                  color: AppColors.success,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                'App $_appVersion',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  fontFamily: 'monospace',
                                  color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'School Bus Fleet Dispatch · Safety First',
                          style: TextStyle(
                            fontSize: 11,
                            color: isDark ? const Color(0xFF64748B) : const Color(0xFF94A3B8),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildRoleButton(String role, IconData icon, bool isDark) {
    final isSelected = _selectedRole == role;

    return GestureDetector(
      onTap: () => setState(() => _selectedRole = role),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 16,
              color: isSelected
                  ? const Color(0xFF0F172A)
                  : (isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
            ),
            const SizedBox(width: 6),
            Text(
              role,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: isSelected
                    ? const Color(0xFF0F172A)
                    : (isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
