import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import '../../../core/theme.dart';
import '../../../core/feedback_utils.dart';
import '../../../core/widgets/attachment_picker_widget.dart';
import '../bloc/expense_reimbursement_bloc.dart';
import '../bloc/expense_reimbursement_event.dart';
import '../bloc/expense_reimbursement_state.dart';
import '../models/expense_reimbursement_model.dart';
import '../repository/expense_reimbursement_repository.dart';

class ExpenseReimbursementFormPage extends StatelessWidget {
  final String driverId;
  final String driverName;
  final String defaultRouteNo;

  const ExpenseReimbursementFormPage({
    super.key,
    required this.driverId,
    required this.driverName,
    this.defaultRouteNo = '',
  });

  @override
  Widget build(BuildContext context) {
    ExpenseReimbursementBloc? existingBloc;
    try {
      existingBloc = context.read<ExpenseReimbursementBloc>();
    } catch (_) {
      existingBloc = null;
    }

    final view = _ExpenseReimbursementFormView(
      driverId: driverId,
      driverName: driverName,
      defaultRouteNo: defaultRouteNo,
    );

    if (existingBloc != null) {
      return view;
    }

    return BlocProvider<ExpenseReimbursementBloc>(
      create: (ctx) => ExpenseReimbursementBloc(
        repository: ctx.read<ExpenseReimbursementRepository>(),
      ),
      child: view,
    );
  }
}

class _LineFormEntry {
  final String id;
  String categoryCode;
  String categoryDisplayName;
  final TextEditingController amountController;
  final TextEditingController noteController;

  _LineFormEntry({
    required this.id,
    required this.categoryCode,
    required this.categoryDisplayName,
    String amount = '',
    String note = '',
  })  : amountController = TextEditingController(text: amount),
        noteController = TextEditingController(text: note);

  void dispose() {
    amountController.dispose();
    noteController.dispose();
  }
}

class _ExpenseReimbursementFormView extends StatefulWidget {
  final String driverId;
  final String driverName;
  final String defaultRouteNo;

  const _ExpenseReimbursementFormView({
    required this.driverId,
    required this.driverName,
    required this.defaultRouteNo,
  });

  @override
  State<_ExpenseReimbursementFormView> createState() =>
      _ExpenseReimbursementFormViewState();
}

class _ExpenseReimbursementFormViewState
    extends State<_ExpenseReimbursementFormView> {
  static const Color _brandColor = Color(0xFF0D9488); // Teal
  final _formKey = GlobalKey<FormState>();

  DateTime _claimDate = DateTime.now();
  late final TextEditingController _routeController;

  List<ExpenseCategory> _categories = [];
  final List<_LineFormEntry> _lines = [];
  List<String> _attachmentUrls = [];
  bool _loadingCategories = true;

  @override
  void initState() {
    super.initState();
    _routeController = TextEditingController(text: widget.defaultRouteNo);
    _loadCategories();
  }

  @override
  void dispose() {
    _routeController.dispose();
    for (final line in _lines) {
      line.dispose();
    }
    super.dispose();
  }

  Future<void> _loadCategories() async {
    try {
      final repo = context.read<ExpenseReimbursementRepository>();
      final cats = await repo.getCategories();
      if (!mounted) return;
      setState(() {
        _categories = cats;
        _loadingCategories = false;
        if (_lines.isEmpty && cats.isNotEmpty) {
          _addLine();
        }
      });
    } catch (_) {
      if (!mounted) return;
      final defaults = ExpenseCategory.defaultCategories();
      setState(() {
        _categories = defaults;
        _loadingCategories = false;
        if (_lines.isEmpty) {
          _addLine();
        }
      });
    }
  }

  void _addLine() {
    final defaultCat = _categories.isNotEmpty
        ? _categories.first
        : const ExpenseCategory(
            id: 'cat-fuel',
            code: 'fuel',
            displayName: 'Fuel / Gas',
          );

    final entry = _LineFormEntry(
      id: 'line-${DateTime.now().millisecondsSinceEpoch}-${_lines.length}',
      categoryCode: defaultCat.code,
      categoryDisplayName: defaultCat.displayName,
    );
    entry.amountController.addListener(() {
      setState(() {});
    });

    setState(() {
      _lines.add(entry);
    });
  }

  void _removeLine(int index) {
    if (_lines.length <= 1) return;
    final removed = _lines.removeAt(index);
    removed.dispose();
    setState(() {});
  }

  double get _totalAmount {
    var sum = 0.0;
    for (final l in _lines) {
      final amt = double.tryParse(l.amountController.text.trim());
      if (amt != null && amt > 0) {
        sum += amt;
      }
    }
    return sum;
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _claimDate,
      firstDate: DateTime.now().subtract(const Duration(days: 90)),
      lastDate: DateTime.now(),
      builder: (ctx, child) {
        return Theme(
          data: Theme.of(ctx).copyWith(
            colorScheme: Theme.of(ctx).colorScheme.copyWith(
                  primary: _brandColor,
                ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() {
        _claimDate = picked;
      });
    }
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    if (_lines.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please add at least one expense item.')),
      );
      return;
    }

    final parsedLines = <ExpenseReimbursementLine>[];
    for (int i = 0; i < _lines.length; i++) {
      final entry = _lines[i];
      final amount = double.tryParse(entry.amountController.text.trim()) ?? 0.0;
      if (amount <= 0) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Item #${i + 1} must have an amount greater than 0.')),
        );
        return;
      }

      parsedLines.add(
        ExpenseReimbursementLine(
          id: entry.id,
          categoryCode: entry.categoryCode,
          categoryDisplayName: entry.categoryDisplayName,
          amount: amount,
          note: entry.noteController.text.trim(),
          sortOrder: i + 1,
        ),
      );
    }

    final dateStr = DateFormat('yyyy-MM-dd').format(_claimDate);
    final claim = ExpenseReimbursementClaim(
      id: '',
      employeeId: widget.driverId,
      employeeName: widget.driverName,
      claimDate: dateStr,
      routeNo: _routeController.text.trim(),
      totalAmount: _totalAmount,
      lines: parsedLines,
      attachmentUrls: _attachmentUrls,
      status: ExpenseClaimStatus.pending,
      createdAt: DateTime.now().toUtc(),
      updatedAt: DateTime.now().toUtc(),
    );

    context.read<ExpenseReimbursementBloc>().add(SubmitExpenseClaimEvent(claim));
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return BlocListener<ExpenseReimbursementBloc, ExpenseReimbursementState>(
      listener: (context, state) {
        if (state is ExpenseReimbursementSubmitSuccess) {
          AppFeedback.showSuccess(
            context,
            message:
                'Expense claim of \$${state.claim.totalAmount.toStringAsFixed(2)} submitted successfully!',
          );
          Navigator.of(context).pop(true);
        } else if (state is ExpenseReimbursementSubmitFailure) {
          AppFeedback.showError(
            context,
            title: 'Expense Claim Submission Failed',
            message: state.error,
          );
        }
      },
      child: Scaffold(
        backgroundColor: isDark ? AppColors.darkBg : AppColors.lightBg,
        appBar: AppBar(
          title: const Text('Submit Expense Claim'),
          elevation: 0,
        ),
        body: _loadingCategories
            ? const Center(child: CircularProgressIndicator())
            : Form(
                key: _formKey,
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    _buildInfoBanner(isDark),
                    const SizedBox(height: 16),
                    _buildGeneralInfoCard(isDark),
                    const SizedBox(height: 16),
                    _buildExpenseItemsSection(isDark),
                    const SizedBox(height: 16),
                    AttachmentPickerWidget(
                      title: 'Receipts & Attachments',
                      storageFolder: 'expense_reimbursements',
                      onAttachmentsChanged: (urls) {
                        setState(() {
                          _attachmentUrls = urls;
                        });
                      },
                    ),
                    const SizedBox(height: 16),
                    _buildTotalCard(isDark),
                    const SizedBox(height: 24),
                    _buildSubmitButton(),
                    const SizedBox(height: 32),
                  ],
                ),
              ),
      ),
    );
  }

  Widget _buildInfoBanner(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _brandColor.withValues(alpha: isDark ? 0.15 : 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: _brandColor.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.info_outline_rounded, color: _brandColor, size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'Submit receipts and operational expenses incurred during your shifts for office reimbursement review.',
              style: TextStyle(
                fontSize: 13,
                color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildGeneralInfoCard(bool isDark) {
    final dateDisplay = DateFormat('EEEE, MMM d, yyyy').format(_claimDate);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : AppColors.lightCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Claim Information',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: InkWell(
                  onTap: _pickDate,
                  borderRadius: BorderRadius.circular(8),
                  child: InputDecorator(
                    decoration: InputDecoration(
                      labelText: 'Claim Date',
                      prefixIcon: const Icon(Icons.calendar_today_outlined, size: 20),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    ),
                    child: Text(
                      dateDisplay,
                      style: const TextStyle(fontSize: 14),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _routeController,
            decoration: InputDecoration(
              labelText: 'Route # (Optional)',
              hintText: 'e.g. 1021 or Field Trip',
              prefixIcon: const Icon(Icons.alt_route_rounded, size: 20),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildExpenseItemsSection(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(
                'Expense Items (${_lines.length})',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
                ),
              ),
            ),
            const SizedBox(width: 8),
            TextButton.icon(
              onPressed: _addLine,
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Add Item'),
              style: TextButton.styleFrom(
                foregroundColor: _brandColor,
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                visualDensity: VisualDensity.compact,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ..._lines.asMap().entries.map((entry) {
          final idx = entry.key;
          final line = entry.value;
          return _buildLineItemCard(idx, line, isDark);
        }),
      ],
    );
  }

  Widget _buildLineItemCard(int index, _LineFormEntry line, bool isDark) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : AppColors.lightCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: _brandColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  'Item #${index + 1}',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: _brandColor,
                  ),
                ),
              ),
              if (_lines.length > 1)
                IconButton(
                  onPressed: () => _removeLine(index),
                  icon: const Icon(Icons.delete_outline, color: AppColors.error, size: 20),
                  tooltip: 'Remove Item',
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
            ],
          ),
          const SizedBox(height: 12),
          // Category Dropdown
          DropdownButtonFormField<String>(
            key: ValueKey('cat_${line.id}'),
            initialValue: line.categoryCode,
            isExpanded: true,
            decoration: InputDecoration(
              labelText: 'Category',
              prefixIcon: const Icon(Icons.category_outlined, size: 20),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            ),
            items: _categories.map((c) {
              return DropdownMenuItem<String>(
                value: c.code,
                child: Row(
                  children: [
                    Icon(c.icon, size: 18, color: _brandColor),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        c.displayName,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
            onChanged: (val) {
              if (val != null) {
                final cat = _categories.firstWhere((c) => c.code == val);
                setState(() {
                  line.categoryCode = cat.code;
                  line.categoryDisplayName = cat.displayName;
                });
              }
            },
          ),
          const SizedBox(height: 12),
          // Amount
          TextFormField(
            controller: line.amountController,
            keyboardType: const TextInputFormattersKeyboardType(
              keyboardType: TextInputType.numberWithOptions(decimal: true),
            ),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
            ],
            decoration: InputDecoration(
              labelText: 'Amount (\$)',
              hintText: '0.00',
              prefixIcon: const Icon(Icons.attach_money, size: 20),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            ),
            validator: (v) {
              if (v == null || v.trim().isEmpty) {
                return 'Amount is required';
              }
              final amt = double.tryParse(v.trim());
              if (amt == null || amt <= 0) {
                return 'Enter a valid amount > \$0';
              }
              return null;
            },
          ),
          const SizedBox(height: 12),
          // Note
          TextFormField(
            controller: line.noteController,
            decoration: InputDecoration(
              labelText: 'Receipt / Description',
              hintText: 'e.g. Shell Gas Receipt #9842, 45 Liters',
              prefixIcon: const Icon(Icons.receipt_outlined, size: 20),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTotalCard(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _brandColor.withValues(alpha: isDark ? 0.15 : 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: _brandColor.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Total Claim Amount',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${_lines.length} item${_lines.length == 1 ? '' : 's'}',
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Text(
            '\$${_totalAmount.toStringAsFixed(2)}',
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: _brandColor,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSubmitButton() {
    return BlocBuilder<ExpenseReimbursementBloc, ExpenseReimbursementState>(
      builder: (context, state) {
        final isSubmitting = state is ExpenseReimbursementSubmitting;

        return ElevatedButton(
          onPressed: isSubmitting ? null : _submit,
          style: ElevatedButton.styleFrom(
            backgroundColor: _brandColor,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 16),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            elevation: 2,
          ),
          child: isSubmitting
              ? const SizedBox(
                  height: 22,
                  width: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                  ),
                )
              : const Text(
                  'Submit Claim for Approval',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
        );
      },
    );
  }
}

class TextInputFormattersKeyboardType extends TextInputType {
  const TextInputFormattersKeyboardType({
    required TextInputType keyboardType,
  }) : super.numberWithOptions(
          signed: false,
          decimal: true,
        );
}
