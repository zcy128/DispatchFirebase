import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';

/// Status of an expense reimbursement claim.
enum ExpenseClaimStatus {
  pending,
  approved,
  rejected,
  cancelled;

  String get apiValue {
    switch (this) {
      case ExpenseClaimStatus.pending:
        return 'pending';
      case ExpenseClaimStatus.approved:
        return 'approved';
      case ExpenseClaimStatus.rejected:
        return 'rejected';
      case ExpenseClaimStatus.cancelled:
        return 'cancelled';
    }
  }

  static ExpenseClaimStatus fromApiValue(dynamic v) {
    final str = (v ?? '').toString().toLowerCase().trim();
    if (str == 'approved') return ExpenseClaimStatus.approved;
    if (str == 'rejected') return ExpenseClaimStatus.rejected;
    if (str == 'cancelled' || str == 'canceled') return ExpenseClaimStatus.cancelled;
    return ExpenseClaimStatus.pending;
  }

  String get label {
    switch (this) {
      case ExpenseClaimStatus.pending:
        return 'Pending Review';
      case ExpenseClaimStatus.approved:
        return 'Approved';
      case ExpenseClaimStatus.rejected:
        return 'Rejected';
      case ExpenseClaimStatus.cancelled:
        return 'Cancelled';
    }
  }

  Color get color {
    switch (this) {
      case ExpenseClaimStatus.pending:
        return const Color(0xFFD97706); // Amber
      case ExpenseClaimStatus.approved:
        return const Color(0xFF16A34A); // Green
      case ExpenseClaimStatus.rejected:
        return const Color(0xFFDC2626); // Red
      case ExpenseClaimStatus.cancelled:
        return const Color(0xFF6B7280); // Gray
    }
  }

  IconData get icon {
    switch (this) {
      case ExpenseClaimStatus.pending:
        return Icons.hourglass_top_rounded;
      case ExpenseClaimStatus.approved:
        return Icons.check_circle_outline_rounded;
      case ExpenseClaimStatus.rejected:
        return Icons.cancel_outlined;
      case ExpenseClaimStatus.cancelled:
        return Icons.block_outlined;
    }
  }
}

/// Expense category definition.
class ExpenseCategory extends Equatable {
  final String id;
  final String code;
  final String displayName;
  final int sortOrder;
  final bool active;

  const ExpenseCategory({
    required this.id,
    required this.code,
    required this.displayName,
    this.sortOrder = 0,
    this.active = true,
  });

  factory ExpenseCategory.fromJson(Map<String, dynamic> json) {
    return ExpenseCategory(
      id: json['id']?.toString() ?? '',
      code: json['code']?.toString() ?? '',
      displayName: json['displayName']?.toString() ?? '',
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
      active: json['active'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'code': code,
    'displayName': displayName,
    'sortOrder': sortOrder,
    'active': active,
  };

  IconData get icon {
    switch (code.toLowerCase()) {
      case 'fuel':
        return Icons.local_gas_station_outlined;
      case 'parking':
        return Icons.local_parking_outlined;
      case 'maintenance':
        return Icons.build_outlined;
      case 'cleaning':
        return Icons.cleaning_services_outlined;
      case 'meals':
        return Icons.restaurant_outlined;
      default:
        return Icons.receipt_long_outlined;
    }
  }

  @override
  List<Object?> get props => [id, code, displayName, sortOrder, active];

  static List<ExpenseCategory> defaultCategories() {
    return const [
      ExpenseCategory(id: 'cat-fuel', code: 'fuel', displayName: 'Fuel / Gas', sortOrder: 1),
      ExpenseCategory(id: 'cat-parking', code: 'parking', displayName: 'Parking & Tolls', sortOrder: 2),
      ExpenseCategory(id: 'cat-maintenance', code: 'maintenance', displayName: 'Supplies & Minor Maintenance', sortOrder: 3),
      ExpenseCategory(id: 'cat-cleaning', code: 'cleaning', displayName: 'Vehicle Cleaning', sortOrder: 4),
      ExpenseCategory(id: 'cat-meals', code: 'meals', displayName: 'Meal Allowance', sortOrder: 5),
      ExpenseCategory(id: 'cat-other', code: 'other', displayName: 'Other Expense', sortOrder: 6),
    ];
  }
}

/// A line item within an expense claim.
class ExpenseReimbursementLine extends Equatable {
  final String id;
  final String categoryCode;
  final String categoryDisplayName;
  final double amount;
  final String note;
  final int sortOrder;

  const ExpenseReimbursementLine({
    required this.id,
    required this.categoryCode,
    required this.categoryDisplayName,
    required this.amount,
    this.note = '',
    this.sortOrder = 0,
  });

  factory ExpenseReimbursementLine.fromJson(Map<String, dynamic> json) {
    return ExpenseReimbursementLine(
      id: json['id']?.toString() ?? '',
      categoryCode: json['categoryCode']?.toString() ?? '',
      categoryDisplayName: json['categoryDisplayName']?.toString() ?? '',
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      note: json['note']?.toString() ?? '',
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'categoryCode': categoryCode,
    'categoryDisplayName': categoryDisplayName,
    'amount': amount,
    'note': note,
    'sortOrder': sortOrder,
  };

  String get formattedAmount => '\$${amount.toStringAsFixed(2)}';

  @override
  List<Object?> get props => [id, categoryCode, categoryDisplayName, amount, note, sortOrder];
}

/// A complete driver expense reimbursement claim.
class ExpenseReimbursementClaim extends Equatable {
  final String id;
  final String employeeId;
  final String employeeName;
  final String claimDate;
  final String routeNo;
  final double totalAmount;
  final List<ExpenseReimbursementLine> lines;
  final List<String> attachmentUrls;
  final ExpenseClaimStatus status;
  final String? approvalNotes;
  final String? approvedByName;
  final DateTime? approvedAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  const ExpenseReimbursementClaim({
    required this.id,
    required this.employeeId,
    required this.employeeName,
    required this.claimDate,
    required this.routeNo,
    required this.totalAmount,
    required this.lines,
    this.attachmentUrls = const [],
    this.status = ExpenseClaimStatus.pending,
    this.approvalNotes,
    this.approvedByName,
    this.approvedAt,
    required this.createdAt,
    required this.updatedAt,
  });

  bool get canCancel => status == ExpenseClaimStatus.pending;

  String get formattedTotalAmount => '\$${totalAmount.toStringAsFixed(2)}';

  factory ExpenseReimbursementClaim.fromJson(Map<String, dynamic> json) {
    DateTime parseTime(dynamic v, DateTime fallback) {
      if (v == null) return fallback;
      if (v is DateTime) return v;
      final str = v.toString();
      return DateTime.tryParse(str) ?? fallback;
    }

    DateTime? parseNullableTime(dynamic v) {
      if (v == null) return null;
      if (v is DateTime) return v;
      return DateTime.tryParse(v.toString());
    }

    final rawLines = json['lines'] as List<dynamic>? ?? [];
    final lines = rawLines
        .map((e) => ExpenseReimbursementLine.fromJson(e as Map<String, dynamic>))
        .toList();

    final rawAttachments = json['attachmentUrls'] as List<dynamic>? ?? [];
    final attachmentUrls = rawAttachments.map((e) => e.toString()).toList();

    final now = DateTime.now();

    return ExpenseReimbursementClaim(
      id: json['id']?.toString() ?? '',
      employeeId: json['employeeId']?.toString() ?? '',
      employeeName: json['employeeName']?.toString() ?? '',
      claimDate: json['claimDate']?.toString() ?? '',
      routeNo: json['routeNo']?.toString() ?? '',
      totalAmount: (json['totalAmount'] as num?)?.toDouble() ?? 0.0,
      lines: lines,
      attachmentUrls: attachmentUrls,
      status: ExpenseClaimStatus.fromApiValue(json['status']),
      approvalNotes: json['approvalNotes']?.toString(),
      approvedByName: json['approvedByName']?.toString(),
      approvedAt: parseNullableTime(json['approvedAt']),
      createdAt: parseTime(json['createdAt'], now),
      updatedAt: parseTime(json['updatedAt'], now),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'employeeId': employeeId,
    'employeeName': employeeName,
    'claimDate': claimDate,
    'routeNo': routeNo,
    'totalAmount': totalAmount,
    'lines': lines.map((l) => l.toJson()).toList(),
    'attachmentUrls': attachmentUrls,
    'status': status.apiValue,
    'approvalNotes': approvalNotes,
    'approvedByName': approvedByName,
    'approvedAt': approvedAt?.toIso8601String(),
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
  };

  ExpenseReimbursementClaim copyWith({
    String? id,
    String? employeeId,
    String? employeeName,
    String? claimDate,
    String? routeNo,
    double? totalAmount,
    List<ExpenseReimbursementLine>? lines,
    List<String>? attachmentUrls,
    ExpenseClaimStatus? status,
    String? approvalNotes,
    String? approvedByName,
    DateTime? approvedAt,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return ExpenseReimbursementClaim(
      id: id ?? this.id,
      employeeId: employeeId ?? this.employeeId,
      employeeName: employeeName ?? this.employeeName,
      claimDate: claimDate ?? this.claimDate,
      routeNo: routeNo ?? this.routeNo,
      totalAmount: totalAmount ?? this.totalAmount,
      lines: lines ?? this.lines,
      attachmentUrls: attachmentUrls ?? this.attachmentUrls,
      status: status ?? this.status,
      approvalNotes: approvalNotes ?? this.approvalNotes,
      approvedByName: approvedByName ?? this.approvedByName,
      approvedAt: approvedAt ?? this.approvedAt,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  List<Object?> get props => [
    id,
    employeeId,
    employeeName,
    claimDate,
    routeNo,
    totalAmount,
    lines,
    attachmentUrls,
    status,
    approvalNotes,
    approvedByName,
    approvedAt,
    createdAt,
    updatedAt,
  ];
}
