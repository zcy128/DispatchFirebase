import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../../core/theme.dart';
import '../../core/widgets/google_route_map_card.dart';

class SanitizedStopItem {
  final int sequence;
  final String stopName;
  final String address;
  final String scheduledTime;
  final String stopType;
  final String? schoolName;
  final double? latitude;
  final double? longitude;

  const SanitizedStopItem({
    required this.sequence,
    required this.stopName,
    required this.address,
    required this.scheduledTime,
    required this.stopType,
    this.schoolName,
    this.latitude,
    this.longitude,
  });

  /// Sanitizes a raw stop map from `route_shifts` or `sanitizedStops`,
  /// stripping all student passenger PII (names, IDs, grades, parent contacts).
  factory SanitizedStopItem.fromMap(Map<String, dynamic> map, [int index = 0]) {
    final seq = (map['sequence'] as num?)?.toInt() ?? (index + 1);
    final loc = (map['stopLocation'] ??
            map['stopName'] ??
            map['location'] ??
            map['address'] ??
            '')
        .toString();
    final addr = (map['address'] ?? map['comment'] ?? '').toString();
    final rawTime = (map['pullawayTime'] ??
            map['stopScheduleTime'] ??
            map['scheduledTime'] ??
            map['time'] ??
            '')
        .toString();
    final school = map['schoolName']?.toString();
    final rawType = (map['stopType'] ?? '').toString();
    final resolvedType = rawType.isNotEmpty ? rawType : 'HomePickup';

    return SanitizedStopItem(
      sequence: seq,
      stopName: loc.isNotEmpty ? loc : 'Scheduled Stop #$seq',
      address: addr != loc ? addr : '',
      scheduledTime: rawTime,
      stopType: resolvedType,
      schoolName: (school != null && school.isNotEmpty) ? school : null,
      latitude: (map['latitude'] as num?)?.toDouble(),
      longitude: (map['longitude'] as num?)?.toDouble(),
    );
  }
}

class SanitizedRouteShift {
  final String id;
  final String shiftType;
  final String firstStopTime;
  final String lastStopTime;
  final List<SanitizedStopItem> stops;

  const SanitizedRouteShift({
    required this.id,
    required this.shiftType,
    required this.firstStopTime,
    required this.lastStopTime,
    required this.stops,
  });

  factory SanitizedRouteShift.fromMap(Map<String, dynamic> data, String docId) {
    final rawStops = (data['stops'] as List?) ?? const [];
    final parsedStops = <SanitizedStopItem>[];
    for (int i = 0; i < rawStops.length; i++) {
      final item = rawStops[i];
      if (item is Map) {
        parsedStops.add(
          SanitizedStopItem.fromMap(Map<String, dynamic>.from(item), i),
        );
      }
    }
    parsedStops.sort((a, b) => a.sequence.compareTo(b.sequence));

    return SanitizedRouteShift(
      id: (data['id'] ?? docId).toString(),
      shiftType: (data['shiftType'] ?? 'Shift').toString(),
      firstStopTime: (data['firstStopTime'] ?? '').toString(),
      lastStopTime: (data['lastStopTime'] ?? '').toString(),
      stops: parsedStops,
    );
  }
}

class RouteOpeningApplicantItem {
  final String employeeId;
  final String fullName;
  final String roleApplied;
  final String? phone;
  final String? homeAddress;
  final String? seniorityDate;
  final String appliedAt;
  final String? note;
  final String status;

  const RouteOpeningApplicantItem({
    required this.employeeId,
    required this.fullName,
    required this.roleApplied,
    this.phone,
    this.homeAddress,
    this.seniorityDate,
    required this.appliedAt,
    this.note,
    required this.status,
  });

  factory RouteOpeningApplicantItem.fromMap(Map<String, dynamic> map) {
    return RouteOpeningApplicantItem(
      employeeId: (map['employeeId'] ?? '').toString(),
      fullName: (map['fullName'] ?? '').toString(),
      roleApplied: (map['roleApplied'] ?? 'driver').toString(),
      phone: map['phone']?.toString(),
      homeAddress: map['homeAddress']?.toString(),
      seniorityDate: map['seniorityDate']?.toString(),
      appliedAt: (map['appliedAt'] ?? '').toString(),
      note: map['note']?.toString(),
      status: (map['status'] ?? 'pending').toString(),
    );
  }

  Map<String, dynamic> toMap() {
    final data = <String, dynamic>{
      'employeeId': employeeId,
      'fullName': fullName,
      'roleApplied': roleApplied,
      'appliedAt': appliedAt,
      'status': status,
    };
    if (phone != null && phone!.isNotEmpty) data['phone'] = phone;
    if (homeAddress != null && homeAddress!.isNotEmpty) {
      data['homeAddress'] = homeAddress;
    }
    if (seniorityDate != null && seniorityDate!.isNotEmpty) {
      data['seniorityDate'] = seniorityDate;
    }
    if (note != null && note!.isNotEmpty) data['note'] = note;
    return data;
  }
}

class RouteOpeningItem {
  final String id;
  final String routeId;
  final String routeNo;
  final String routeName;
  final String? schoolName;
  final String? schoolAddress;
  final String postingType; // 'permanent' | 'temporary'
  final String roleNeeded; // 'driver' | 'attendant' | 'both'
  final String shiftType; // 'ALL' | 'AM' | 'PM'
  final String effectiveStartDate;
  final String? effectiveEndDate;
  final String deadline;
  final String description;
  final String? compensationNote;
  final String? requirements;
  final List<SanitizedStopItem> sanitizedStops;
  final String status; // 'open' | 'closed' | 'awarded' | 'cancelled'
  final List<RouteOpeningApplicantItem> applicants;
  final String? awardedDriverId;
  final String? awardedDriverName;
  final String? awardedAttendantId;
  final String? awardedAttendantName;
  final String createdAt;

  const RouteOpeningItem({
    required this.id,
    required this.routeId,
    required this.routeNo,
    required this.routeName,
    this.schoolName,
    this.schoolAddress,
    required this.postingType,
    required this.roleNeeded,
    required this.shiftType,
    required this.effectiveStartDate,
    this.effectiveEndDate,
    required this.deadline,
    required this.description,
    this.compensationNote,
    this.requirements,
    required this.sanitizedStops,
    required this.status,
    required this.applicants,
    this.awardedDriverId,
    this.awardedDriverName,
    this.awardedAttendantId,
    this.awardedAttendantName,
    required this.createdAt,
  });

  factory RouteOpeningItem.fromFirestore(
    DocumentSnapshot<Map<String, dynamic>> doc,
  ) {
    final data = doc.data() ?? <String, dynamic>{};
    final rawStops = (data['sanitizedStops'] as List?) ?? const [];
    final rawApplicants = (data['applicants'] as List?) ?? const [];

    return RouteOpeningItem(
      id: (data['id'] ?? doc.id).toString(),
      routeId: (data['routeId'] ?? '').toString(),
      routeNo: (data['routeNo'] ?? '').toString(),
      routeName: (data['routeName'] ?? '').toString(),
      schoolName: data['schoolName']?.toString(),
      schoolAddress: data['schoolAddress']?.toString(),
      postingType: (data['postingType'] ?? 'permanent').toString(),
      roleNeeded: (data['roleNeeded'] ?? 'driver').toString(),
      shiftType: (data['shiftType'] ?? 'ALL').toString(),
      effectiveStartDate: (data['effectiveStartDate'] ?? '').toString(),
      effectiveEndDate: data['effectiveEndDate']?.toString(),
      deadline: (data['deadline'] ?? '').toString(),
      description: (data['description'] ?? '').toString(),
      compensationNote: data['compensationNote']?.toString(),
      requirements: data['requirements']?.toString(),
      sanitizedStops: rawStops
          .whereType<Map>()
          .map((e) => SanitizedStopItem.fromMap(Map<String, dynamic>.from(e)))
          .toList(),
      status: (data['status'] ?? 'open').toString(),
      applicants: rawApplicants
          .whereType<Map>()
          .map(
            (e) => RouteOpeningApplicantItem.fromMap(
              Map<String, dynamic>.from(e),
            ),
          )
          .toList(),
      awardedDriverId: data['awardedDriverId']?.toString(),
      awardedDriverName: data['awardedDriverName']?.toString(),
      awardedAttendantId: data['awardedAttendantId']?.toString(),
      awardedAttendantName: data['awardedAttendantName']?.toString(),
      createdAt: (data['createdAt'] ?? '').toString(),
    );
  }

  bool get isDeadlinePassed {
    if (deadline.isEmpty) return false;
    final parsed = DateTime.tryParse(deadline);
    if (parsed == null) return false;
    return DateTime.now().isAfter(parsed);
  }

  RouteOpeningApplicantItem? myApplication(String driverId) {
    final cleanId = driverId.trim().toLowerCase();
    for (final a in applicants) {
      if (a.employeeId.trim().toLowerCase() == cleanId &&
          a.status != 'withdrawn') {
        return a;
      }
    }
    return null;
  }
}

class RouteOpeningsPage extends StatefulWidget {
  final String driverId;
  final String driverName;
  final String role;
  final String? initialRouteNo;

  const RouteOpeningsPage({
    super.key,
    required this.driverId,
    required this.driverName,
    this.role = 'Driver',
    this.initialRouteNo,
  });

  @override
  State<RouteOpeningsPage> createState() => _RouteOpeningsPageState();
}

class _RouteOpeningsPageState extends State<RouteOpeningsPage> {
  static const String _defaultCloudRunUrl =
      'https://dispatch-api-337919645491.northamerica-northeast1.run.app';
  static const String _localDevUrl = 'http://localhost:8080';

  String _filterMode = 'open'; // 'open' | 'mine' | 'all'
  String? _employeePhone;
  String? _employeeAddress;
  String? _employeeSeniority;
  String? _employeeFullName;

  /// Cache of routeId -> list of SanitizedRouteShift loaded from `route_shifts`
  final Map<String, List<SanitizedRouteShift>> _shiftsByRouteId = {};
  final Set<String> _loadingRouteIds = {};

  @override
  void initState() {
    super.initState();
    _loadEmployeeProfile();
    _loadAllRouteShifts();
  }

  Future<void> _loadAllRouteShifts() async {
    try {
      final snap = await FirebaseFirestore.instance
          .collection('route_shifts')
          .get();
      final grouped = <String, List<SanitizedRouteShift>>{};
      for (final doc in snap.docs) {
        final data = doc.data();
        final rId = (data['routeId'] ?? '').toString();
        final rNo = (data['routeNo'] ?? '').toString();
        final shift = SanitizedRouteShift.fromMap(data, doc.id);
        if (rId.isNotEmpty) {
          grouped.putIfAbsent(rId, () => []).add(shift);
        }
        if (rNo.isNotEmpty) {
          grouped.putIfAbsent('NO:$rNo', () => []).add(shift);
        }
      }
      for (final list in grouped.values) {
        list.sort((a, b) => a.firstStopTime.compareTo(b.firstStopTime));
      }
      if (mounted) {
        setState(() {
          _shiftsByRouteId.addAll(grouped);
        });
      }
    } catch (e) {
      debugPrint('[RouteOpeningsPage] Load route_shifts notice: $e');
    }
  }

  Future<List<SanitizedRouteShift>> _ensureShiftsForOpening(
    RouteOpeningItem opening,
  ) async {
    final existing = _getShiftsForOpening(opening);
    if (existing.isNotEmpty) return existing;

    final key = opening.routeId.isNotEmpty
        ? opening.routeId
        : 'NO:${opening.routeNo}';
    if (_loadingRouteIds.contains(key)) return const [];
    _loadingRouteIds.add(key);

    try {
      // 1. Try Firestore query by routeId or routeNo
      if (opening.routeId.isNotEmpty) {
        final snap = await FirebaseFirestore.instance
            .collection('route_shifts')
            .where('routeId', isEqualTo: opening.routeId)
            .get();
        if (snap.docs.isNotEmpty) {
          final shifts = snap.docs
              .map((d) => SanitizedRouteShift.fromMap(d.data(), d.id))
              .toList()
            ..sort((a, b) => a.firstStopTime.compareTo(b.firstStopTime));
          if (mounted) {
            setState(() {
              _shiftsByRouteId[opening.routeId] = shifts;
            });
          }
          return shifts;
        }
      }

      if (opening.routeNo.isNotEmpty) {
        final snap = await FirebaseFirestore.instance
            .collection('route_shifts')
            .where('routeNo', isEqualTo: opening.routeNo)
            .get();
        if (snap.docs.isNotEmpty) {
          final shifts = snap.docs
              .map((d) => SanitizedRouteShift.fromMap(d.data(), d.id))
              .toList()
            ..sort((a, b) => a.firstStopTime.compareTo(b.firstStopTime));
          if (mounted) {
            setState(() {
              _shiftsByRouteId['NO:${opening.routeNo}'] = shifts;
            });
          }
          return shifts;
        }
      }

      // 2. Fallback to REST API if Firestore route_shifts didn't have it
      if (opening.routeId.isNotEmpty) {
        final bases = kDebugMode
            ? [_localDevUrl, _defaultCloudRunUrl]
            : [_defaultCloudRunUrl];
        for (final base in bases) {
          try {
            final uri =
                Uri.parse('$base/api/routes/${opening.routeId}/shifts');
            final resp =
                await http.get(uri).timeout(const Duration(seconds: 4));
            if (resp.statusCode == 200) {
              final decoded = json.decode(resp.body);
              if (decoded is List && decoded.isNotEmpty) {
                final shifts = decoded
                    .whereType<Map>()
                    .map((m) => SanitizedRouteShift.fromMap(
                        Map<String, dynamic>.from(m), ''))
                    .toList();
                if (mounted) {
                  setState(() {
                    _shiftsByRouteId[opening.routeId] = shifts;
                  });
                }
                return shifts;
              }
            }
          } catch (_) {}
        }
      }
    } catch (e) {
      debugPrint('[RouteOpeningsPage] _ensureShiftsForOpening error: $e');
    } finally {
      _loadingRouteIds.remove(key);
    }

    return const [];
  }

  List<SanitizedRouteShift> _getShiftsForOpening(RouteOpeningItem opening) {
    List<SanitizedRouteShift> shifts = [];
    if (opening.routeId.isNotEmpty &&
        _shiftsByRouteId.containsKey(opening.routeId)) {
      shifts = _shiftsByRouteId[opening.routeId]!;
    } else if (opening.routeNo.isNotEmpty &&
        _shiftsByRouteId.containsKey('NO:${opening.routeNo}')) {
      shifts = _shiftsByRouteId['NO:${opening.routeNo}']!;
    } else if (opening.sanitizedStops.isNotEmpty) {
      shifts = [
        SanitizedRouteShift(
          id: 'default',
          shiftType: opening.shiftType,
          firstStopTime: '',
          lastStopTime: '',
          stops: opening.sanitizedStops,
        ),
      ];
    }

    if (opening.shiftType != 'ALL' &&
        opening.shiftType.isNotEmpty &&
        shifts.length > 1) {
      final filtered = shifts
          .where((s) =>
              s.shiftType.toUpperCase() == opening.shiftType.toUpperCase())
          .toList();
      if (filtered.isNotEmpty) return filtered;
    }
    return shifts;
  }

  int _getTotalStopCount(RouteOpeningItem opening) {
    final shifts = _getShiftsForOpening(opening);
    if (shifts.isEmpty) return opening.sanitizedStops.length;
    return shifts.fold<int>(0, (totalCount, s) => totalCount + s.stops.length);
  }

  Future<void> _loadEmployeeProfile() async {
    try {
      final doc = await FirebaseFirestore.instance
          .collection('employees')
          .doc(widget.driverId)
          .get();
      if (doc.exists && doc.data() != null) {
        final d = doc.data()!;
        final first = (d['firstName'] ?? '').toString().trim();
        final last = (d['lastName'] ?? '').toString().trim();
        final full = '$first $last'.trim();
        if (mounted) {
          setState(() {
            if (full.isNotEmpty) _employeeFullName = full;
            _employeePhone = d['phone']?.toString();
            final addrParts = [
              d['address']?.toString(),
              d['city']?.toString(),
              d['postalCode']?.toString(),
            ].where((p) => p != null && p.trim().isNotEmpty).join(', ');
            if (addrParts.isNotEmpty) _employeeAddress = addrParts;
            _employeeSeniority = d['hireDate']?.toString();
          });
        }
      }
    } catch (e) {
      debugPrint('[RouteOpeningsPage] Employee profile lookup notice: $e');
    }
  }

  String get _displayName =>
      (_employeeFullName != null && _employeeFullName!.isNotEmpty)
          ? _employeeFullName!
          : widget.driverName;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        elevation: 0.5,
        backgroundColor: isDark ? AppColors.darkCard : Colors.white,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Route Openings & Bidding',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            Text(
              'Inspect sanitized stops & apply for open routes',
              style: TextStyle(
                fontSize: 11,
                color: isDark
                    ? AppColors.textSecondaryDark
                    : AppColors.textSecondaryLight,
              ),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          // Filter bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: isDark ? AppColors.darkCard : Colors.white,
              border: Border(
                bottom: BorderSide(
                  color: isDark
                      ? AppColors.darkCardBorder
                      : AppColors.lightCardBorder,
                ),
              ),
            ),
            child: Row(
              children: [
                _buildFilterChip('open', 'Open Positions', isDark),
                const SizedBox(width: 8),
                _buildFilterChip('mine', 'My Applications', isDark),
                const SizedBox(width: 8),
                _buildFilterChip('all', 'All Bulletins', isDark),
              ],
            ),
          ),

          // Stream of openings
          Expanded(
            child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
              stream: FirebaseFirestore.instance
                  .collection('route_openings')
                  .snapshots(),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting &&
                    !snapshot.hasData) {
                  return const Center(
                    child: CircularProgressIndicator(color: AppColors.primary),
                  );
                }

                if (snapshot.hasError) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        'Unable to load route openings: ${snapshot.error}',
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: AppColors.error),
                      ),
                    ),
                  );
                }

                final docs = snapshot.data?.docs ?? [];
                final allItems = docs
                    .map((d) => RouteOpeningItem.fromFirestore(d))
                    .toList()
                  ..sort((a, b) => b.createdAt.compareTo(a.createdAt));

                // Trigger background fetch for any opening whose shifts aren't cached yet
                for (final item in allItems) {
                  if (_getShiftsForOpening(item).isEmpty) {
                    _ensureShiftsForOpening(item);
                  }
                }

                final filtered = allItems.where((item) {
                  if (_filterMode == 'open') {
                    return item.status == 'open';
                  }
                  if (_filterMode == 'mine') {
                    return item.myApplication(widget.driverId) != null;
                  }
                  return true;
                }).toList();

                // If initialRouteNo is provided, sort matching route to top
                if (widget.initialRouteNo != null &&
                    widget.initialRouteNo!.isNotEmpty) {
                  final target = widget.initialRouteNo!.trim().toLowerCase();
                  filtered.sort((a, b) {
                    final aMatch = a.routeNo.toLowerCase() == target ? 0 : 1;
                    final bMatch = b.routeNo.toLowerCase() == target ? 0 : 1;
                    if (aMatch != bMatch) return aMatch.compareTo(bMatch);
                    return b.createdAt.compareTo(a.createdAt);
                  });
                }

                if (filtered.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.campaign_outlined,
                          size: 54,
                          color: isDark
                              ? Colors.grey.shade700
                              : Colors.grey.shade400,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          _filterMode == 'mine'
                              ? 'You have not applied to any route openings yet.'
                              : 'No active route openings at the moment.',
                          style: TextStyle(
                            fontSize: 14,
                            color: isDark
                                ? AppColors.textSecondaryDark
                                : AppColors.textSecondaryLight,
                          ),
                        ),
                      ],
                    ),
                  );
                }

                return ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: filtered.length,
                  itemBuilder: (context, index) {
                    final opening = filtered[index];
                    final isHighlighted = widget.initialRouteNo != null &&
                        opening.routeNo.toLowerCase() ==
                            widget.initialRouteNo!.trim().toLowerCase();
                    return _buildOpeningCard(
                      context,
                      opening,
                      isDark,
                      isHighlighted: isHighlighted,
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String mode, String label, bool isDark) {
    final selected = _filterMode == mode;
    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _filterMode = mode),
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: selected
                ? AppColors.primary
                : (isDark ? Colors.black26 : Colors.grey.shade100),
            borderRadius: BorderRadius.circular(10),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: selected
                  ? Colors.black87
                  : (isDark ? Colors.grey.shade300 : Colors.grey.shade700),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildOpeningCard(
    BuildContext context,
    RouteOpeningItem opening,
    bool isDark, {
    bool isHighlighted = false,
  }) {
    final myApp = opening.myApplication(widget.driverId);
    final canApply = opening.status == 'open' && !opening.isDeadlinePassed;
    final totalStops = _getTotalStopCount(opening);

    final roleBadgeText = opening.roleNeeded == 'driver'
        ? 'DRIVER NEEDED'
        : opening.roleNeeded == 'attendant'
            ? 'ATTENDANT NEEDED'
            : 'DRIVER & ATTENDANT';

    final typeText = opening.postingType == 'permanent'
        ? 'Permanent Run (Starts ${opening.effectiveStartDate})'
        : 'Temporary (${opening.effectiveStartDate} ~ ${opening.effectiveEndDate ?? opening.effectiveStartDate})';

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isHighlighted
              ? AppColors.primary
              : (isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder),
          width: isHighlighted ? 2 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top badges row
          Wrap(
            spacing: 6,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              _buildPill(
                opening.status.toUpperCase(),
                opening.status == 'open'
                    ? AppColors.success
                    : opening.status == 'awarded'
                        ? AppColors.info
                        : Colors.grey,
              ),
              _buildPill(
                opening.postingType == 'permanent' ? 'PERMANENT' : 'TEMPORARY',
                opening.postingType == 'permanent'
                    ? Colors.purpleAccent
                    : AppColors.primary,
              ),
              _buildPill(roleBadgeText, Colors.amber),
              if (myApp != null)
                _buildPill(
                  myApp.status == 'selected'
                      ? 'AWARDED TO YOU'
                      : 'APPLIED (${myApp.roleApplied.toUpperCase()})',
                  AppColors.success,
                ),
            ],
          ),
          const SizedBox(height: 12),

          // Route header
          Row(
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  opening.routeNo,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    color: AppColors.primary,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      opening.routeName.isNotEmpty
                          ? opening.routeName
                          : 'Route ${opening.routeNo}',
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    if (opening.schoolName != null &&
                        opening.schoolName!.isNotEmpty)
                      Text(
                        'School: ${opening.schoolName}',
                        style: TextStyle(
                          fontSize: 12,
                          color: isDark
                              ? AppColors.textSecondaryDark
                              : AppColors.textSecondaryLight,
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Details grid
          _buildInfoRow(Icons.calendar_today_rounded, typeText, isDark),
          const SizedBox(height: 4),
          _buildInfoRow(
            Icons.access_time_rounded,
            'Shifts: ${opening.shiftType == 'ALL' ? 'Full Run (AM & PM)' : '${opening.shiftType} Shift Only'} • $totalStops Stops',
            isDark,
          ),
          const SizedBox(height: 4),
          _buildInfoRow(
            Icons.timer_outlined,
            'Application Deadline: ${opening.deadline.replaceAll('T', ' ')}',
            isDark,
            highlightColor:
                opening.isDeadlinePassed ? AppColors.error : AppColors.primary,
          ),
          if (opening.compensationNote != null &&
              opening.compensationNote!.isNotEmpty) ...[
            const SizedBox(height: 4),
            _buildInfoRow(
              Icons.payments_outlined,
              'Bonus / Rate: ${opening.compensationNote}',
              isDark,
              highlightColor: AppColors.success,
            ),
          ],

          if (opening.description.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: isDark ? Colors.black26 : Colors.grey.shade50,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                opening.description,
                style: TextStyle(
                  fontSize: 12.5,
                  height: 1.35,
                  color: isDark ? Colors.grey.shade300 : Colors.grey.shade800,
                ),
              ),
            ),
          ],

          if (opening.status == 'awarded' &&
              (opening.awardedDriverName != null ||
                  opening.awardedAttendantName != null)) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.success.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: AppColors.success.withValues(alpha: 0.3),
                ),
              ),
              child: Text(
                'Awarded to: ${opening.awardedDriverName ?? opening.awardedAttendantName}',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: AppColors.success,
                ),
              ),
            ),
          ],

          const SizedBox(height: 14),

          // Action buttons
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.primary,
                    side: const BorderSide(color: AppColors.primary),
                    minimumSize: const Size(0, 42),
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  icon: const Icon(Icons.map_rounded, size: 16),
                  label: Text(
                    'View Map & Stops ($totalStops)',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  onPressed: () => _showSanitizedStopsSheet(
                    context,
                    opening,
                    isDark,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              if (myApp != null && canApply)
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.error,
                      side: const BorderSide(color: AppColors.error),
                      minimumSize: const Size(0, 42),
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    icon: const Icon(Icons.close_rounded, size: 16),
                    label: const Text(
                      'Withdraw Bid',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    onPressed: () => _withdrawApplication(opening),
                  ),
                )
              else if (canApply)
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: const Color(0xFF0F172A),
                      minimumSize: const Size(0, 42),
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    icon: const Icon(Icons.send_rounded, size: 15),
                    label: const Text(
                      'Apply Now',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    onPressed: () => _showApplyDialog(context, opening, isDark),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPill(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.bold,
          color: color,
        ),
      ),
    );
  }

  Widget _buildInfoRow(
    IconData icon,
    String text,
    bool isDark, {
    Color? highlightColor,
  }) {
    return Row(
      children: [
        Icon(
          icon,
          size: 14,
          color: highlightColor ??
              (isDark
                  ? AppColors.textSecondaryDark
                  : AppColors.textSecondaryLight),
        ),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            text,
            style: TextStyle(
              fontSize: 12,
              fontWeight:
                  highlightColor != null ? FontWeight.w600 : FontWeight.normal,
              color: highlightColor ??
                  (isDark
                      ? AppColors.textSecondaryDark
                      : AppColors.textSecondaryLight),
            ),
          ),
        ),
      ],
    );
  }

  void _showSanitizedStopsSheet(
    BuildContext context,
    RouteOpeningItem opening,
    bool isDark,
  ) {
    int selectedShiftIndex = 0;
    int? selectedMapStopIndex;
    bool isSheetLoading = _getShiftsForOpening(opening).isEmpty;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: isDark ? AppColors.darkCard : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (sheetCtx, setSheetState) {
            if (isSheetLoading) {
              _ensureShiftsForOpening(opening).then((_) {
                if (sheetCtx.mounted) {
                  setSheetState(() => isSheetLoading = false);
                }
              });
            }

            final shifts = _getShiftsForOpening(opening);
            final activeShift = (shifts.isNotEmpty &&
                    selectedShiftIndex < shifts.length)
                ? shifts[selectedShiftIndex]
                : null;
            final stopsToShow = activeShift?.stops ?? opening.sanitizedStops;

            final mapStops = stopsToShow.map((stop) {
              final isSchool = stop.stopType.toLowerCase().contains('school');
              final displayTitle = isSchool
                  ? ((stop.schoolName != null && stop.schoolName!.isNotEmpty)
                      ? stop.schoolName!
                      : stop.stopName)
                  : (stop.stopName.isNotEmpty
                      ? stop.stopName
                      : 'Stop #${stop.sequence}');
              return MapStopPin(
                sequence: stop.sequence,
                title: displayTitle,
                subtitle: isSchool
                    ? (stop.stopName.isNotEmpty ? stop.stopName : 'School Stop')
                    : (stop.address.isNotEmpty ? stop.address : 'Student Stop'),
                scheduledTime: stop.scheduledTime,
                isSchoolStop: isSchool,
                schoolNameHint: stop.schoolName ?? opening.schoolName,
                latitude: stop.latitude,
                longitude: stop.longitude,
              );
            }).toList();

            return DraggableScrollableSheet(
              expand: false,
              initialChildSize: 0.86,
              minChildSize: 0.50,
              maxChildSize: 0.96,
              builder: (_, scrollController) {
                return Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.alt_route_rounded,
                              color: AppColors.primary),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Route ${opening.routeNo} — Google Map & Stops',
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.close_rounded),
                            onPressed: () => Navigator.of(ctx).pop(),
                          ),
                        ],
                      ),
                      // Privacy notice banner
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(10),
                        margin: const EdgeInsets.only(top: 6, bottom: 12),
                        decoration: BoxDecoration(
                          color: AppColors.info.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: AppColors.info.withValues(alpha: 0.3),
                          ),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.shield_outlined,
                                size: 16, color: AppColors.info),
                            SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Student Privacy Protected: Passenger names, IDs, grades, and parent contacts are strictly masked.',
                                style: TextStyle(
                                  fontSize: 11.5,
                                  color: AppColors.info,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Shift tabs if multiple shifts exist (e.g. AM and PM)
                      if (shifts.length > 1) ...[
                        SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Row(
                            children: List.generate(shifts.length, (idx) {
                              final s = shifts[idx];
                              final isSelected = selectedShiftIndex == idx;
                              return Padding(
                                padding: const EdgeInsets.only(
                                    right: 8, bottom: 12),
                                child: InkWell(
                                  onTap: () => setSheetState(() {
                                    selectedShiftIndex = idx;
                                    selectedMapStopIndex = null;
                                  }),
                                  borderRadius: BorderRadius.circular(10),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 14,
                                      vertical: 8,
                                    ),
                                    decoration: BoxDecoration(
                                      color: isSelected
                                          ? AppColors.primary
                                          : (isDark
                                              ? Colors.black26
                                              : Colors.grey.shade100),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Text(
                                      '${s.shiftType} (${s.stops.length} stops)',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.bold,
                                        color: isSelected
                                            ? Colors.black87
                                            : (isDark
                                                ? Colors.white70
                                                : Colors.black87),
                                      ),
                                    ),
                                  ),
                                ),
                              );
                            }),
                          ),
                        ),
                      ],

                      // Google Map preview card
                      if (!isSheetLoading && mapStops.isNotEmpty) ...[
                        GoogleRouteMapCard(
                          routeTitle: 'Route ${opening.routeNo}',
                          shiftLabel: activeShift?.shiftType ?? opening.shiftType,
                          stops: mapStops,
                          focusedStopSequence: selectedMapStopIndex != null &&
                                  selectedMapStopIndex! < mapStops.length
                              ? mapStops[selectedMapStopIndex!].sequence
                              : null,
                          mapHeight: 220,
                          onStopSelected: (pin) {
                            final idx = mapStops.indexWhere(
                              (s) => s.sequence == pin.sequence,
                            );
                            setSheetState(
                              () => selectedMapStopIndex = idx >= 0 ? idx : null,
                            );
                          },
                        ),
                        const SizedBox(height: 12),
                      ],

                      Expanded(
                        child: isSheetLoading
                            ? const Center(
                                child: CircularProgressIndicator(
                                    color: AppColors.primary),
                              )
                            : stopsToShow.isEmpty
                                ? const Center(
                                    child: Text(
                                      'No stop schedule details listed for this route.',
                                      style: TextStyle(color: Colors.grey),
                                    ),
                                  )
                                : ListView.separated(
                                    controller: scrollController,
                                    itemCount: stopsToShow.length,
                                    separatorBuilder: (_, _) =>
                                        const SizedBox(height: 8),
                                    itemBuilder: (_, idx) {
                                      final stop = stopsToShow[idx];
                                      final isSchool = stop.stopType
                                          .toLowerCase()
                                          .contains('school');
                                      final isSelectedOnMap =
                                          selectedMapStopIndex == idx;
                                      final displayTitle = isSchool
                                          ? ((stop.schoolName != null &&
                                                  stop.schoolName!.isNotEmpty)
                                              ? stop.schoolName!
                                              : stop.stopName)
                                          : (stop.stopName.isNotEmpty
                                              ? stop.stopName
                                              : 'Stop #${stop.sequence}');
                                      return InkWell(
                                        onTap: () {
                                          setSheetState(
                                              () => selectedMapStopIndex = idx);
                                        },
                                        borderRadius: BorderRadius.circular(12),
                                        child: Container(
                                          padding: const EdgeInsets.all(12),
                                          decoration: BoxDecoration(
                                            color: isDark
                                                ? AppColors.darkBg
                                                : Colors.grey.shade50,
                                            borderRadius:
                                                BorderRadius.circular(12),
                                            border: Border.all(
                                              color: isSelectedOnMap
                                                  ? AppColors.primary
                                                  : isSchool
                                                      ? Colors.purpleAccent
                                                          .withValues(
                                                              alpha: 0.4)
                                                      : (isDark
                                                          ? AppColors
                                                              .darkCardBorder
                                                          : AppColors
                                                              .lightCardBorder),
                                              width: isSelectedOnMap ? 2 : 1,
                                            ),
                                          ),
                                          child: Row(
                                            children: [
                                              CircleAvatar(
                                                radius: 14,
                                                backgroundColor: isSchool
                                                    ? Colors.purpleAccent
                                                        .withValues(alpha: 0.2)
                                                    : AppColors.primary
                                                        .withValues(alpha: 0.2),
                                                child: Text(
                                                  '${stop.sequence}',
                                                  style: TextStyle(
                                                    fontSize: 12,
                                                    fontWeight: FontWeight.bold,
                                                    color: isSchool
                                                        ? Colors.purpleAccent
                                                        : AppColors.primary,
                                                  ),
                                                ),
                                              ),
                                              const SizedBox(width: 12),
                                              Expanded(
                                                child: Column(
                                                  crossAxisAlignment:
                                                      CrossAxisAlignment.start,
                                                  children: [
                                                    Row(
                                                      children: [
                                                        Icon(
                                                          isSchool
                                                              ? Icons
                                                                  .school_rounded
                                                              : Icons
                                                                  .place_outlined,
                                                          size: 14,
                                                          color: isSchool
                                                              ? Colors
                                                                  .purpleAccent
                                                              : AppColors
                                                                  .primary,
                                                        ),
                                                        const SizedBox(width: 5),
                                                        Expanded(
                                                          child: Text(
                                                            displayTitle,
                                                            style: TextStyle(
                                                              fontSize: 13.5,
                                                              fontWeight:
                                                                  FontWeight
                                                                      .bold,
                                                              color: isSchool
                                                                  ? Colors
                                                                      .purpleAccent
                                                                  : null,
                                                            ),
                                                          ),
                                                        ),
                                                      ],
                                                    ),
                                                    Padding(
                                                      padding:
                                                          const EdgeInsets.only(
                                                              top: 3),
                                                      child: Text(
                                                        isSchool
                                                            ? 'School Stop'
                                                            : 'Student Stop',
                                                        style: TextStyle(
                                                          fontSize: 11,
                                                          color: isDark
                                                              ? AppColors
                                                                  .textSecondaryDark
                                                              : AppColors
                                                                  .textSecondaryLight,
                                                        ),
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                              if (stop.scheduledTime.isNotEmpty)
                                                Container(
                                                  padding:
                                                      const EdgeInsets.symmetric(
                                                    horizontal: 8,
                                                    vertical: 4,
                                                  ),
                                                  decoration: BoxDecoration(
                                                    color: AppColors.primary
                                                        .withValues(alpha: 0.15),
                                                    borderRadius:
                                                        BorderRadius.circular(8),
                                                  ),
                                                  child: Text(
                                                    stop.scheduledTime,
                                                    style: const TextStyle(
                                                      fontSize: 12,
                                                      fontWeight:
                                                          FontWeight.bold,
                                                      color: AppColors.primary,
                                                    ),
                                                  ),
                                                ),
                                            ],
                                          ),
                                        ),
                                      );
                                    },
                                  ),
                      ),
                    ],
                  ),
                );
              },
            );
          },
        );
      },
    );
  }

  void _showApplyDialog(
    BuildContext context,
    RouteOpeningItem opening,
    bool isDark,
  ) {
    final normalizedUserRole = widget.role.toLowerCase();
    String selectedRole = opening.roleNeeded == 'attendant'
        ? 'attendant'
        : opening.roleNeeded == 'driver'
            ? 'driver'
            : (normalizedUserRole.contains('helper') ||
                    normalizedUserRole.contains('attendant')
                ? 'attendant'
                : 'driver');

    final noteController = TextEditingController();
    bool isSubmitting = false;

    showDialog(
      context: context,
      builder: (dialogCtx) {
        return StatefulBuilder(
          builder: (ctx, setDialogState) {
            return AlertDialog(
              backgroundColor: isDark ? AppColors.darkCard : Colors.white,
              title: Text(
                'Apply for Route ${opening.routeNo}',
                style:
                    const TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Applicant: $_displayName (${widget.driverId})',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (opening.roleNeeded == 'both') ...[
                      const Text(
                        'Select Position Role:',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Expanded(
                            child: ChoiceChip(
                              label: const Text('Driver'),
                              selected: selectedRole == 'driver',
                              onSelected: (_) => setDialogState(
                                () => selectedRole = 'driver',
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: ChoiceChip(
                              label: const Text('Attendant'),
                              selected: selectedRole == 'attendant',
                              onSelected: (_) => setDialogState(
                                () => selectedRole = 'attendant',
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                    ],
                    TextField(
                      controller: noteController,
                      maxLines: 3,
                      decoration: const InputDecoration(
                        labelText: 'Application Note (Optional)',
                        hintText:
                            'E.g., Familiar with this school area, park bus at home nearby...',
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed:
                      isSubmitting ? null : () => Navigator.of(dialogCtx).pop(),
                  child: const Text('Cancel'),
                ),
                ElevatedButton.icon(
                  onPressed: isSubmitting
                      ? null
                      : () async {
                          setDialogState(() => isSubmitting = true);
                          try {
                            await _submitApplication(
                              opening: opening,
                              roleApplied: selectedRole,
                              note: noteController.text.trim(),
                            );
                            if (dialogCtx.mounted) {
                              Navigator.of(dialogCtx).pop();
                            }
                            if (mounted) {
                              ScaffoldMessenger.of(this.context).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    'Application submitted for Route ${opening.routeNo}!',
                                  ),
                                  backgroundColor: AppColors.success,
                                ),
                              );
                            }
                          } catch (e) {
                            setDialogState(() => isSubmitting = false);
                            if (mounted) {
                              ScaffoldMessenger.of(this.context).showSnackBar(
                                SnackBar(
                                  content: Text('Failed to submit: $e'),
                                  backgroundColor: AppColors.error,
                                ),
                              );
                            }
                          }
                        },
                  icon: const Icon(Icons.check_rounded, size: 16),
                  label: Text(isSubmitting ? 'Submitting...' : 'Submit Bid'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _submitApplication({
    required RouteOpeningItem opening,
    required String roleApplied,
    required String note,
  }) async {
    final docRef = FirebaseFirestore.instance
        .collection('route_openings')
        .doc(opening.id);
    final snap = await docRef.get();
    if (!snap.exists) throw Exception('Opening no longer exists');

    final current = RouteOpeningItem.fromFirestore(snap);
    final newApplicant = RouteOpeningApplicantItem(
      employeeId: widget.driverId,
      fullName: _displayName,
      roleApplied: roleApplied,
      phone: _employeePhone,
      homeAddress: _employeeAddress,
      seniorityDate: _employeeSeniority,
      appliedAt: DateTime.now().toUtc().toIso8601String(),
      note: note.isNotEmpty ? note : null,
      status: 'pending',
    );

    final updatedList = [
      ...current.applicants
          .where((a) =>
              a.employeeId.trim().toLowerCase() !=
              widget.driverId.trim().toLowerCase())
          .map((a) => a.toMap()),
      newApplicant.toMap(),
    ];

    await docRef.set(
      {
        'applicants': updatedList,
        'updatedAt': DateTime.now().toUtc().toIso8601String(),
      },
      SetOptions(merge: true),
    );
  }

  Future<void> _withdrawApplication(RouteOpeningItem opening) async {
    try {
      final docRef = FirebaseFirestore.instance
          .collection('route_openings')
          .doc(opening.id);
      final snap = await docRef.get();
      if (!snap.exists) return;

      final current = RouteOpeningItem.fromFirestore(snap);
      final updatedList = current.applicants.map((a) {
        if (a.employeeId.trim().toLowerCase() ==
            widget.driverId.trim().toLowerCase()) {
          return RouteOpeningApplicantItem(
            employeeId: a.employeeId,
            fullName: a.fullName,
            roleApplied: a.roleApplied,
            phone: a.phone,
            homeAddress: a.homeAddress,
            seniorityDate: a.seniorityDate,
            appliedAt: a.appliedAt,
            note: a.note,
            status: 'withdrawn',
          ).toMap();
        }
        return a.toMap();
      }).toList();

      await docRef.set(
        {
          'applicants': updatedList,
          'updatedAt': DateTime.now().toUtc().toIso8601String(),
        },
        SetOptions(merge: true),
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content:
                Text('Withdrew application for Route ${opening.routeNo}.'),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error withdrawing application: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }
}
