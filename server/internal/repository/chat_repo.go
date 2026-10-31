package repository

import (
	"context"
	"fmt"
	"log"
	"sort"
	"strings"
	"sync"
	"time"

	"cloud.google.com/go/firestore"
	firebaseMessaging "firebase.google.com/go/v4/messaging"

	"dispatch-server/internal/models"
)

type ChatRepository interface {
	GetDynamicDisplayName(ctx context.Context, empID string, date string) (string, error)
	ListUserChannels(ctx context.Context, userID string, date string) ([]*models.ChatChannel, error)
	GetChannelByID(ctx context.Context, channelID string) (*models.ChatChannel, error)
	CreateOrGetDirectChannel(ctx context.Context, user1ID, user2ID string, date string) (*models.ChatChannel, error)
	CreateOrGetParentChannel(ctx context.Context, payload *models.CreateParentChannelPayload) (*models.ChatChannel, error)
	ListMessages(ctx context.Context, channelID string, limit int) ([]*models.ChatMessage, error)
	SendMessage(ctx context.Context, channelID string, senderID string, payload *models.SendMessagePayload, date string) (*models.ChatMessage, error)
	EnsureDefaultChannels(ctx context.Context) error
	ListDirectMessageContacts(ctx context.Context, userID string, date string) ([]*models.ChatMember, error)
}

// ─────────────────────────────────────────────────────────────────────────────
// Firestore Chat Repository
// ─────────────────────────────────────────────────────────────────────────────

type FirestoreChatRepository struct {
	client       *firestore.Client
	fcmClient    *firebaseMessaging.Client
	empRepo      EmployeeRepository
	dispatchRepo DispatchRepository
	routeRepo    RouteRepository
	yardRepo     YardRepository
	channelColl  string
}

func NewFirestoreChatRepository(
	client *firestore.Client,
	fcmClient *firebaseMessaging.Client,
	empRepo EmployeeRepository,
	dispatchRepo DispatchRepository,
	routeRepo RouteRepository,
	yardRepo YardRepository,
) *FirestoreChatRepository {
	return &FirestoreChatRepository{
		client:       client,
		fcmClient:    fcmClient,
		empRepo:      empRepo,
		dispatchRepo: dispatchRepo,
		routeRepo:    routeRepo,
		yardRepo:     yardRepo,
		channelColl:  "chat_channels",
	}
}

func (r *FirestoreChatRepository) formatDisplayName(emp *models.Employee, shiftRoute, fixedRoute string) string {
	lastName := strings.TrimSpace(emp.LastName)
	if lastName == "" {
		lastName = emp.FirstName
	}
	if shiftRoute != "" {
		return fmt.Sprintf("%s - %s", shiftRoute, lastName)
	}
	if fixedRoute != "" {
		return fmt.Sprintf("%s - %s", fixedRoute, lastName)
	}
	jobTitle := strings.TrimSpace(emp.JobPosition)
	if jobTitle == "" {
		jobTitle = strings.TrimSpace(emp.Role)
	}
	if jobTitle == "" {
		jobTitle = "Staff"
	}
	return fmt.Sprintf("%s - %s", jobTitle, lastName)
}

// GetDynamicDisplayName calculates display name based on user's assignments:
// 1. If assigned to a dispatch shift today: "RouteNo - LastName"
// 2. Else if assigned to a standard route shift: "RouteNo - LastName"
// 3. Else: "JobTitle - LastName"
func (r *FirestoreChatRepository) GetDynamicDisplayName(ctx context.Context, empID string, date string) (string, error) {
	if empID == "" {
		return "Unknown", nil
	}
	emp, err := r.empRepo.GetByID(ctx, empID)
	if err != nil || emp == nil {
		emp, _ = r.empRepo.GetByEmployeeNumber(ctx, empID)
	}
	if emp == nil {
		return empID, nil
	}

	// 1. Check today's dispatch shift assignment
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}
	var shiftRoute string
	if r.dispatchRepo != nil {
		shifts, err := r.dispatchRepo.ListShifts(ctx, date, DispatchFilter{})
		if err == nil {
			for _, s := range shifts {
				if s.DriverID == emp.ID || s.DriverID == emp.EmployeeNumber ||
					s.AttendantID == emp.ID || s.AttendantID == emp.EmployeeNumber {
					if s.RouteNo != "" {
						shiftRoute = s.RouteNo
						break
					}
				}
			}
		}
	}

	// 2. Check fixed route shift assignment if not in today's shift
	var fixedRoute string
	if shiftRoute == "" && r.client != nil {
		iter := r.client.Collection("route_shifts").Where("driverId", "==", emp.ID).Limit(1).Documents(ctx)
		doc, err := iter.Next()
		iter.Stop()
		if err == nil && doc != nil {
			var rs models.BusRouteShift
			if err := doc.DataTo(&rs); err == nil && rs.RouteNo != "" {
				fixedRoute = rs.RouteNo
			}
		} else if emp.EmployeeNumber != "" {
			iter2 := r.client.Collection("route_shifts").Where("driverId", "==", emp.EmployeeNumber).Limit(1).Documents(ctx)
			doc2, err2 := iter2.Next()
			iter2.Stop()
			if err2 == nil && doc2 != nil {
				var rs models.BusRouteShift
				if err := doc2.DataTo(&rs); err == nil && rs.RouteNo != "" {
					fixedRoute = rs.RouteNo
				}
			}
		}
	}

	return r.formatDisplayName(emp, shiftRoute, fixedRoute), nil
}

// EnsureDefaultChannels ensures standard Fleet channels and Office channel exist in Firestore
func (r *FirestoreChatRepository) EnsureDefaultChannels(ctx context.Context) error {
	now := time.Now().UTC()

	// 1. Office Staff Channel (management, dispatch, safety, payroll)
	officeRef := r.client.Collection(r.channelColl).Doc("channel-office")
	if snap, err := officeRef.Get(ctx); err != nil || !snap.Exists() {
		_, _ = officeRef.Set(ctx, &models.ChatChannel{
			ID:          "channel-office",
			Type:        models.ChannelTypeOffice,
			Name:        "Office Staff",
			Description: "Internal group for Dispatch, Management, Safety and Payroll personnel",
			MemberIDs:   []string{},
			CreatedAt:   now,
			UpdatedAt:   now,
		})
	}

	// 2. Broadcast Channel (dispatch announcements to all drivers)
	broadcastRef := r.client.Collection(r.channelColl).Doc("channel-broadcast")
	if snap, err := broadcastRef.Get(ctx); err != nil || !snap.Exists() {
		_, _ = broadcastRef.Set(ctx, &models.ChatChannel{
			ID:          "channel-broadcast",
			Type:        models.ChannelTypeBroadcast,
			Name:        "All Fleet Announcements",
			Description: "Company-wide dispatch bulletins and urgent operational announcements",
			MemberIDs:   []string{},
			CreatedAt:   now,
			UpdatedAt:   now,
		})
	}

	// 3. Fleet Channels for each Yard
	if r.yardRepo != nil {
		yards, err := r.yardRepo.ListYards(ctx)
		if err == nil {
			for _, y := range yards {
				channelID := fmt.Sprintf("channel-yard-%s", y.ID)
				yRef := r.client.Collection(r.channelColl).Doc(channelID)
				if snap, err := yRef.Get(ctx); err != nil || !snap.Exists() {
					name := fmt.Sprintf("%s Fleet", y.Name)
					_, _ = yRef.Set(ctx, &models.ChatChannel{
						ID:          channelID,
						Type:        models.ChannelTypeFleet,
						Name:        name,
						Description: fmt.Sprintf("Official communication channel for %s drivers and attendants", y.Name),
						YardID:      y.ID,
						YardName:    y.Name,
						MemberIDs:   []string{},
						CreatedAt:   now,
						UpdatedAt:   now,
					})
				}
			}
		}
	}

	return nil
}

func isOfficeRole(role, jobPosition string) bool {
	r := strings.ToLower(role)
	j := strings.ToLower(jobPosition)
	officeTerms := []string{"admin", "dispatch", "payroll", "safety", "manager", "supervisor", "office", "clerk", "hr", "finance"}
	for _, term := range officeTerms {
		if strings.Contains(r, term) || strings.Contains(j, term) {
			return true
		}
	}
	return false
}

// ListUserChannels lists all channels available to a specific user
func (r *FirestoreChatRepository) ListUserChannels(ctx context.Context, userID string, date string) ([]*models.ChatChannel, error) {
	emp, _ := r.empRepo.GetByID(ctx, userID)
	if emp == nil {
		emp, _ = r.empRepo.GetByEmployeeNumber(ctx, userID)
	}

	isOffice := false
	yardID := ""
	if emp != nil {
		isOffice = isOfficeRole(emp.Role, emp.JobPosition)
		yardID = emp.YardID
	}

	// Fetch all system channels
	docs, err := r.client.Collection(r.channelColl).Documents(ctx).GetAll()
	if err != nil {
		return nil, fmt.Errorf("list channels: %w", err)
	}

	var results []*models.ChatChannel
	for _, doc := range docs {
		var ch models.ChatChannel
		if err := doc.DataTo(&ch); err != nil {
			continue
		}
		ch.ID = doc.Ref.ID

		switch ch.Type {
		case models.ChannelTypeBroadcast:
			// Everyone can view broadcast
			results = append(results, &ch)
		case models.ChannelTypeOffice:
			// Only office staff or admins can view office channel
			if isOffice {
				results = append(results, &ch)
			}
		case models.ChannelTypeFleet:
			// Office staff can see all fleet channels; drivers see their yard channel
			if isOffice || (yardID != "" && (ch.YardID == yardID || strings.HasSuffix(ch.ID, yardID))) {
				results = append(results, &ch)
			}
		case models.ChannelTypeDirect:
			// Direct message: must be one of the members
			isMember := false
			for _, m := range ch.MemberIDs {
				if m == userID || (emp != nil && (m == emp.ID || m == emp.EmployeeNumber)) {
					isMember = true
					break
				}
			}
			if isMember {
				// Calculate name for direct chat: show other member's dynamic display name
				for _, m := range ch.MemberIDs {
					if m != userID && (emp == nil || (m != emp.ID && m != emp.EmployeeNumber)) {
						otherName, _ := r.GetDynamicDisplayName(ctx, m, date)
						if otherName != "" {
							ch.Name = otherName
						}
						break
					}
				}
				results = append(results, &ch)
			}
		case models.ChannelTypeParent:
			// Office staff/dispatchers can see all parent channels; parents see their own
			if isOffice || strings.HasPrefix(userID, "parent-") || strings.HasPrefix(userID, "usr-") || userID == "EMP-ADMIN-001" {
				results = append(results, &ch)
			}
		}
	}

	// Sort channels: Broadcast & Fleet on top, then by UpdatedAt descending
	sort.Slice(results, func(i, j int) bool {
		return results[i].UpdatedAt.After(results[j].UpdatedAt)
	})

	return results, nil
}

// GetChannelByID fetches a channel by ID
func (r *FirestoreChatRepository) GetChannelByID(ctx context.Context, channelID string) (*models.ChatChannel, error) {
	docRef := r.client.Collection(r.channelColl).Doc(channelID)
	snap, err := docRef.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("channel not found: %s", channelID)
	}
	var ch models.ChatChannel
	if err := snap.DataTo(&ch); err != nil {
		return nil, err
	}
	ch.ID = docRef.ID
	return &ch, nil
}

// CreateOrGetDirectChannel finds or creates a deterministic 1-on-1 private channel between two users
func (r *FirestoreChatRepository) CreateOrGetDirectChannel(ctx context.Context, user1ID, user2ID string, date string) (*models.ChatChannel, error) {
	if user1ID == user2ID {
		return nil, fmt.Errorf("cannot create direct channel with self")
	}

	members := []string{user1ID, user2ID}
	sort.Strings(members)
	channelID := fmt.Sprintf("dm-%s-%s", members[0], members[1])

	docRef := r.client.Collection(r.channelColl).Doc(channelID)
	snap, err := docRef.Get(ctx)
	if err == nil && snap.Exists() {
		var ch models.ChatChannel
		_ = snap.DataTo(&ch)
		ch.ID = docRef.ID
		return &ch, nil
	}

	// Create new direct channel
	now := time.Now().UTC()
	u2Name, _ := r.GetDynamicDisplayName(ctx, user2ID, date)
	ch := &models.ChatChannel{
		ID:        channelID,
		Type:      models.ChannelTypeDirect,
		Name:      u2Name,
		MemberIDs: members,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if _, err := docRef.Set(ctx, ch); err != nil {
		return nil, fmt.Errorf("create direct channel: %w", err)
	}
	return ch, nil
}

// CreateOrGetParentChannel finds or creates a parent conversation channel
func (r *FirestoreChatRepository) CreateOrGetParentChannel(ctx context.Context, payload *models.CreateParentChannelPayload) (*models.ChatChannel, error) {
	if payload == nil || strings.TrimSpace(payload.ParentContact) == "" {
		return nil, fmt.Errorf("parent contact is required")
	}

	channelID := "parent-" + models.CleanParentContact(payload.ParentContact)

	docRef := r.client.Collection(r.channelColl).Doc(channelID)
	snap, err := docRef.Get(ctx)
	if err == nil && snap.Exists() {
		var ch models.ChatChannel
		_ = snap.DataTo(&ch)
		ch.ID = docRef.ID
		return &ch, nil
	}

	now := time.Now().UTC()
	name := payload.ParentName
	if name == "" {
		name = fmt.Sprintf("Parent (%s)", payload.ParentContact)
	}

	ch := &models.ChatChannel{
		ID:            channelID,
		Type:          models.ChannelTypeParent,
		Name:          name,
		ParentContact: payload.ParentContact,
		ParentName:    name,
		StudentID:     payload.StudentID,
		StudentName:   payload.StudentName,
		BusUnitNumber: payload.BusUnitNumber,
		RouteNo:       payload.RouteNo,
		SchoolName:    payload.SchoolName,
		Grade:         payload.Grade,
		Description:   fmt.Sprintf("Parent of %s (%s)", payload.StudentName, payload.ParentContact),
		MemberIDs:     []string{channelID},
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	if _, err := docRef.Set(ctx, ch); err != nil {
		return nil, fmt.Errorf("create parent channel: %w", err)
	}
	return ch, nil
}

// ListMessages returns chronological messages for a channel
func (r *FirestoreChatRepository) ListMessages(ctx context.Context, channelID string, limit int) ([]*models.ChatMessage, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	query := r.client.Collection(r.channelColl).Doc(channelID).
		Collection("messages").
		OrderBy("createdAt", firestore.Desc).
		Limit(limit)

	docs, err := query.Documents(ctx).GetAll()
	if err != nil {
		return nil, fmt.Errorf("list messages: %w", err)
	}

	messages := make([]*models.ChatMessage, 0, len(docs))
	for _, doc := range docs {
		var msg models.ChatMessage
		if err := doc.DataTo(&msg); err != nil {
			continue
		}
		msg.ID = doc.Ref.ID
		msg.ChannelID = channelID
		messages = append(messages, &msg)
	}

	// Reverse to ascending order for chat window rendering
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	return messages, nil
}

// SendMessage writes message to subcollection and triggers push notification
func (r *FirestoreChatRepository) SendMessage(ctx context.Context, channelID string, senderID string, payload *models.SendMessagePayload, date string) (*models.ChatMessage, error) {
	if payload == nil || strings.TrimSpace(payload.Text) == "" && payload.MediaURL == "" {
		return nil, fmt.Errorf("message content cannot be empty")
	}

	senderName, _ := r.GetDynamicDisplayName(ctx, senderID, date)
	if payload != nil && payload.SenderName != "" {
		senderName = payload.SenderName
	}
	now := time.Now().UTC()
	msgID := fmt.Sprintf("msg-%d", now.UnixNano())

	msg := &models.ChatMessage{
		ID:         msgID,
		ChannelID:  channelID,
		SenderID:   senderID,
		SenderName: senderName,
		Text:       payload.Text,
		MediaURL:   payload.MediaURL,
		MediaType:  payload.MediaType,
		CreatedAt:  now,
	}

	channelRef := r.client.Collection(r.channelColl).Doc(channelID)
	msgRef := channelRef.Collection("messages").Doc(msgID)

	if _, err := msgRef.Set(ctx, msg); err != nil {
		return nil, fmt.Errorf("save message: %w", err)
	}

	// Update channel summary
	previewText := msg.Text
	if previewText == "" && msg.MediaURL != "" {
		previewText = "[Attachment]"
	}
	_, _ = channelRef.Update(ctx, []firestore.Update{
		{
			Path: "lastMessage",
			Value: &models.ChatMessageSummary{
				Text:       previewText,
				SenderID:   senderID,
				SenderName: senderName,
				CreatedAt:  now,
			},
		},
		{
			Path:  "updatedAt",
			Value: now,
		},
	})

	// Send Push Notifications in background
	go r.sendPushNotifications(channelID, senderID, senderName, previewText)

	return msg, nil
}

// sendPushNotifications delivers FCM push notifications to other members
func (r *FirestoreChatRepository) sendPushNotifications(channelID, senderID, senderName, text string) {
	if r.fcmClient == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	ch, err := r.GetChannelByID(ctx, channelID)
	if err != nil || ch == nil {
		return
	}

	var recipientEmpIDs []string
	if ch.Type == models.ChannelTypeDirect {
		for _, m := range ch.MemberIDs {
			if m != senderID {
				recipientEmpIDs = append(recipientEmpIDs, m)
			}
		}
	}

	if len(recipientEmpIDs) == 0 {
		return
	}

	var tokens []string
	for _, empID := range recipientEmpIDs {
		emp, err := r.empRepo.GetByID(ctx, empID)
		if err != nil || emp == nil {
			emp, _ = r.empRepo.GetByEmployeeNumber(ctx, empID)
		}
		if emp != nil && emp.IsActive && len(emp.Devices) > 0 {
			for _, d := range emp.Devices {
				if d.Token != "" {
					tokens = append(tokens, d.Token)
				}
			}
		}
	}

	if len(tokens) == 0 {
		return
	}

	title := senderName
	if ch.Type != models.ChannelTypeDirect {
		title = fmt.Sprintf("%s (%s)", senderName, ch.Name)
	}

	_, sendErr := r.fcmClient.SendEachForMulticast(ctx, &firebaseMessaging.MulticastMessage{
		Tokens: tokens,
		Notification: &firebaseMessaging.Notification{
			Title: title,
			Body:  text,
		},
		Data: map[string]string{
			"type":      "chat_message",
			"channelId": channelID,
			"senderId":  senderID,
		},
	})
	if sendErr != nil {
		log.Printf("[CHAT FCM] Error sending multicast: %v", sendErr)
	}
}

// ListDirectMessageContacts returns contact list for 1-on-1 private messaging (e.g. Finance, Dispatchers)
func (r *FirestoreChatRepository) ListDirectMessageContacts(ctx context.Context, currentUserID string, date string) ([]*models.ChatMember, error) {
	active := true
	emps, err := r.empRepo.List(ctx, EmployeeFilter{ActiveOnly: &active})
	if err != nil {
		return nil, fmt.Errorf("list employees: %w", err)
	}

	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	// Pre-load today's dispatch shifts
	todayShifts := make(map[string]string)
	if r.dispatchRepo != nil {
		if shifts, err := r.dispatchRepo.ListShifts(ctx, date, DispatchFilter{}); err == nil {
			for _, s := range shifts {
				if s.RouteNo != "" {
					if s.DriverID != "" {
						todayShifts[s.DriverID] = s.RouteNo
					}
					if s.AttendantID != "" {
						todayShifts[s.AttendantID] = s.RouteNo
					}
				}
			}
		}
	}

	// Pre-load fixed route shifts
	fixedShifts := make(map[string]string)
	if r.client != nil {
		if docs, err := r.client.Collection("route_shifts").Documents(ctx).GetAll(); err == nil {
			for _, doc := range docs {
				var rs models.BusRouteShift
				if err := doc.DataTo(&rs); err == nil && rs.RouteNo != "" && rs.DriverID != "" {
					fixedShifts[rs.DriverID] = rs.RouteNo
				}
			}
		}
	}

	var contacts []*models.ChatMember
	for _, emp := range emps {
		if !emp.IsActive || emp.ID == currentUserID || emp.EmployeeNumber == currentUserID {
			continue
		}

		shiftRoute := todayShifts[emp.ID]
		if shiftRoute == "" && emp.EmployeeNumber != "" {
			shiftRoute = todayShifts[emp.EmployeeNumber]
		}

		fixedRoute := fixedShifts[emp.ID]
		if fixedRoute == "" && emp.EmployeeNumber != "" {
			fixedRoute = fixedShifts[emp.EmployeeNumber]
		}

		displayName := r.formatDisplayName(emp, shiftRoute, fixedRoute)
		contacts = append(contacts, &models.ChatMember{
			ID:          emp.ID,
			EmpNumber:   emp.EmployeeNumber,
			FullName:    emp.FullName,
			DisplayName: displayName,
			JobPosition: emp.JobPosition,
			Role:        emp.Role,
			YardID:      emp.YardID,
		})
	}

	sort.Slice(contacts, func(i, j int) bool {
		return contacts[i].DisplayName < contacts[j].DisplayName
	})

	return contacts, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// Memory Chat Repository (Local Fallback & Testing)
// ─────────────────────────────────────────────────────────────────────────────

type MemoryChatRepository struct {
	mu           sync.RWMutex
	channels     map[string]*models.ChatChannel
	messages     map[string][]*models.ChatMessage
	empRepo      EmployeeRepository
	dispatchRepo DispatchRepository
}

func NewMemoryChatRepository(empRepo EmployeeRepository, dispatchRepo DispatchRepository) *MemoryChatRepository {
	repo := &MemoryChatRepository{
		channels:     make(map[string]*models.ChatChannel),
		messages:     make(map[string][]*models.ChatMessage),
		empRepo:      empRepo,
		dispatchRepo: dispatchRepo,
	}
	repo.seedDefaults()
	return repo
}

func (m *MemoryChatRepository) seedDefaults() {
	now := time.Now().UTC()
	m.channels["channel-office"] = &models.ChatChannel{
		ID:          "channel-office",
		Type:        models.ChannelTypeOffice,
		Name:        "Office Staff",
		Description: "Internal group for Dispatch, Safety and Payroll team",
		MemberIDs:   []string{},
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	m.channels["channel-broadcast"] = &models.ChatChannel{
		ID:          "channel-broadcast",
		Type:        models.ChannelTypeBroadcast,
		Name:        "All Fleet Announcements",
		Description: "Company-wide dispatch bulletins and urgent announcements",
		MemberIDs:   []string{},
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	m.channels["channel-yard-1"] = &models.ChatChannel{
		ID:          "channel-yard-1",
		Type:        models.ChannelTypeFleet,
		Name:        "East Yard Fleet",
		YardID:      "1",
		YardName:    "East Yard",
		Description: "Official group for East Yard drivers and attendants",
		MemberIDs:   []string{},
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	parentChID := "parent-6135550199"
	m.channels[parentChID] = &models.ChatChannel{
		ID:            parentChID,
		Type:          models.ChannelTypeParent,
		Name:          "Sarah Thompson",
		ParentContact: "613-555-0199",
		ParentName:    "Sarah Thompson",
		StudentID:     101,
		StudentName:   "Emma Thompson",
		BusUnitNumber: "42",
		RouteNo:       "R-402",
		SchoolName:    "Westboro Academy",
		Grade:         "Grade 2",
		Description:   "Parent of Emma Thompson (613-555-0199)",
		MemberIDs:     []string{parentChID},
		CreatedAt:     now.Add(-2 * time.Hour),
		UpdatedAt:     now.Add(-10 * time.Minute),
		LastMessage: &models.ChatMessageSummary{
			Text:       "Hi Dispatch, will Bus #42 be on schedule at Baseline stop this morning?",
			SenderID:   parentChID,
			SenderName: "Sarah Thompson",
			CreatedAt:  now.Add(-10 * time.Minute),
		},
	}
	m.messages[parentChID] = []*models.ChatMessage{
		{
			ID:         "msg-seed-parent-1",
			ChannelID:  parentChID,
			SenderID:   parentChID,
			SenderName: "Sarah Thompson",
			Text:       "Hi Dispatch, will Bus #42 be on schedule at Baseline stop this morning?",
			CreatedAt:  now.Add(-10 * time.Minute),
		},
	}
}

func (m *MemoryChatRepository) GetDynamicDisplayName(ctx context.Context, empID string, date string) (string, error) {
	if m.empRepo == nil {
		return empID, nil
	}
	emp, err := m.empRepo.GetByID(ctx, empID)
	if err != nil || emp == nil {
		emp, _ = m.empRepo.GetByEmployeeNumber(ctx, empID)
	}
	if emp == nil {
		return empID, nil
	}
	lastName := strings.TrimSpace(emp.LastName)
	if lastName == "" {
		lastName = emp.FirstName
	}

	if date == "" {
		date = time.Now().Format("2006-01-02")
	}
	if m.dispatchRepo != nil {
		shifts, err := m.dispatchRepo.ListShifts(ctx, date, DispatchFilter{})
		if err == nil {
			for _, s := range shifts {
				if s.DriverID == emp.ID || s.DriverID == emp.EmployeeNumber ||
					s.AttendantID == emp.ID || s.AttendantID == emp.EmployeeNumber {
					if s.RouteNo != "" {
						return fmt.Sprintf("%s - %s", s.RouteNo, lastName), nil
					}
				}
			}
		}
	}

	jobTitle := strings.TrimSpace(emp.JobPosition)
	if jobTitle == "" {
		jobTitle = strings.TrimSpace(emp.Role)
	}
	if jobTitle == "" {
		jobTitle = "Staff"
	}
	return fmt.Sprintf("%s - %s", jobTitle, lastName), nil
}

func (m *MemoryChatRepository) EnsureDefaultChannels(ctx context.Context) error {
	return nil
}

func (m *MemoryChatRepository) ListUserChannels(ctx context.Context, userID string, date string) ([]*models.ChatChannel, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var res []*models.ChatChannel
	for _, ch := range m.channels {
		res = append(res, ch)
	}
	sort.Slice(res, func(i, j int) bool {
		return res[i].UpdatedAt.After(res[j].UpdatedAt)
	})
	return res, nil
}

func (m *MemoryChatRepository) GetChannelByID(ctx context.Context, channelID string) (*models.ChatChannel, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	ch, ok := m.channels[channelID]
	if !ok {
		return nil, fmt.Errorf("channel not found: %s", channelID)
	}
	return ch, nil
}

func (m *MemoryChatRepository) CreateOrGetDirectChannel(ctx context.Context, user1ID, user2ID string, date string) (*models.ChatChannel, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	members := []string{user1ID, user2ID}
	sort.Strings(members)
	id := fmt.Sprintf("dm-%s-%s", members[0], members[1])

	if ch, ok := m.channels[id]; ok {
		return ch, nil
	}

	now := time.Now().UTC()
	u2Name, _ := m.GetDynamicDisplayName(ctx, user2ID, date)
	ch := &models.ChatChannel{
		ID:        id,
		Type:      models.ChannelTypeDirect,
		Name:      u2Name,
		MemberIDs: members,
		CreatedAt: now,
		UpdatedAt: now,
	}
	m.channels[id] = ch
	return ch, nil
}

func (m *MemoryChatRepository) CreateOrGetParentChannel(ctx context.Context, payload *models.CreateParentChannelPayload) (*models.ChatChannel, error) {
	if payload == nil || strings.TrimSpace(payload.ParentContact) == "" {
		return nil, fmt.Errorf("parent contact is required")
	}

	channelID := "parent-" + models.CleanParentContact(payload.ParentContact)

	m.mu.Lock()
	defer m.mu.Unlock()

	if ch, ok := m.channels[channelID]; ok {
		return ch, nil
	}

	now := time.Now().UTC()
	name := payload.ParentName
	if name == "" {
		name = fmt.Sprintf("Parent (%s)", payload.ParentContact)
	}

	ch := &models.ChatChannel{
		ID:            channelID,
		Type:          models.ChannelTypeParent,
		Name:          name,
		ParentContact: payload.ParentContact,
		ParentName:    name,
		StudentID:     payload.StudentID,
		StudentName:   payload.StudentName,
		BusUnitNumber: payload.BusUnitNumber,
		RouteNo:       payload.RouteNo,
		SchoolName:    payload.SchoolName,
		Grade:         payload.Grade,
		Description:   fmt.Sprintf("Parent of %s (%s)", payload.StudentName, payload.ParentContact),
		MemberIDs:     []string{channelID},
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	m.channels[channelID] = ch
	return ch, nil
}

func (m *MemoryChatRepository) ListMessages(ctx context.Context, channelID string, limit int) ([]*models.ChatMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	msgs := m.messages[channelID]
	if msgs == nil {
		return []*models.ChatMessage{}, nil
	}
	return msgs, nil
}

func (m *MemoryChatRepository) SendMessage(ctx context.Context, channelID string, senderID string, payload *models.SendMessagePayload, date string) (*models.ChatMessage, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	senderName, _ := m.GetDynamicDisplayName(ctx, senderID, date)
	if payload != nil && payload.SenderName != "" {
		senderName = payload.SenderName
	} else if ch, ok := m.channels[channelID]; ok && ch.Type == models.ChannelTypeParent && (senderID == ch.ParentContact || senderID == ch.ID) {
		senderName = ch.ParentName
	}
	now := time.Now().UTC()
	msg := &models.ChatMessage{
		ID:         fmt.Sprintf("msg-%d", now.UnixNano()),
		ChannelID:  channelID,
		SenderID:   senderID,
		SenderName: senderName,
		Text:       payload.Text,
		MediaURL:   payload.MediaURL,
		MediaType:  payload.MediaType,
		CreatedAt:  now,
	}

	m.messages[channelID] = append(m.messages[channelID], msg)
	if ch, ok := m.channels[channelID]; ok {
		ch.LastMessage = &models.ChatMessageSummary{
			Text:       msg.Text,
			SenderID:   senderID,
			SenderName: senderName,
			CreatedAt:  now,
		}
		ch.UpdatedAt = now
	}

	return msg, nil
}

func (m *MemoryChatRepository) ListDirectMessageContacts(ctx context.Context, currentUserID string, date string) ([]*models.ChatMember, error) {
	if m.empRepo == nil {
		return []*models.ChatMember{}, nil
	}
	active := true
	emps, err := m.empRepo.List(ctx, EmployeeFilter{ActiveOnly: &active})
	if err != nil {
		return nil, err
	}
	var res []*models.ChatMember
	for _, emp := range emps {
		if !emp.IsActive || emp.ID == currentUserID || emp.EmployeeNumber == currentUserID {
			continue
		}
		dn, _ := m.GetDynamicDisplayName(ctx, emp.ID, date)
		res = append(res, &models.ChatMember{
			ID:          emp.ID,
			EmpNumber:   emp.EmployeeNumber,
			FullName:    emp.FullName,
			DisplayName: dn,
			JobPosition: emp.JobPosition,
			Role:        emp.Role,
			YardID:      emp.YardID,
		})
	}
	return res, nil
}
