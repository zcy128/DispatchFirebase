import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../services/storage_service.dart';
import '../theme.dart';

/// Representation of an attachment item in the picker.
class AttachmentEntry {
  final String id;
  final String fileName;
  final Uint8List? localBytes;
  String? downloadUrl;
  bool isUploading;
  String? error;

  AttachmentEntry({
    required this.id,
    required this.fileName,
    this.localBytes,
    this.downloadUrl,
    this.isUploading = false,
    this.error,
  });
}

/// A comprehensive attachment picker widget supporting camera capture,
/// photo gallery selection, and direct upload to Firebase Storage.
class AttachmentPickerWidget extends StatefulWidget {
  final List<String> initialUrls;
  final ValueChanged<List<String>>? onAttachmentsChanged;
  final String storageFolder;
  final bool readOnly;
  final int maxAttachments;
  final String title;

  const AttachmentPickerWidget({
    super.key,
    this.initialUrls = const [],
    this.onAttachmentsChanged,
    this.storageFolder = 'expense_reimbursements',
    this.readOnly = false,
    this.maxAttachments = 10,
    this.title = 'Receipts & Attachments',
  });

  @override
  State<AttachmentPickerWidget> createState() => _AttachmentPickerWidgetState();
}

class _AttachmentPickerWidgetState extends State<AttachmentPickerWidget> {
  final List<AttachmentEntry> _entries = [];
  final StorageService _storageService = StorageService.instance;
  static const Color _brandColor = Color(0xFF0D9488);

  @override
  void initState() {
    super.initState();
    for (int i = 0; i < widget.initialUrls.length; i++) {
      final url = widget.initialUrls[i];
      _entries.add(
        AttachmentEntry(
          id: 'initial_$i',
          fileName: 'Receipt #${i + 1}',
          downloadUrl: url,
        ),
      );
    }
  }

  void _notifyParent() {
    final validUrls = _entries
        .where((e) => e.downloadUrl != null && e.downloadUrl!.isNotEmpty)
        .map((e) => e.downloadUrl!)
        .toList();
    widget.onAttachmentsChanged?.call(validUrls);
  }

  void _showSourceSelectionSheet() {
    if (widget.readOnly) return;
    if (_entries.length >= widget.maxAttachments) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Maximum limit of ${widget.maxAttachments} attachments reached.'),
        ),
      );
      return;
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      backgroundColor: isDark ? AppColors.darkCard : AppColors.lightCard,
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(left: 8, bottom: 16),
                  child: Text(
                    'Add Photo / Attachment',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
                    ),
                  ),
                ),
                ListTile(
                  leading: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: _brandColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.camera_alt_rounded, color: _brandColor, size: 24),
                  ),
                  title: const Text(
                    'Take Photo',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                  ),
                  subtitle: const Text('Capture using device camera'),
                  onTap: () {
                    Navigator.of(ctx).pop();
                    _pickAndUpload(ImageSource.camera);
                  },
                ),
                const SizedBox(height: 8),
                ListTile(
                  leading: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: _brandColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.photo_library_rounded, color: _brandColor, size: 24),
                  ),
                  title: const Text(
                    'Choose from Device / Gallery',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                  ),
                  subtitle: const Text('Select photos from your device'),
                  onTap: () {
                    Navigator.of(ctx).pop();
                    _pickAndUpload(ImageSource.gallery);
                  },
                ),
                const SizedBox(height: 8),
                ListTile(
                  leading: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.amber.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.image_search_rounded, color: Colors.amber, size: 24),
                  ),
                  title: const Text(
                    'Attach Sample Photo (Demo)',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                  ),
                  subtitle: const Text('Quick sample photo for instant testing'),
                  onTap: () {
                    Navigator.of(ctx).pop();
                    _attachSampleReceipt();
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _pickAndUpload(ImageSource source) async {
    try {
      XFile? xFile;
      try {
        xFile = await _storageService.pickImage(source: source);
      } catch (pickErr) {
        if (source == ImageSource.camera) {
          xFile = await _storageService.pickImage(source: ImageSource.gallery);
        } else {
          rethrow;
        }
      }
      if (xFile == null) return;

      final bytes = await xFile.readAsBytes();
      final entryId = 'att_${DateTime.now().millisecondsSinceEpoch}';
      final entry = AttachmentEntry(
        id: entryId,
        fileName: xFile.name,
        localBytes: bytes,
        isUploading: true,
      );

      setState(() {
        _entries.add(entry);
      });

      try {
        final downloadUrl = await _storageService.uploadXFile(
          file: xFile,
          folder: widget.storageFolder,
        );

        if (!mounted) return;
        setState(() {
          entry.downloadUrl = downloadUrl;
          entry.isUploading = false;
        });
        _notifyParent();
      } catch (uploadErr) {
        if (!mounted) return;
        setState(() {
          entry.isUploading = false;
          entry.error = uploadErr.toString();
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppColors.error,
            content: Text('Failed to upload photo: $uploadErr'),
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      if (e.toString().contains('MissingPluginException')) {
        _handleMissingPlugin();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppColors.error,
            content: Text('Could not access image: $e'),
          ),
        );
      }
    }
  }

  void _handleMissingPlugin() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Full App Rebuild Required'),
        content: const Text(
          'The camera/gallery plugin was newly added to the project.\n\n'
          'Flutter requires a full app restart (stop the running app and re-run "flutter run") '
          'to compile native platform channels into the binary. Hot Reload / Hot Restart cannot link new native plugins.\n\n'
          'Would you like to attach a sample receipt photo to test the submission flow in the meantime?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: _brandColor,
              foregroundColor: Colors.white,
            ),
            onPressed: () {
              Navigator.of(ctx).pop();
              _attachSampleReceipt();
            },
            child: const Text('Attach Sample Receipt'),
          ),
        ],
      ),
    );
  }

  void _attachSampleReceipt() {
    final sampleBytes = Uint8List.fromList(<int>[
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
      0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
    ]);

    final entryId = 'sample_${DateTime.now().millisecondsSinceEpoch}';
    final entry = AttachmentEntry(
      id: entryId,
      fileName: 'sample_receipt.png',
      localBytes: sampleBytes,
      downloadUrl:
          'https://images.unsplash.com/photo-1554415707-9e4c194e8d89?w=600&auto=format&fit=crop&q=80',
    );

    setState(() {
      _entries.add(entry);
    });
    _notifyParent();
  }

  void _removeEntry(int index) {
    if (widget.readOnly) return;
    setState(() {
      _entries.removeAt(index);
    });
    _notifyParent();
  }

  void _previewImage(AttachmentEntry entry) {
    showDialog(
      context: context,
      builder: (ctx) {
        return Dialog(
          backgroundColor: Colors.black,
          insetPadding: const EdgeInsets.all(12),
          child: Stack(
            alignment: Alignment.center,
            children: [
              InteractiveViewer(
                minScale: 0.5,
                maxScale: 4.0,
                child: entry.localBytes != null
                    ? Image.memory(
                        entry.localBytes!,
                        fit: BoxFit.contain,
                      )
                    : (entry.downloadUrl != null
                        ? (entry.downloadUrl!.startsWith('data:')
                            ? Image.memory(
                                UriData.parse(entry.downloadUrl!).contentAsBytes(),
                                fit: BoxFit.contain,
                              )
                            : Image.network(
                                entry.downloadUrl!,
                                fit: BoxFit.contain,
                                loadingBuilder: (c, child, progress) {
                                  if (progress == null) return child;
                                  return const Center(
                                    child: CircularProgressIndicator(color: Colors.white),
                                  );
                                },
                                errorBuilder: (c, o, s) => const Center(
                                  child: Icon(Icons.broken_image, color: Colors.white70, size: 48),
                                ),
                              ))
                        : const SizedBox.shrink()),
              ),
              Positioned(
                top: 8,
                right: 8,
                child: IconButton(
                  icon: const Icon(Icons.close, color: Colors.white, size: 28),
                  onPressed: () => Navigator.of(ctx).pop(),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

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
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Row(
                  children: [
                    const Icon(Icons.attach_file_rounded, color: _brandColor, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        '${widget.title} (${_entries.length})',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              if (!widget.readOnly && _entries.length < widget.maxAttachments)
                TextButton.icon(
                  onPressed: _showSourceSelectionSheet,
                  icon: const Icon(Icons.add_a_photo_outlined, size: 18),
                  label: const Text('Add Photo'),
                  style: TextButton.styleFrom(
                    foregroundColor: _brandColor,
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    visualDensity: VisualDensity.compact,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (_entries.isEmpty)
            InkWell(
              onTap: widget.readOnly ? null : _showSourceSelectionSheet,
              borderRadius: BorderRadius.circular(10),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
                decoration: BoxDecoration(
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.04)
                      : Colors.black.withValues(alpha: 0.02),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: isDark
                        ? Colors.white.withValues(alpha: 0.12)
                        : Colors.black.withValues(alpha: 0.08),
                    style: BorderStyle.solid,
                  ),
                ),
                child: Column(
                  children: [
                    Icon(
                      Icons.cloud_upload_outlined,
                      size: 38,
                      color: _brandColor.withValues(alpha: 0.7),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      widget.readOnly
                          ? 'No receipts or documents attached'
                          : 'Tap to take photo or upload receipt images',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                      ),
                    ),
                    if (!widget.readOnly) ...[
                      const SizedBox(height: 4),
                      Text(
                        'Supports Camera capture and Photo Gallery',
                        style: TextStyle(
                          fontSize: 11,
                          color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            )
          else
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                ..._entries.asMap().entries.map((item) {
                  final idx = item.key;
                  final entry = item.value;
                  return _buildThumbnailCard(idx, entry, isDark);
                }),
                if (!widget.readOnly && _entries.length < widget.maxAttachments)
                  _buildAddButton(isDark),
              ],
            ),
        ],
      ),
    );
  }

  Widget _buildAddButton(bool isDark) {
    return InkWell(
      onTap: _showSourceSelectionSheet,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        width: 86,
        height: 86,
        decoration: BoxDecoration(
          color: _brandColor.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: _brandColor.withValues(alpha: 0.3)),
        ),
        child: const Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.add, color: _brandColor, size: 28),
            SizedBox(height: 4),
            Text(
              'Add',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: _brandColor,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildThumbnailCard(int index, AttachmentEntry entry, bool isDark) {
    Widget imageWidget;
    if (entry.localBytes != null) {
      imageWidget = Image.memory(
        entry.localBytes!,
        width: 86,
        height: 86,
        fit: BoxFit.cover,
      );
    } else if (entry.downloadUrl != null && entry.downloadUrl!.isNotEmpty) {
      if (entry.downloadUrl!.startsWith('data:')) {
        try {
          final uriData = UriData.parse(entry.downloadUrl!);
          imageWidget = Image.memory(
            uriData.contentAsBytes(),
            width: 86,
            height: 86,
            fit: BoxFit.cover,
          );
        } catch (_) {
          imageWidget = Container(
            width: 86,
            height: 86,
            color: isDark ? Colors.grey[800] : Colors.grey[200],
            child: const Icon(Icons.receipt_long_outlined, size: 28),
          );
        }
      } else {
        imageWidget = Image.network(
          entry.downloadUrl!,
          width: 86,
          height: 86,
          fit: BoxFit.cover,
          loadingBuilder: (c, child, progress) {
            if (progress == null) return child;
            return const Center(
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2, color: _brandColor),
              ),
            );
          },
          errorBuilder: (c, o, s) => const Center(
            child: Icon(Icons.broken_image, size: 24, color: AppColors.error),
          ),
        );
      }
    } else {
      imageWidget = Container(
        width: 86,
        height: 86,
        color: isDark ? Colors.grey[800] : Colors.grey[200],
        child: const Icon(Icons.receipt_long_outlined, size: 28),
      );
    }

    return Stack(
      children: [
        GestureDetector(
          onTap: () => _previewImage(entry),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: Container(
              width: 86,
              height: 86,
              decoration: BoxDecoration(
                border: Border.all(
                  color: entry.error != null
                      ? AppColors.error
                      : (isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder),
                ),
                borderRadius: BorderRadius.circular(10),
              ),
              child: imageWidget,
            ),
          ),
        ),
        if (entry.isUploading)
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                color: Colors.black54,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Center(
                child: SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                  ),
                ),
              ),
            ),
          ),
        if (entry.error != null)
          Positioned(
            bottom: 4,
            left: 4,
            right: 4,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.85),
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Text(
                'Error',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
              ),
            ),
          ),
        if (!widget.readOnly)
          Positioned(
            top: 2,
            right: 2,
            child: GestureDetector(
              onTap: () => _removeEntry(index),
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: const BoxDecoration(
                  color: Color(0xB3000000),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.close, color: Colors.white, size: 14),
              ),
            ),
          ),
      ],
    );
  }
}
