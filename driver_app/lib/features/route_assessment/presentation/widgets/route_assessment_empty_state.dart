import 'package:flutter/material.dart';

class RouteAssessmentEmptyState extends StatelessWidget {
  const RouteAssessmentEmptyState({super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.assignment_outlined, size: 56, color: Colors.grey[400]),
          const SizedBox(height: 12),
          Text(
            'No route assessments found',
            style: TextStyle(fontSize: 15, color: Colors.grey[600]),
          ),
          const SizedBox(height: 8),
          Text(
            'Tap "+ New Assessment" to conduct your route safety checklist.',
            style: TextStyle(fontSize: 12, color: Colors.grey[500]),
          ),
        ],
      ),
    );
  }
}
