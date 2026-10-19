import 'package:flutter/material.dart';
import '../../../core/theme.dart';
import '../models/vehicle_signout_model.dart';

class VehicleSignoutDetailPage extends StatelessWidget {
  final VehicleSignoutModel record;

  const VehicleSignoutDetailPage({
    super.key,
    required this.record,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: Text('Unit #${record.unitNumber} Handover'),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 16),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: record.isSignIn
                  ? Colors.green.withValues(alpha: 0.15)
                  : Colors.blue.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: record.isSignIn
                    ? Colors.green.withValues(alpha: 0.3)
                    : Colors.blue.withValues(alpha: 0.3),
              ),
            ),
            child: Text(
              record.isSignIn ? 'SIGN IN / RETURN' : 'SIGN OUT / FIELD',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: record.isSignIn ? Colors.green : Colors.blue[400],
              ),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Vehicle & Custody Overview Card
            _buildOverviewCard(isDark),
            const SizedBox(height: 16),

            // Vehicle Details
            _buildVehicleDetailsCard(isDark),
            const SizedBox(height: 16),

            // Verified Documents Checklist
            _buildDocumentsCard(isDark),
            const SizedBox(height: 16),

            // Safety Equipment Checklist
            _buildEquipmentCard(isDark),
            const SizedBox(height: 16),

            // Condition & Parking Notes
            if ((record.conditionComments != null && record.conditionComments!.isNotEmpty) ||
                (record.parkingAddress != null && record.parkingAddress!.isNotEmpty))
              _buildConditionCard(isDark),
            if ((record.conditionComments != null && record.conditionComments!.isNotEmpty) ||
                (record.parkingAddress != null && record.parkingAddress!.isNotEmpty))
              const SizedBox(height: 16),

            // Photos
            if (record.attachments.isNotEmpty) ...[
              _buildPhotosCard(isDark),
              const SizedBox(height: 16),
            ],

            // Digital Signatures
            _buildSignaturesCard(isDark),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildOverviewCard(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? Colors.grey[900] : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? Colors.grey[800]! : Colors.grey[200]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Driver / Recipient', style: TextStyle(fontSize: 11, color: Colors.grey)),
                  const SizedBox(height: 2),
                  Text(
                    record.employeeName,
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text('Handover Date', style: TextStyle(fontSize: 11, color: Colors.grey)),
                  const SizedBox(height: 2),
                  Text(
                    record.signDate,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.primary),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(height: 1),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildKeyValue('License', record.driverLicenseClass ?? 'Class 2-S'),
              _buildKeyValue('Conditions', record.driverLicenseCondition ?? 'None'),
              _buildKeyValue('Route', record.routeId ?? 'General'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildVehicleDetailsCard(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? Colors.grey[900] : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? Colors.grey[800]! : Colors.grey[200]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Vehicle Specifications', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildKeyValue('Unit #', record.unitNumber),
              _buildKeyValue('Plate', record.licensePlate ?? 'N/A'),
              _buildKeyValue('Maker/Model', '${record.unitMaker ?? ""} ${record.unitModel ?? ""}'),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildKeyValue('Odometer', '${record.odometer.toStringAsFixed(1)} km'),
              _buildKeyValue('Fuel Level', record.fuelLevelDescription ?? 'Full'),
              _buildKeyValue('Fuel Type', record.fuelTypeDescription ?? 'Diesel'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDocumentsCard(bool isDark) {
    final docs = [
      MapEntry('Vehicle Registration', record.docRegistrationSignIn),
      MapEntry('Pink Card / Insurance', record.docInsuranceSignIn),
      MapEntry('Safety Fitness Certificate', record.docSafetyFitnessSignIn),
      MapEntry('Collision Report Forms', record.docCollisionReportSignIn),
      MapEntry('Schedule 2 Maintenance', record.docScheduleMaintenanceSignIn),
      MapEntry('SDS Safety Binder', record.docSdsSignIn),
    ];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? Colors.grey[900] : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? Colors.grey[800]! : Colors.grey[200]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Verified Documents', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: docs.map((entry) {
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: entry.value
                      ? Colors.green.withValues(alpha: 0.1)
                      : Colors.red.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: entry.value
                        ? Colors.green.withValues(alpha: 0.3)
                        : Colors.red.withValues(alpha: 0.3),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      entry.value ? Icons.check_circle_rounded : Icons.cancel_rounded,
                      size: 14,
                      color: entry.value ? Colors.green : Colors.red,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      entry.key,
                      style: TextStyle(
                        fontSize: 11,
                        color: entry.value ? Colors.green[300] : Colors.red[300],
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildEquipmentCard(bool isDark) {
    final gear = [
      MapEntry('Fire Extinguisher', record.checkFireExtinguisher),
      MapEntry('First Aid Kit', record.checkFirstAidKit),
      MapEntry('Warning Triangles', record.checkTriangles),
      MapEntry('Seat Belt Cutter', record.checkSeatBeltCutter),
      MapEntry('Broom', record.checkBroom),
      MapEntry('Snowbrush', record.checkSnowbrush),
      MapEntry('Clean / Spill Kit', record.checkCleankit),
      MapEntry('Q-Straints', record.checkQstraints),
    ];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? Colors.grey[900] : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? Colors.grey[800]! : Colors.grey[200]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Safety Equipment Checklist', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: gear.map((entry) {
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: entry.value
                      ? Colors.blue.withValues(alpha: 0.1)
                      : Colors.grey.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: entry.value
                        ? Colors.blue.withValues(alpha: 0.3)
                        : Colors.grey.withValues(alpha: 0.3),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      entry.value ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
                      size: 14,
                      color: entry.value ? Colors.blue[400] : Colors.grey,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      entry.key,
                      style: TextStyle(
                        fontSize: 11,
                        color: entry.value ? Colors.blue[300] : Colors.grey,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildConditionCard(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? Colors.grey[900] : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? Colors.grey[800]! : Colors.grey[200]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Condition & Parking Notes', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
          if (record.conditionComments != null && record.conditionComments!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              record.conditionComments!,
              style: TextStyle(fontSize: 12, color: isDark ? Colors.grey[300] : Colors.grey[800]),
            ),
          ],
          if (record.parkingAddress != null && record.parkingAddress!.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              'Parking: ${record.parkingAddress}',
              style: const TextStyle(fontSize: 11, color: Colors.grey),
            ),
          ],
          if (record.fireHallLocation != null && record.fireHallLocation!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              'Nearest Fire Hall: ${record.fireHallLocation}',
              style: const TextStyle(fontSize: 11, color: Colors.grey),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildPhotosCard(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? Colors.grey[900] : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? Colors.grey[800]! : Colors.grey[200]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Attached Photos', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: record.attachments.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              crossAxisSpacing: 8,
              mainAxisSpacing: 8,
            ),
            itemBuilder: (context, index) {
              final att = record.attachments[index];
              return ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.network(
                  att.url,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => Container(
                    color: Colors.grey[800],
                    child: const Icon(Icons.broken_image_rounded, color: Colors.grey),
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildSignaturesCard(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? Colors.grey[900] : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? Colors.grey[800]! : Colors.grey[200]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Signatures & Acknowledgement', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Driver Signature', style: TextStyle(fontSize: 10, color: Colors.grey)),
                  const SizedBox(height: 2),
                  Text(
                    record.driverSignature ?? record.employeeName,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, fontStyle: FontStyle.italic),
                  ),
                  Text(
                    record.driverSignDate ?? record.signDate,
                    style: const TextStyle(fontSize: 10, color: Colors.grey),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text('Fleet Inspector', style: TextStyle(fontSize: 10, color: Colors.grey)),
                  const SizedBox(height: 2),
                  Text(
                    record.fleetDepartmentSignature ?? 'Fleet Lead',
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, fontStyle: FontStyle.italic),
                  ),
                  Text(
                    record.fleetDepartmentSignDate ?? record.signDate,
                    style: const TextStyle(fontSize: 10, color: Colors.grey),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildKeyValue(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 10, color: Colors.grey)),
        const SizedBox(height: 2),
        Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
      ],
    );
  }
}
