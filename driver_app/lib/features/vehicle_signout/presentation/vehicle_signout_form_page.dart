import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/theme.dart';
import '../../../core/feedback_utils.dart';
import '../bloc/vehicle_signout_bloc.dart';
import '../bloc/vehicle_signout_event.dart';
import '../bloc/vehicle_signout_state.dart';
import '../models/vehicle_signout_model.dart';
import '../repository/vehicle_signout_repository.dart';

class VehicleSignoutFormPage extends StatefulWidget {
  final String driverId;
  final String driverName;
  final String? initialUnitNumber;

  const VehicleSignoutFormPage({
    super.key,
    required this.driverId,
    required this.driverName,
    this.initialUnitNumber,
  });

  @override
  State<VehicleSignoutFormPage> createState() => _VehicleSignoutFormPageState();
}

class _VehicleSignoutFormPageState extends State<VehicleSignoutFormPage> {
  final _formKey = GlobalKey<FormState>();
  int _currentStep = 0;

  // Step 1: Custody & Vehicle
  bool _isSignIn = false; // false = Sign Out, true = Sign In
  int _vehicleType = 0; // 0 = Bus, 1 = Van
  late TextEditingController _dateController;
  late TextEditingController _unitNumberController;
  late TextEditingController _driverIdController;
  late TextEditingController _driverNameController;
  late TextEditingController _cellPhoneController;
  late TextEditingController _licenseClassController;
  late TextEditingController _odometerController;
  String _fuelLevelDescription = 'Full';
  String _fuelTypeDescription = 'Diesel';

  // Step 2: Document Checklist
  bool _docRegistration = true;
  bool _docInsurance = true;
  bool _docSafetyFitness = true;
  bool _docCollisionReport = true;
  bool _docScheduleMaintenance = true;
  bool _docSds = true;

  // Step 2: Equipment Checklist
  bool _checkFireExtinguisher = true;
  bool _checkFirstAidKit = true;
  bool _checkTriangles = true;
  bool _checkQstraints = false;
  bool _checkSeatBeltCutter = true;
  bool _checkBroom = true;
  bool _checkSnowbrush = true;
  bool _checkCleankit = true;

  // Step 3: Location, Condition & Signatures
  late TextEditingController _parkingAddressController;
  late TextEditingController _fireHallLocationController;
  String _conditionKey = 'Good';
  late TextEditingController _conditionCommentsController;
  bool _acknowledgeCheck = true;
  late TextEditingController _driverSignatureController;
  late TextEditingController _fleetSignatureController;

  // Photos
  final List<VehicleSignoutAttachment> _attachments = [];
  bool _isUploadingPhoto = false;

  @override
  void initState() {
    super.initState();
    final today = DateTime.now();
    final dateStr =
        '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';

    _dateController = TextEditingController(text: dateStr);
    _unitNumberController = TextEditingController(text: widget.initialUnitNumber ?? '');
    _driverIdController = TextEditingController(text: widget.driverId);
    _driverNameController = TextEditingController(text: widget.driverName);
    _cellPhoneController = TextEditingController();
    _licenseClassController = TextEditingController(text: 'Class 2-S');
    _odometerController = TextEditingController(text: '0');

    _parkingAddressController = TextEditingController(text: 'Yard Main Parking');
    _fireHallLocationController = TextEditingController(text: 'Station #12');
    _conditionCommentsController = TextEditingController();
    _driverSignatureController = TextEditingController(text: widget.driverName);
    _fleetSignatureController = TextEditingController(text: 'Fleet Supervisor');
  }

  @override
  void dispose() {
    _dateController.dispose();
    _unitNumberController.dispose();
    _driverIdController.dispose();
    _driverNameController.dispose();
    _cellPhoneController.dispose();
    _licenseClassController.dispose();
    _odometerController.dispose();
    _parkingAddressController.dispose();
    _fireHallLocationController.dispose();
    _conditionCommentsController.dispose();
    _driverSignatureController.dispose();
    _fleetSignatureController.dispose();
    super.dispose();
  }

  void _verifyAllDocuments(bool value) {
    setState(() {
      _docRegistration = value;
      _docInsurance = value;
      _docSafetyFitness = value;
      _docCollisionReport = value;
      _docScheduleMaintenance = value;
      _docSds = value;
    });
  }

  void _verifyAllEquipment(bool value) {
    setState(() {
      _checkFireExtinguisher = value;
      _checkFirstAidKit = value;
      _checkTriangles = value;
      _checkSeatBeltCutter = value;
      _checkBroom = value;
      _checkSnowbrush = value;
      _checkCleankit = value;
    });
  }

  Future<void> _pickAndUploadPhoto() async {
    final repo = context.read<VehicleSignoutRepository>();
    final picker = ImagePicker();
    try {
      final picked = await picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 75,
        maxWidth: 1200,
      );
      if (picked == null || !mounted) return;

      setState(() => _isUploadingPhoto = true);
      final bytes = await picked.readAsBytes();
      final url = await repo.uploadPhoto(bytes, picked.name);

      if (url != null && mounted) {
        setState(() {
          _attachments.add(
            VehicleSignoutAttachment(
              url: url,
              fileName: picked.name,
              uploadedTime: DateTime.now().toIso8601String(),
            ),
          );
        });
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to upload photo. Please try again.')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error selecting photo: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isUploadingPhoto = false);
      }
    }
  }

  void _submitForm() {
    if (!_formKey.currentState!.validate()) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please complete all required fields.')),
      );
      return;
    }

    if (!_acknowledgeCheck) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please check the acknowledgement to proceed.')),
      );
      return;
    }

    final double odo = double.tryParse(_odometerController.text.trim()) ?? 0.0;
    final now = DateTime.now();

    final model = VehicleSignoutModel(
      id: '',
      isSignIn: _isSignIn,
      signDate: _dateController.text.trim(),
      vehicleType: _vehicleType,
      employeeId: _driverIdController.text.trim(),
      employeeName: _driverNameController.text.trim(),
      cellPhone: _cellPhoneController.text.trim().isNotEmpty
          ? _cellPhoneController.text.trim()
          : null,
      driverLicenseClass: _licenseClassController.text.trim().isNotEmpty
          ? _licenseClassController.text.trim()
          : null,
      unitNumber: _unitNumberController.text.trim(),
      odometer: odo,
      fuelLevelDescription: _fuelLevelDescription,
      fuelTypeDescription: _fuelTypeDescription,
      docRegistrationSignIn: _docRegistration,
      docInsuranceSignIn: _docInsurance,
      docSafetyFitnessSignIn: _docSafetyFitness,
      docCollisionReportSignIn: _docCollisionReport,
      docScheduleMaintenanceSignIn: _docScheduleMaintenance,
      docSdsSignIn: _docSds,
      checkFireExtinguisher: _checkFireExtinguisher,
      checkFirstAidKit: _checkFirstAidKit,
      checkTriangles: _checkTriangles,
      checkQstraints: _checkQstraints,
      checkSeatBeltCutter: _checkSeatBeltCutter,
      checkBroom: _checkBroom,
      checkSnowbrush: _checkSnowbrush,
      checkCleankit: _checkCleankit,
      acknowledgeCheck: _acknowledgeCheck,
      conditionKey: _conditionKey,
      conditionComments: _conditionCommentsController.text.trim().isNotEmpty
          ? _conditionCommentsController.text.trim()
          : null,
      parkingAddress: _parkingAddressController.text.trim().isNotEmpty
          ? _parkingAddressController.text.trim()
          : null,
      fireHallLocation: _fireHallLocationController.text.trim().isNotEmpty
          ? _fireHallLocationController.text.trim()
          : null,
      driverSignature: _driverSignatureController.text.trim().isNotEmpty
          ? _driverSignatureController.text.trim()
          : null,
      driverSignDate: now.toIso8601String(),
      fleetDepartmentSignature: _fleetSignatureController.text.trim().isNotEmpty
          ? _fleetSignatureController.text.trim()
          : null,
      fleetDepartmentSignDate: now.toIso8601String(),
      attachments: _attachments,
      createdBy: widget.driverName,
      createdAt: now.toIso8601String(),
      updatedAt: now.toIso8601String(),
    );

    context.read<VehicleSignoutBloc>().add(CreateVehicleSignoutEvent(model));
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return BlocListener<VehicleSignoutBloc, VehicleSignoutState>(
      listener: (context, state) {
        if (state is VehicleSignoutSuccess) {
          AppFeedback.showSuccess(
            context,
            message:
                'Vehicle Handover (${state.created.isSignIn ? "Sign In" : "Sign Out"}) record saved successfully!',
          );
          Navigator.of(context).pop();
        } else if (state is VehicleSignoutFailure) {
          AppFeedback.showError(
            context,
            title: 'Handover Submission Failed',
            message: state.error,
          );
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(_isSignIn ? 'Vehicle Return (Sign In)' : 'Vehicle Dispatch (Sign Out)'),
          elevation: 0,
        ),
        body: Form(
          key: _formKey,
          child: Column(
            children: [
              // Step Progress Header
              Container(
                color: isDark ? Colors.grey[900] : Colors.grey[100],
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  children: [
                    _buildStepIndicator(0, 'Custody', Icons.directions_bus_rounded),
                    _buildStepDivider(),
                    _buildStepIndicator(1, 'Checklists', Icons.checklist_rounded),
                    _buildStepDivider(),
                    _buildStepIndicator(2, 'Sign-off', Icons.verified_rounded),
                  ],
                ),
              ),

              // Step Content Area
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: _buildCurrentStep(isDark),
                ),
              ),

              // Bottom Navigation Controls
              _buildBottomControls(isDark),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStepIndicator(int stepIndex, String title, IconData icon) {
    final isActive = _currentStep == stepIndex;
    final isPassed = _currentStep > stepIndex;

    return GestureDetector(
      onTap: () {
        if (_formKey.currentState!.validate() || stepIndex < _currentStep) {
          setState(() => _currentStep = stepIndex);
        }
      },
      child: Row(
        children: [
          CircleAvatar(
            radius: 14,
            backgroundColor: isPassed
                ? AppColors.success
                : (isActive ? AppColors.primary : Colors.grey[400]),
            child: Icon(
              isPassed ? Icons.check_rounded : icon,
              size: 14,
              color: const Color(0xFF0F172A),
            ),
          ),
          const SizedBox(width: 6),
          Text(
            title,
            style: TextStyle(
              fontSize: 12,
              fontWeight: isActive ? FontWeight.bold : FontWeight.w500,
              color: isActive
                  ? AppColors.primary
                  : (isPassed ? AppColors.success : Colors.grey),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStepDivider() {
    return Expanded(
      child: Container(
        height: 2,
        margin: const EdgeInsets.symmetric(horizontal: 8),
        color: Colors.grey.withValues(alpha: 0.3),
      ),
    );
  }

  Widget _buildCurrentStep(bool isDark) {
    switch (_currentStep) {
      case 0:
        return _buildStep0Custody(isDark);
      case 1:
        return _buildStep1Checklists(isDark);
      case 2:
        return _buildStep2SignOff(isDark);
      default:
        return const SizedBox.shrink();
    }
  }

  // ─── Step 0: Custody & Vehicle ──────────────────────────────────────────────
  Widget _buildStep0Custody(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Mode Selector: Sign Out vs Sign In
        Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: isDark ? Colors.grey[850] : Colors.grey[200],
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _isSignIn = false),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      color: !_isSignIn ? AppColors.primary : Colors.transparent,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      'Sign Out (Take Vehicle)',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: !_isSignIn ? const Color(0xFF0F172A) : Colors.grey,
                      ),
                    ),
                  ),
                ),
              ),
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _isSignIn = true),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      color: _isSignIn ? AppColors.primary : Colors.transparent,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      'Sign In (Return Vehicle)',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: _isSignIn ? const Color(0xFF0F172A) : Colors.grey,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Date and Vehicle Type Row
        Row(
          children: [
            Expanded(
              child: TextFormField(
                controller: _dateController,
                readOnly: true,
                decoration: const InputDecoration(
                  labelText: 'Handover Date',
                  prefixIcon: Icon(Icons.calendar_today_rounded, size: 20),
                ),
                onTap: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: DateTime.now(),
                    firstDate: DateTime(2020),
                    lastDate: DateTime(2030),
                  );
                  if (picked != null) {
                    setState(() {
                      _dateController.text =
                          '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
                    });
                  }
                },
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: DropdownButtonFormField<int>(
                initialValue: _vehicleType,
                isExpanded: true,
                isDense: true,
                decoration: const InputDecoration(
                  labelText: 'Vehicle Type',
                  prefixIcon: Icon(Icons.airport_shuttle_rounded, size: 18),
                  contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 12),
                ),
                items: const [
                  DropdownMenuItem(
                    value: 0,
                    child: Text('School Bus', overflow: TextOverflow.ellipsis),
                  ),
                  DropdownMenuItem(
                    value: 1,
                    child: Text('Passenger Van', overflow: TextOverflow.ellipsis),
                  ),
                ],
                onChanged: (val) {
                  if (val != null) setState(() => _vehicleType = val);
                },
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),

        // Unit # and Odometer
        Row(
          children: [
            Expanded(
              child: TextFormField(
                controller: _unitNumberController,
                decoration: const InputDecoration(
                  labelText: 'Unit Number *',
                  hintText: 'e.g. 104',
                  prefixIcon: Icon(Icons.tag_rounded, size: 20),
                ),
                validator: (val) =>
                    (val == null || val.trim().isEmpty) ? 'Required' : null,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: TextFormField(
                controller: _odometerController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: 'Odometer (km) *',
                  hintText: 'e.g. 45230',
                  prefixIcon: Icon(Icons.speed_rounded, size: 20),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) return 'Required';
                  if (double.tryParse(val.trim()) == null) return 'Invalid #';
                  return null;
                },
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),

        // Fuel Level & Fuel Type
        Row(
          children: [
            Expanded(
              child: DropdownButtonFormField<String>(
                initialValue: _fuelLevelDescription,
                isExpanded: true,
                isDense: true,
                decoration: const InputDecoration(
                  labelText: 'Fuel Level',
                  prefixIcon: Icon(Icons.local_gas_station_rounded, size: 18),
                  contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 12),
                ),
                items: const [
                  DropdownMenuItem(value: 'Full', child: Text('Full (1/1)', overflow: TextOverflow.ellipsis)),
                  DropdownMenuItem(value: '3/4', child: Text('3/4', overflow: TextOverflow.ellipsis)),
                  DropdownMenuItem(value: '1/2', child: Text('1/2', overflow: TextOverflow.ellipsis)),
                  DropdownMenuItem(value: '1/4', child: Text('1/4', overflow: TextOverflow.ellipsis)),
                  DropdownMenuItem(value: 'Empty', child: Text('Near Empty', overflow: TextOverflow.ellipsis)),
                ],
                onChanged: (val) {
                  if (val != null) setState(() => _fuelLevelDescription = val);
                },
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: DropdownButtonFormField<String>(
                initialValue: _fuelTypeDescription,
                isExpanded: true,
                isDense: true,
                decoration: const InputDecoration(
                  labelText: 'Fuel Type',
                  prefixIcon: Icon(Icons.ev_station_rounded, size: 18),
                  contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 12),
                ),
                items: const [
                  DropdownMenuItem(value: 'Diesel', child: Text('Diesel', overflow: TextOverflow.ellipsis)),
                  DropdownMenuItem(value: 'Gasoline', child: Text('Gasoline', overflow: TextOverflow.ellipsis)),
                  DropdownMenuItem(value: 'Propane', child: Text('Propane', overflow: TextOverflow.ellipsis)),
                  DropdownMenuItem(value: 'Electric', child: Text('Electric', overflow: TextOverflow.ellipsis)),
                ],
                onChanged: (val) {
                  if (val != null) setState(() => _fuelTypeDescription = val);
                },
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),

        const Text(
          'DRIVER INFORMATION',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.bold,
            letterSpacing: 1,
            color: Colors.grey,
          ),
        ),
        const SizedBox(height: 10),

        // Driver Name & Driver ID
        Row(
          children: [
            Expanded(
              child: TextFormField(
                controller: _driverNameController,
                decoration: const InputDecoration(
                  labelText: 'Driver Name *',
                  prefixIcon: Icon(Icons.person_rounded, size: 20),
                ),
                validator: (val) =>
                    (val == null || val.trim().isEmpty) ? 'Required' : null,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: TextFormField(
                controller: _driverIdController,
                decoration: const InputDecoration(
                  labelText: 'Driver ID *',
                  prefixIcon: Icon(Icons.badge_rounded, size: 20),
                ),
                validator: (val) =>
                    (val == null || val.trim().isEmpty) ? 'Required' : null,
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),

        // Phone & License Class
        Row(
          children: [
            Expanded(
              child: TextFormField(
                controller: _cellPhoneController,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: 'Phone Number',
                  hintText: 'e.g. 403-555-0199',
                  prefixIcon: Icon(Icons.phone_rounded, size: 20),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: TextFormField(
                controller: _licenseClassController,
                decoration: const InputDecoration(
                  labelText: 'License Class',
                  hintText: 'e.g. Class 2-S',
                  prefixIcon: Icon(Icons.card_membership_rounded, size: 20),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  // ─── Step 1: Checklists ──────────────────────────────────────────────────
  Widget _buildStep1Checklists(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Documents Section
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'REQUIRED DOCUMENTS',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                letterSpacing: 1,
                color: Colors.grey,
              ),
            ),
            TextButton(
              onPressed: () => _verifyAllDocuments(true),
              child: const Text('Verify All', style: TextStyle(fontSize: 12)),
            ),
          ],
        ),
        _buildCheckTile(
          'Vehicle Registration Certificate',
          'Current valid provincial registration document',
          _docRegistration,
          (val) => setState(() => _docRegistration = val),
        ),
        _buildCheckTile(
          'Insurance Card & Policy',
          'Valid commercial vehicle insurance pink card',
          _docInsurance,
          (val) => setState(() => _docInsurance = val),
        ),
        _buildCheckTile(
          'Safety Fitness Certificate',
          'Operating authority documentation',
          _docSafetyFitness,
          (val) => setState(() => _docSafetyFitness = val),
        ),
        _buildCheckTile(
          'Collision & Incident Report Forms',
          'Blank crash pack and accident reporting envelopes',
          _docCollisionReport,
          (val) => setState(() => _docCollisionReport = val),
        ),
        _buildCheckTile(
          'Scheduled Maintenance Sheet',
          'Log of recent oil, brakes, and safety servicing',
          _docScheduleMaintenance,
          (val) => setState(() => _docScheduleMaintenance = val),
        ),
        _buildCheckTile(
          'Safety Data Sheets (SDS)',
          'Chemical safety sheets for vehicle supplies',
          _docSds,
          (val) => setState(() => _docSds = val),
        ),

        const SizedBox(height: 20),

        // Safety Equipment Section
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'SAFETY GEAR & EQUIPMENT',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                letterSpacing: 1,
                color: Colors.grey,
              ),
            ),
            TextButton(
              onPressed: () => _verifyAllEquipment(true),
              child: const Text('Verify All', style: TextStyle(fontSize: 12)),
            ),
          ],
        ),
        _buildCheckTile(
          'Fire Extinguisher',
          'Charged gauge in green zone, pin locked',
          _checkFireExtinguisher,
          (val) => setState(() => _checkFireExtinguisher = val),
        ),
        _buildCheckTile(
          'First Aid Kit',
          'Clean, sealed, fully stocked medical supplies',
          _checkFirstAidKit,
          (val) => setState(() => _checkFirstAidKit = val),
        ),
        _buildCheckTile(
          'Emergency Reflective Triangles (3x)',
          'Complete boxed triangle warning kit',
          _checkTriangles,
          (val) => setState(() => _checkTriangles = val),
        ),
        _buildCheckTile(
          'Wheelchair Q-Straints & Lap Belts',
          'Securement retractors and occupant restraints',
          _checkQstraints,
          (val) => setState(() => _checkQstraints = val),
        ),
        _buildCheckTile(
          'Emergency Seat Belt Cutter',
          'Mounted within direct reach of driver seat',
          _checkSeatBeltCutter,
          (val) => setState(() => _checkSeatBeltCutter = val),
        ),
        _buildCheckTile(
          'Broom & Dustpan',
          'Interior vehicle cleaning equipment',
          _checkBroom,
          (val) => setState(() => _checkBroom = val),
        ),
        _buildCheckTile(
          'Snowbrush & Ice Scraper',
          'Winter weather clearing gear',
          _checkSnowbrush,
          (val) => setState(() => _checkSnowbrush = val),
        ),
        _buildCheckTile(
          'Biohazard & Bodily Fluid Clean Kit',
          'Absorbent powder, gloves, disinfectant & bags',
          _checkCleankit,
          (val) => setState(() => _checkCleankit = val),
        ),
      ],
    );
  }

  // ─── Step 2: Sign-Off, Parking, Condition & Photos ───────────────────────
  Widget _buildStep2SignOff(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'PARKING & FIRE SAFETY LOCATIONS',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.bold,
            letterSpacing: 1,
            color: Colors.grey,
          ),
        ),
        const SizedBox(height: 10),

        TextFormField(
          controller: _parkingAddressController,
          decoration: const InputDecoration(
            labelText: 'Designated Overnight Parking Address',
            prefixIcon: Icon(Icons.local_parking_rounded, size: 20),
          ),
        ),
        const SizedBox(height: 12),

        TextFormField(
          controller: _fireHallLocationController,
          decoration: const InputDecoration(
            labelText: 'Nearest Fire Hall Location',
            prefixIcon: Icon(Icons.local_fire_department_rounded, size: 20),
          ),
        ),
        const SizedBox(height: 20),

        const Text(
          'OVERALL VEHICLE CONDITION',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.bold,
            letterSpacing: 1,
            color: Colors.grey,
          ),
        ),
        const SizedBox(height: 10),

        DropdownButtonFormField<String>(
          initialValue: _conditionKey,
          isExpanded: true,
          isDense: true,
          decoration: const InputDecoration(
            labelText: 'Condition Status',
            prefixIcon: Icon(Icons.car_repair_rounded, size: 18),
            contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 12),
          ),
          items: const [
            DropdownMenuItem(value: 'Excellent', child: Text('Excellent (Clean & Defect-Free)', overflow: TextOverflow.ellipsis)),
            DropdownMenuItem(value: 'Good', child: Text('Good (Normal Wear & Tear)', overflow: TextOverflow.ellipsis)),
            DropdownMenuItem(value: 'Minor Damage', child: Text('Minor Damage (Scratches/Dents)', overflow: TextOverflow.ellipsis)),
            DropdownMenuItem(value: 'Needs Service', child: Text('Needs Service / Maintenance', overflow: TextOverflow.ellipsis)),
          ],
          onChanged: (val) {
            if (val != null) setState(() => _conditionKey = val);
          },
        ),
        const SizedBox(height: 12),

        TextFormField(
          controller: _conditionCommentsController,
          maxLines: 3,
          decoration: const InputDecoration(
            labelText: 'Condition Comments / Body Notes',
            hintText: 'Record any pre-existing scratches, windshield chips, or notes...',
          ),
        ),
        const SizedBox(height: 20),

        // Photo Attachment Section
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'PHOTOS & EVIDENCE',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                letterSpacing: 1,
                color: Colors.grey,
              ),
            ),
            TextButton.icon(
              onPressed: _isUploadingPhoto ? null : _pickAndUploadPhoto,
              icon: _isUploadingPhoto
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.add_a_photo_rounded, size: 16),
              label: Text(_isUploadingPhoto ? 'Uploading...' : 'Add Photo'),
            ),
          ],
        ),
        if (_attachments.isEmpty)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isDark ? Colors.grey[850] : Colors.grey[100],
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.grey.withValues(alpha: 0.3)),
            ),
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.photo_outlined, size: 20, color: Colors.grey),
                SizedBox(width: 8),
                Text(
                  'No photos attached (optional)',
                  style: TextStyle(fontSize: 12, color: Colors.grey),
                ),
              ],
            ),
          )
        else
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _attachments.map((att) {
              return Stack(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Image.network(
                      att.url,
                      width: 80,
                      height: 80,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => Container(
                        width: 80,
                        height: 80,
                        color: Colors.grey[800],
                        child: const Icon(Icons.broken_image, size: 24),
                      ),
                    ),
                  ),
                  Positioned(
                    top: 2,
                    right: 2,
                    child: GestureDetector(
                      onTap: () {
                        setState(() {
                          _attachments.remove(att);
                        });
                      },
                      child: Container(
                        padding: const EdgeInsets.all(2),
                        decoration: const BoxDecoration(
                          color: Colors.black87,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.close_rounded, size: 14, color: Colors.white),
                      ),
                    ),
                  ),
                ],
              );
            }).toList(),
          ),

        const SizedBox(height: 24),

        // Legal Acknowledgement Checkbox
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.25)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Checkbox(
                value: _acknowledgeCheck,
                activeColor: AppColors.primary,
                checkColor: const Color(0xFF0F172A),
                onChanged: (val) => setState(() => _acknowledgeCheck = val ?? false),
              ),
              const Expanded(
                child: Padding(
                  padding: EdgeInsets.only(top: 8),
                  child: Text(
                    'I certify that this vehicle handover was completed accurately. All safety gear is present, documented, and vehicle custody is formally transferred.',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Signature Inputs
        Row(
          children: [
            Expanded(
              child: TextFormField(
                controller: _driverSignatureController,
                decoration: const InputDecoration(
                  labelText: 'Driver Signature *',
                  prefixIcon: Icon(Icons.draw_rounded, size: 20),
                ),
                validator: (val) =>
                    (val == null || val.trim().isEmpty) ? 'Required' : null,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: TextFormField(
                controller: _fleetSignatureController,
                decoration: const InputDecoration(
                  labelText: 'Fleet Signature *',
                  prefixIcon: Icon(Icons.admin_panel_settings_rounded, size: 20),
                ),
                validator: (val) =>
                    (val == null || val.trim().isEmpty) ? 'Required' : null,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildCheckTile(
    String title,
    String subtitle,
    bool value,
    ValueChanged<bool> onChanged,
  ) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Material(
        color: value
            ? AppColors.success.withValues(alpha: 0.05)
            : Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: BorderSide(
            color: value
                ? AppColors.success.withValues(alpha: 0.2)
                : Colors.grey.withValues(alpha: 0.2),
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: CheckboxListTile(
          title: Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
          subtitle: Text(subtitle, style: const TextStyle(fontSize: 11, color: Colors.grey)),
          value: value,
          activeColor: AppColors.success,
          checkColor: Colors.white,
          dense: true,
          controlAffinity: ListTileControlAffinity.leading,
          onChanged: (val) => onChanged(val ?? false),
        ),
      ),
    );
  }

  Widget _buildBottomControls(bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: isDark ? Colors.grey[900] : Colors.white,
        border: Border(top: BorderSide(color: isDark ? Colors.grey[800]! : Colors.grey[200]!)),
      ),
      child: Row(
        children: [
          if (_currentStep > 0)
            OutlinedButton(
              onPressed: () => setState(() => _currentStep--),
              child: const Text('Back'),
            ),
          const Spacer(),
          if (_currentStep < 2)
            ElevatedButton(
              onPressed: () {
                if (_formKey.currentState!.validate()) {
                  setState(() => _currentStep++);
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: const Color(0xFF0F172A),
              ),
              child: const Row(
                children: [
                  Text('Next Step'),
                  SizedBox(width: 4),
                  Icon(Icons.arrow_forward_rounded, size: 16),
                ],
              ),
            )
          else
            BlocBuilder<VehicleSignoutBloc, VehicleSignoutState>(
              builder: (context, state) {
                final isSubmitting = state is VehicleSignoutSubmitting;
                return ElevatedButton(
                  onPressed: isSubmitting ? null : _submitForm,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.success,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  ),
                  child: isSubmitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : const Row(
                          children: [
                            Icon(Icons.check_circle_rounded, size: 18),
                            SizedBox(width: 6),
                            Text('Submit Handover', style: TextStyle(fontWeight: FontWeight.bold)),
                          ],
                        ),
                );
              },
            ),
        ],
      ),
    );
  }
}
