import 'package:flutter/material.dart';

/// Wraps the Parent App in a realistic smartphone device frame on desktop/web
/// while maintaining native edge-to-edge layout on real mobile devices.
class PhoneFrameWrapper extends StatefulWidget {
  final Widget child;

  const PhoneFrameWrapper({super.key, required this.child});

  @override
  State<PhoneFrameWrapper> createState() => _PhoneFrameWrapperState();
}

class _PhoneFrameWrapperState extends State<PhoneFrameWrapper> {
  bool _forceFullScreen = false;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final screenWidth = constraints.maxWidth;
        final isDesktop = screenWidth > 580;

        // If on real mobile device or user toggled full screen, render directly
        if (!isDesktop || _forceFullScreen) {
          return Stack(
            children: [
              widget.child,
              if (isDesktop && _forceFullScreen)
                Positioned(
                  top: 16,
                  right: 16,
                  child: FloatingActionButton.extended(
                    heroTag: 'exit_full_screen',
                    backgroundColor: const Color(0xFF0F172A),
                    foregroundColor: Colors.white,
                    onPressed: () => setState(() => _forceFullScreen = false),
                    icon: const Icon(Icons.phone_iphone_rounded, size: 18),
                    label: const Text('Phone Frame View', style: TextStyle(fontSize: 12)),
                  ),
                ),
            ],
          );
        }

        // Render inside realistic smartphone frame on Desktop / Web
        return Scaffold(
          backgroundColor: const Color(0xFF0A0F1D), // Studio dark slate
          body: SafeArea(
            child: Column(
              children: [
                // 1. Top Simulator Control Bar
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  decoration: const BoxDecoration(
                    color: Color(0xFF111827),
                    border: Border(bottom: BorderSide(color: Color(0xFF1F2937))),
                  ),
                  child: Row(
                    children: [
                      // App Badge
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1E293B),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFF334155)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: Image.asset(
                                'assets/images/pcy_tech_app_icon.jpg',
                                width: 18,
                                height: 18,
                                fit: BoxFit.cover,
                                errorBuilder: (_, _, _) => const Icon(Icons.directions_bus_rounded, color: Color(0xFFF59E0B), size: 16),
                              ),
                            ),
                            const SizedBox(width: 8),
                            const Text(
                              'PCY Tech • Parent App',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (screenWidth > 850) ...[
                        const SizedBox(width: 8),
                        // Device Indicator
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1E293B),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Text(
                            '📱 iPhone 15 Pro (393 × 852)',
                            style: TextStyle(
                              color: Color(0xFF94A3B8),
                              fontSize: 11,
                              fontFamily: 'monospace',
                            ),
                          ),
                        ),
                      ],
                      const Spacer(),
                      // Full screen toggle button
                      TextButton.icon(
                        onPressed: () => setState(() => _forceFullScreen = true),
                        icon: const Icon(Icons.fullscreen_rounded, size: 18, color: Color(0xFF94A3B8)),
                        label: const Text(
                          'Full Screen',
                          style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 12),
                        ),
                        style: TextButton.styleFrom(
                          backgroundColor: const Color(0xFF1E293B),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        ),
                      ),
                    ],
                  ),
                ),

                // 2. Main Studio Canvas with Centered Phone Frame
                Expanded(
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: Alignment.center,
                        child: _buildRealisticPhone(context),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildRealisticPhone(BuildContext context) {
    const double phoneWidth = 393.0;
    const double phoneHeight = 852.0;
    const double cornerRadius = 48.0;

    return Container(
      width: phoneWidth + 24, // Extra margin for buttons
      height: phoneHeight + 16,
      alignment: Alignment.center,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.center,
        children: [
          // Left Side Hardware Buttons (Volume Up, Volume Down)
          Positioned(
            left: 2,
            top: 140,
            child: Container(
              width: 4,
              height: 48,
              decoration: BoxDecoration(
                color: const Color(0xFF475569),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          Positioned(
            left: 2,
            top: 200,
            child: Container(
              width: 4,
              height: 48,
              decoration: BoxDecoration(
                color: const Color(0xFF475569),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Right Side Hardware Button (Power / Lock)
          Positioned(
            right: 2,
            top: 160,
            child: Container(
              width: 4,
              height: 72,
              decoration: BoxDecoration(
                color: const Color(0xFF475569),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Phone Body Chassis
          Container(
            width: phoneWidth,
            height: phoneHeight,
            decoration: BoxDecoration(
              color: Colors.black,
              borderRadius: BorderRadius.circular(cornerRadius),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.6),
                  blurRadius: 40,
                  spreadRadius: 8,
                  offset: const Offset(0, 20),
                ),
                BoxShadow(
                  color: const Color(0xFF2563EB).withValues(alpha: 0.15),
                  blurRadius: 60,
                  spreadRadius: 2,
                ),
              ],
              border: Border.all(
                color: const Color(0xFF334155), // Titanium border
                width: 9,
              ),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(cornerRadius - 8),
              child: Stack(
                children: [
                  // Inner Mobile Screen with Mobile MediaQuery
                  Positioned.fill(
                    child: MediaQuery(
                      data: MediaQuery.of(context).copyWith(
                        size: const Size(phoneWidth, phoneHeight),
                        padding: const EdgeInsets.only(top: 48, bottom: 24),
                        viewPadding: const EdgeInsets.only(top: 48, bottom: 24),
                      ),
                      child: widget.child,
                    ),
                  ),

                  // Simulated Mobile Status Bar (Top)
                  Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 44,
                    child: IgnorePointer(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
                        child: const Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            Text(
                              '9:41',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: Colors.black87,
                                letterSpacing: -0.2,
                              ),
                            ),
                            Spacer(),
                            Icon(Icons.signal_cellular_4_bar_rounded, size: 14, color: Colors.black87),
                            SizedBox(width: 4),
                            Icon(Icons.wifi_rounded, size: 15, color: Colors.black87),
                            SizedBox(width: 4),
                            Icon(Icons.battery_full_rounded, size: 18, color: Colors.black87),
                          ],
                        ),
                      ),
                    ),
                  ),

                  // Dynamic Island (Top Center)
                  Positioned(
                    top: 10,
                    left: 0,
                    right: 0,
                    child: Center(
                      child: IgnorePointer(
                        child: Container(
                          width: 120,
                          height: 30,
                          decoration: BoxDecoration(
                            color: Colors.black,
                            borderRadius: BorderRadius.circular(18),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.2),
                                blurRadius: 4,
                              ),
                            ],
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              // Subtle Camera Lens Dot
                              Container(
                                margin: const EdgeInsets.only(right: 12),
                                width: 10,
                                height: 10,
                                decoration: const BoxDecoration(
                                  color: Color(0xFF1E293B),
                                  shape: BoxShape.circle,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),

                  // Bottom Home Indicator Bar
                  Positioned(
                    bottom: 8,
                    left: 0,
                    right: 0,
                    child: Center(
                      child: IgnorePointer(
                        child: Container(
                          width: 134,
                          height: 4,
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.4),
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
