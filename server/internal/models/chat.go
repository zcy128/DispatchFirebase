package models

import (
	"strings"
	"time"
)

// ChannelType represents the scope and accessibility of a chat channel
type ChannelType string

const (
	ChannelTypeDirect    ChannelType = "direct"    // 1-on-1 private chat
	ChannelTypeFleet     ChannelType = "fleet"     // Crew grouped by yard/fleet
	ChannelTypeOffice    ChannelType = "office"    // Office staff group
	ChannelTypeBroadcast ChannelType = "broadcast" // Dispatch broadcast channel
	ChannelTypeParent    ChannelType = "parent"    // Student Parent communication channel
)

// ChatMember represents a user profile snapshot within a channel
type ChatMember struct {
	ID          string `json:"id" firestore:"id"`
	EmpNumber   string `json:"empNumber" firestore:"empNumber"`
	FullName    string `json:"fullName" firestore:"fullName"`
	DisplayName string `json:"displayName" firestore:"displayName"` // Dynamic: Route + LastName or Title + LastName
	JobPosition string `json:"jobPosition" firestore:"jobPosition"`
	Role        string `json:"role" firestore:"role"`
	YardID      string `json:"yardId,omitempty" firestore:"yardId,omitempty"`
	PhotoURL    string `json:"photoUrl,omitempty" firestore:"photoUrl,omitempty"`
}

// ChatMessageSummary stores preview info of the latest message in a channel
type ChatMessageSummary struct {
	Text       string    `json:"text" firestore:"text"`
	SenderID   string    `json:"senderId" firestore:"senderId"`
	SenderName string    `json:"senderName" firestore:"senderName"`
	CreatedAt  time.Time `json:"createdAt" firestore:"createdAt"`
}

// ChatChannel represents a conversation thread (Firestore collection: chat_channels)
type ChatChannel struct {
	ID            string              `json:"id" firestore:"id"`
	Type          ChannelType         `json:"type" firestore:"type"`
	Name          string              `json:"name" firestore:"name"`
	Description   string              `json:"description,omitempty" firestore:"description,omitempty"`
	YardID        string              `json:"yardId,omitempty" firestore:"yardId,omitempty"`
	YardName      string              `json:"yardName,omitempty" firestore:"yardName,omitempty"`
	MemberIDs     []string            `json:"memberIds" firestore:"memberIds"` // For direct messages or specific members
	ParentContact string              `json:"parentContact,omitempty" firestore:"parentContact,omitempty"`
	ParentName    string              `json:"parentName,omitempty" firestore:"parentName,omitempty"`
	StudentID     int                 `json:"studentId,omitempty" firestore:"studentId,omitempty"`
	StudentName   string              `json:"studentName,omitempty" firestore:"studentName,omitempty"`
	BusUnitNumber string              `json:"busUnitNumber,omitempty" firestore:"busUnitNumber,omitempty"`
	RouteNo       string              `json:"routeNo,omitempty" firestore:"routeNo,omitempty"`
	SchoolName    string              `json:"schoolName,omitempty" firestore:"schoolName,omitempty"`
	Grade         string              `json:"grade,omitempty" firestore:"grade,omitempty"`
	LastMessage   *ChatMessageSummary `json:"lastMessage,omitempty" firestore:"lastMessage,omitempty"`
	CreatedAt     time.Time           `json:"createdAt" firestore:"createdAt"`
	UpdatedAt     time.Time           `json:"updatedAt" firestore:"updatedAt"`
}

// ChatMessage represents a single message in a channel (Firestore subcollection: chat_channels/{id}/messages)
type ChatMessage struct {
	ID         string    `json:"id" firestore:"id"`
	ChannelID  string    `json:"channelId" firestore:"channelId"`
	SenderID   string    `json:"senderId" firestore:"senderId"`
	SenderName string    `json:"senderName" firestore:"senderName"` // Dynamic calculated name
	Text       string    `json:"text" firestore:"text"`
	MediaURL   string    `json:"mediaUrl,omitempty" firestore:"mediaUrl,omitempty"`
	MediaType  string    `json:"mediaType,omitempty" firestore:"mediaType,omitempty"` // "image", "file"
	CreatedAt  time.Time `json:"createdAt" firestore:"createdAt"`
}

// SendMessagePayload is the HTTP request body for posting a chat message
type SendMessagePayload struct {
	Text       string `json:"text"`
	MediaURL   string `json:"mediaUrl,omitempty"`
	MediaType  string `json:"mediaType,omitempty"`
	SenderName string `json:"senderName,omitempty"`
}

// CreateDirectChannelPayload is the HTTP request body for starting a 1-on-1 private chat
type CreateDirectChannelPayload struct {
	TargetUserID string `json:"targetUserId"`
}

// CreateParentChannelPayload is the HTTP request body for starting or finding a parent conversation
type CreateParentChannelPayload struct {
	ParentContact string `json:"parentContact"`
	ParentName    string `json:"parentName,omitempty"`
	StudentID     int    `json:"studentId,omitempty"`
	StudentName   string `json:"studentName,omitempty"`
	BusUnitNumber string `json:"busUnitNumber,omitempty"`
	RouteNo       string `json:"routeNo,omitempty"`
	SchoolName    string `json:"schoolName,omitempty"`
	Grade         string `json:"grade,omitempty"`
}

// CleanParentContact normalizes a phone number or email into a stable channel key.
func CleanParentContact(contact string) string {
	clean := strings.ToLower(strings.TrimSpace(contact))
	return strings.NewReplacer("-", "", " ", "", "+", "", "(", "", ")", "").Replace(clean)
}
