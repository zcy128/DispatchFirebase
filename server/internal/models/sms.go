package models

import "time"

// SMSMessage represents an outbound or inbound SMS record.
type SMSMessage struct {
	ID              string    `json:"id" firestore:"id"`
	Direction       string    `json:"direction" firestore:"direction"` // "outbound" or "inbound"
	FromPhone       string    `json:"fromPhone" firestore:"fromPhone"`
	ToPhone         string    `json:"toPhone" firestore:"toPhone"`
	NormalizedPhone string    `json:"normalizedPhone" firestore:"normalizedPhone"` // Normalized 10-digit phone for fast matching
	Message         string    `json:"message" firestore:"message"`
	RecipientName   string    `json:"recipientName,omitempty" firestore:"recipientName,omitempty"`
	SenderName      string    `json:"senderName,omitempty" firestore:"senderName,omitempty"`
	ShiftID         string    `json:"shiftId,omitempty" firestore:"shiftId,omitempty"`
	RouteNo         string    `json:"routeNo,omitempty" firestore:"routeNo,omitempty"`
	Status          string    `json:"status" firestore:"status"` // "sent", "delivered", "received", "failed"
	CreatedAt       time.Time `json:"createdAt" firestore:"createdAt"`
	DateStr         string    `json:"dateStr" firestore:"dateStr"` // "YYYY-MM-DD"
}

// SendSMSRequest is the JSON payload for dispatching an SMS via Twilio.
type SendSMSRequest struct {
	ToPhone       string `json:"toPhone"`
	Message       string `json:"message"`
	RecipientName string `json:"recipientName,omitempty"`
	ShiftID       string `json:"shiftId,omitempty"`
	RouteNo       string `json:"routeNo,omitempty"`
}
