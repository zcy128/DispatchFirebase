class CompanyContactModel {
  final String id;
  final String name;
  final String title;
  final String department;
  final String phone;
  final String? extension;
  final String email;
  final String hours;
  final bool is24x7;
  final String? notes;

  const CompanyContactModel({
    required this.id,
    required this.name,
    required this.title,
    required this.department,
    required this.phone,
    this.extension,
    required this.email,
    required this.hours,
    this.is24x7 = false,
    this.notes,
  });

  factory CompanyContactModel.fromMap(Map<String, dynamic> map, String id) {
    return CompanyContactModel(
      id: id,
      name: map['name']?.toString() ?? '',
      title: map['title']?.toString() ?? '',
      department: map['department']?.toString() ?? 'Operations',
      phone: map['phone']?.toString() ?? '',
      extension: map['extension']?.toString(),
      email: map['email']?.toString() ?? '',
      hours: map['hours']?.toString() ?? 'Standard Hours',
      is24x7: map['is24x7'] == true,
      notes: map['notes']?.toString(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'title': title,
      'department': department,
      'phone': phone,
      if (extension != null) 'extension': extension,
      'email': email,
      'hours': hours,
      'is24x7': is24x7,
      if (notes != null) 'notes': notes,
    };
  }
}
