import 'package:flutter/material.dart';
import '../../../core/theme.dart';
import '../models/chat_model.dart';
import '../repository/chat_repository.dart';
import 'chat_thread_page.dart';

class NewChatContactPage extends StatefulWidget {
  final String driverId;
  final String driverName;
  final ChatRepository repository;

  const NewChatContactPage({
    super.key,
    required this.driverId,
    required this.driverName,
    required this.repository,
  });

  @override
  State<NewChatContactPage> createState() => _NewChatContactPageState();
}

class _NewChatContactPageState extends State<NewChatContactPage> {
  final TextEditingController _searchController = TextEditingController();
  List<ChatContact> _allContacts = [];
  List<ChatContact> _filteredContacts = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadContacts();
    _searchController.addListener(_onSearchChanged);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged() {
    final query = _searchController.text.trim().toLowerCase();
    setState(() {
      if (query.isEmpty) {
        _filteredContacts = _allContacts;
      } else {
        _filteredContacts = _allContacts.where((c) {
          return c.displayName.toLowerCase().contains(query) ||
              c.fullName.toLowerCase().contains(query) ||
              c.jobPosition.toLowerCase().contains(query) ||
              c.empNumber.toLowerCase().contains(query);
        }).toList();
      }
    });
  }

  Future<void> _loadContacts() async {
    try {
      final contacts = await widget.repository.fetchContacts(widget.driverId);
      if (mounted) {
        setState(() {
          _allContacts = contacts;
          _filteredContacts = contacts;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _startChat(ChatContact contact) async {
    try {
      final channel = await widget.repository.createOrGetDirectChannel(
        driverId: widget.driverId,
        targetUserId: contact.id,
      );

      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (_) => ChatThreadPage(
              channel: channel,
              driverId: widget.driverId,
              driverName: widget.driverName,
              repository: widget.repository,
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to start chat: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        elevation: 0.5,
        backgroundColor: isDark ? AppColors.darkCard : Colors.white,
        title: const Text(
          'Start Direct Message',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
      ),
      body: Column(
        children: [
          // Search box
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            color: isDark ? AppColors.darkCard : Colors.white,
            child: TextField(
              controller: _searchController,
              style: TextStyle(
                fontSize: 14,
                color: isDark ? Colors.white : Colors.black87,
              ),
              decoration: InputDecoration(
                hintText: 'Search by name, route, title or emp #...',
                hintStyle: TextStyle(
                  fontSize: 13,
                  color: isDark ? Colors.grey.shade500 : Colors.grey.shade400,
                ),
                prefixIcon: const Icon(Icons.search_rounded, size: 20),
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                filled: true,
                fillColor: isDark ? Colors.black26 : Colors.grey.shade100,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),

          // Contacts list
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                : _filteredContacts.isEmpty
                    ? Center(
                        child: Text(
                          _searchController.text.isEmpty
                              ? 'No available contacts found.'
                              : 'No contacts found matching search.',
                          style: TextStyle(
                            fontSize: 13,
                            color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                          ),
                        ),
                      )
                    : ListView.separated(
                        itemCount: _filteredContacts.length,
                        separatorBuilder: (context, index) => Divider(
                          height: 1,
                          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
                        ),
                        itemBuilder: (context, index) {
                          final contact = _filteredContacts[index];
                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor: AppColors.primary.withValues(alpha: 0.2),
                              child: Text(
                                contact.displayName.isNotEmpty
                                    ? contact.displayName[0].toUpperCase()
                                    : 'U',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.primary,
                                ),
                              ),
                            ),
                            title: Text(
                              contact.displayName,
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            subtitle: Text(
                              '${contact.fullName} • ${contact.jobPosition}${contact.empNumber.isNotEmpty ? ' • #${contact.empNumber}' : ''}',
                              style: TextStyle(
                                fontSize: 11,
                                color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                              ),
                            ),
                            trailing: const Icon(
                              Icons.arrow_forward_ios_rounded,
                              size: 14,
                              color: Colors.grey,
                            ),
                            onTap: () => _startChat(contact),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
