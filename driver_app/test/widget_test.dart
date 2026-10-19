import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app/main.dart';

void main() {
  testWidgets('Driver App smoke test - verifies login title loads', (WidgetTester tester) async {
    await tester.pumpWidget(const DriverApp());
    await tester.pumpAndSettle();
    expect(find.text('PCY Tech • Driver Hub'), findsOneWidget);
  });
}
