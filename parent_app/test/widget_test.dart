import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/core/api_client.dart';
import 'package:parent_app/main.dart';

void main() {
  testWidgets('ParentApp renders LoginScreen with passwordless info', (WidgetTester tester) async {
    final client = ApiClient();
    await tester.pumpWidget(ParentApp(apiClient: client));
    await tester.pump();

    // Verify brand and passwordless banner text
    expect(find.text('PCY Bus Tracker'), findsOneWidget);
    expect(find.text('Send Verification Passcode'), findsOneWidget);
    expect(find.text('Demo Phone'), findsOneWidget);
  });
}
