import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/core/models.dart';

void main() {
  group('Models Serialization and Tolerance', () {
    group('VehicleLiveLocation', () {
      test('fromJson parses complete valid JSON payload', () {
        final nowStr = '2026-11-03T14:00:00.000Z';
        final json = {
          'unitNumber': '1001',
          'routeNo': 'Route 101',
          'shiftId': 'shift_123',
          'latitude': 45.3524,
          'longitude': -75.7558,
          'heading': 180.5,
          'speedKmh': 35.8,
          'lastUpdated': nowStr,
          'currentStopSequence': 3,
          'nextStopLocation': 'Baseline Rd',
          'status': 'EN_ROUTE',
        };

        final loc = VehicleLiveLocation.fromJson(json);

        expect(loc.unitNumber, '1001');
        expect(loc.routeNo, 'Route 101');
        expect(loc.shiftId, 'shift_123');
        expect(loc.latitude, 45.3524);
        expect(loc.longitude, -75.7558);
        expect(loc.heading, 180.5);
        expect(loc.speedKmh, 35.8);
        expect(loc.lastUpdated.toUtc().toIso8601String(), nowStr);
        expect(loc.currentStopSequence, 3);
        expect(loc.nextStopLocation, 'Baseline Rd');
        expect(loc.status, 'EN_ROUTE');
      });

      test('fromJson falls back to safe default values when fields are null or missing', () {
        final loc = VehicleLiveLocation.fromJson({});

        expect(loc.unitNumber, '');
        expect(loc.routeNo, '');
        expect(loc.shiftId, '');
        expect(loc.latitude, 0.0);
        expect(loc.longitude, 0.0);
        expect(loc.heading, 0.0);
        expect(loc.speedKmh, 0.0);
        expect(loc.currentStopSequence, 0);
        expect(loc.nextStopLocation, '');
        expect(loc.status, 'EN_ROUTE');
        expect(loc.lastUpdated, isNotNull);
      });

      test('fromJson tolerates integer values for double coordinates', () {
        final json = {
          'latitude': 45,
          'longitude': -75,
          'heading': 90,
          'speedKmh': 50,
        };

        final loc = VehicleLiveLocation.fromJson(json);

        expect(loc.latitude, 45.0);
        expect(loc.longitude, -75.0);
        expect(loc.heading, 90.0);
        expect(loc.speedKmh, 50.0);
      });
    });

    group('ParentStudentCommute', () {
      test('fromJson parses complete student commute and nested vehicle location', () {
        final json = {
          'studentId': 101,
          'studentNo': 'STU-001',
          'studentName': 'Emma Watson',
          'grade': 'Grade 2',
          'schoolName': 'Broadview Public School',
          'schoolLatitude': 45.3789,
          'schoolLongitude': -75.7610,
          'avatarColor': '#2563EB',
          'shiftType': 'AM',
          'shiftId': 'shift_1',
          'routeNo': 'Route 101',
          'busUnitNumber': '1001',
          'driverName': 'Robert Smith',
          'stopLocation': 'Woodroffe & Baseline',
          'stopLatitude': 45.3524,
          'stopLongitude': -75.7558,
          'stopType': 'PICKUP',
          'scheduledTime': '07:35 AM',
          'estimatedTime': '07:38 AM',
          'lateMinutes': 3,
          'status': 'EN_ROUTE',
          'distanceKm': 1.2,
          'minutesAway': 4,
          'routePolyline': 'mock_polyline_string',
          'vehicleLocation': {
            'unitNumber': '1001',
            'latitude': 45.3510,
            'longitude': -75.7550,
            'status': 'EN_ROUTE',
          },
        };

        final commute = ParentStudentCommute.fromJson(json);

        expect(commute.studentId, 101);
        expect(commute.studentNo, 'STU-001');
        expect(commute.studentName, 'Emma Watson');
        expect(commute.grade, 'Grade 2');
        expect(commute.schoolName, 'Broadview Public School');
        expect(commute.schoolLatitude, 45.3789);
        expect(commute.schoolLongitude, -75.7610);
        expect(commute.avatarColor, '#2563EB');
        expect(commute.shiftType, 'AM');
        expect(commute.busUnitNumber, '1001');
        expect(commute.driverName, 'Robert Smith');
        expect(commute.lateMinutes, 3);
        expect(commute.status, 'EN_ROUTE');
        expect(commute.distanceKm, 1.2);
        expect(commute.minutesAway, 4);
        expect(commute.routePolyline, 'mock_polyline_string');
        expect(commute.vehicleLocation, isNotNull);
        expect(commute.vehicleLocation?.unitNumber, '1001');
        expect(commute.vehicleLocation?.latitude, 45.3510);
      });

      test('fromJson applies fallback defaults when minimal fields provided', () {
        final commute = ParentStudentCommute.fromJson({});

        expect(commute.studentId, 0);
        expect(commute.studentNo, '');
        expect(commute.studentName, 'Student');
        expect(commute.grade, '');
        expect(commute.schoolName, '');
        expect(commute.avatarColor, '#2563EB');
        expect(commute.shiftType, 'AM');
        expect(commute.stopLocation, 'Designated Stop');
        expect(commute.stopType, 'HomePickup');
        expect(commute.scheduledTime, '07:30');
        expect(commute.status, 'SCHEDULED');
        expect(commute.vehicleLocation, isNull);
        expect(commute.distanceKm, isNull);
        expect(commute.minutesAway, isNull);
        expect(commute.routePolyline, isNull);
      });
    });

    group('ParentUser', () {
      test('fromJson and toJson roundtrip consistency', () {
        final user = ParentUser(
          id: 'usr_999',
          contactType: 'phone',
          contactValue: '613-555-0100',
          displayName: 'David Watson',
          phone: '613-555-0100',
          email: 'david@example.com',
          homeAddress: '123 Ottawa St, Ottawa',
          isRegistered: true,
          linkedStudentIds: ['101', '102'],
        );

        final json = user.toJson();
        final reconstructed = ParentUser.fromJson(json);

        expect(reconstructed.id, user.id);
        expect(reconstructed.contactType, user.contactType);
        expect(reconstructed.contactValue, user.contactValue);
        expect(reconstructed.displayName, user.displayName);
        expect(reconstructed.phone, user.phone);
        expect(reconstructed.email, user.email);
        expect(reconstructed.homeAddress, user.homeAddress);
        expect(reconstructed.isRegistered, user.isRegistered);
        expect(reconstructed.linkedStudentIds, equals(['101', '102']));
      });

      test('fromJson handles null values with reasonable fallbacks', () {
        final user = ParentUser.fromJson({});

        expect(user.id, '');
        expect(user.contactType, 'phone');
        expect(user.contactValue, '');
        expect(user.displayName, 'Parent');
        expect(user.phone, '');
        expect(user.email, '');
        expect(user.homeAddress, '');
        expect(user.isRegistered, isFalse);
        expect(user.linkedStudentIds, isEmpty);
      });
    });

    group('ParentNotificationConfig', () {
      test('default constructor initializes all expected notification flags', () {
        final config = ParentNotificationConfig();

        expect(config.notifyApproaching, isTrue);
        expect(config.approachingMinutes, 5);
        expect(config.notifyDelay, isTrue);
        expect(config.delayThresholdMinutes, 10);
        expect(config.notifyBoarding, isTrue);
        expect(config.notifyDropoff, isTrue);
        expect(config.channelPush, isTrue);
        expect(config.channelSms, isTrue);
        expect(config.channelEmail, isFalse);
      });

      test('toJson and fromJson preserves custom configuration', () {
        final custom = ParentNotificationConfig(
          notifyApproaching: false,
          approachingMinutes: 8,
          notifyDelay: false,
          delayThresholdMinutes: 15,
          notifyBoarding: false,
          notifyDropoff: false,
          channelPush: false,
          channelSms: false,
          channelEmail: true,
        );

        final json = custom.toJson();
        final parsed = ParentNotificationConfig.fromJson(json);

        expect(parsed.notifyApproaching, isFalse);
        expect(parsed.approachingMinutes, 8);
        expect(parsed.notifyDelay, isFalse);
        expect(parsed.delayThresholdMinutes, 15);
        expect(parsed.notifyBoarding, isFalse);
        expect(parsed.notifyDropoff, isFalse);
        expect(parsed.channelPush, isFalse);
        expect(parsed.channelSms, isFalse);
        expect(parsed.channelEmail, isTrue);
      });
    });
  });
}
