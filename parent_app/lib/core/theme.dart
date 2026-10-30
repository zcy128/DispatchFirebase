import 'package:flutter/material.dart';

class AppColors {
  // Direction C: Gentler Streak Family Bento - Calming Dark Navy Palette
  static const Color background = Color(0xFF0B101D);       // Deep Night Navy
  static const Color surface = Color(0xFF121929);          // Bento Card Surface
  static const Color surfaceMuted = Color(0xFF172136);     // Inner Bento Slot Surface
  static const Color surfaceHighlight = Color(0xFF1E2D4A); // Bento Highlight
  static const Color border = Color(0xFF233252);           // Bento Border
  static const Color borderSubtle = Color(0x1FFFFFFF);     // 12% White Border

  // Primary & Pastel Accents
  static const Color primary = Color(0xFFFCD34D);          // Warm Amber Gold
  static const Color primaryDark = Color(0xFFF59E0B);      // Deep Amber
  static const Color secondary = Color(0xFF9BE0CC);        // Mint Safe / Boarded
  static const Color mint = Color(0xFF9BE0CC);             // Mint Safe
  static const Color lavender = Color(0xFFBAC3FA);         // Soft Lavender
  static const Color peach = Color(0xFFF4D0A8);            // Warm Peach Glow
  static const Color coral = Color(0xFFF87171);            // Calming Coral / Emergency

  // Status Indicators
  static const Color success = Color(0xFF9BE0CC);          // Mint Safe
  static const Color warning = Color(0xFFFCD34D);          // Amber Approaching
  static const Color error = Color(0xFFF87171);            // Coral Alert
  static const Color info = Color(0xFFBAC3FA);             // Lavender Info

  // Typography Neutrals
  static const Color textPrimary = Color(0xFFF8FAFC);     // High-contrast crisp white
  static const Color textSecondary = Color(0xFF94A3B8);   // Muted slate
  static const Color textMuted = Color(0xFF64748B);       // Dark slate
}

class AppTheme {
  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: AppColors.background,
      colorScheme: const ColorScheme.dark(
        primary: AppColors.primary,
        secondary: AppColors.secondary,
        surface: AppColors.surface,
        error: AppColors.error,
        onPrimary: Color(0xFF0B101D),
        onSecondary: Color(0xFF0B101D),
        onSurface: AppColors.textPrimary,
        onError: Colors.white,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: AppColors.textPrimary,
          fontSize: 18,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.2,
        ),
      ),
      cardTheme: CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
          side: const BorderSide(color: AppColors.border, width: 1.2),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: const Color(0xFF0B101D),
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          textStyle: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.2,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.textPrimary,
          side: const BorderSide(color: AppColors.border, width: 1.2),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          textStyle: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surfaceMuted,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        hintStyle: const TextStyle(color: AppColors.textMuted),
        labelStyle: const TextStyle(color: AppColors.textSecondary),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppColors.primary, width: 2),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
          side: const BorderSide(color: AppColors.border, width: 1.2),
        ),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.surface,
        modalBackgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
      ),
    );
  }
}
