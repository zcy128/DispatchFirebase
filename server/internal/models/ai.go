package models

import "time"

// AIChatMessage represents a single message in a conversation
type AIChatMessage struct {
	Role    string `json:"role"` // "user", "assistant", "system"
	Content string `json:"content"`
}

// AIChatRequest represents the incoming chat request from dispatch
type AIChatRequest struct {
	Message         string            `json:"message"`
	History         []AIChatMessage   `json:"history,omitempty"`
	Date            string            `json:"date,omitempty"` // Context date: YYYY-MM-DD
	YardFilter      string            `json:"yardFilter,omitempty"`
	ActionID        string            `json:"actionId,omitempty"`  // Action ID when confirming an operation
	Confirmed       bool              `json:"confirmed,omitempty"` // True when user clicked "Confirm"
	ConfirmActionID string            `json:"confirmActionId,omitempty"`
	ConfirmAccepted *bool             `json:"confirmAccepted,omitempty"`
	OperatorName    string            `json:"operatorName,omitempty"`
	OperatorID      string            `json:"operatorId,omitempty"`
	UserRole        string            `json:"userRole,omitempty"`
	PagePermissions map[string]string `json:"pagePermissions,omitempty"`
	Lang            string            `json:"lang,omitempty"` // "en" or "fr"
}

// AIActionCard represents rich interactive UI widgets returned by AI
type AIActionCard struct {
	Type        string                 `json:"type"` // "unassigned_shifts", "confirm_action", "action_success", "action_cancelled"
	Title       string                 `json:"title"`
	ActionID    string                 `json:"actionId,omitempty"`
	RequiresAck bool                   `json:"requiresAck,omitempty"`
	Data        map[string]interface{} `json:"data,omitempty"`
}

// AIChatResponse is the payload sent back to the web console
type AIChatResponse struct {
	Reply              string         `json:"reply"`
	ActionCards        []AIActionCard `json:"actionCards,omitempty"`
	SuggestedQuestions []string       `json:"suggestedQuestions,omitempty"`
	Engine             string         `json:"engine,omitempty"` // "gemini" or "builtin"
	QuotaUsed          int            `json:"quotaUsed,omitempty"`
	QuotaLimit         int            `json:"quotaLimit,omitempty"`
	QuotaRemaining     int            `json:"quotaRemaining,omitempty"`
	QuotaExhausted     bool           `json:"quotaExhausted,omitempty"`
}

// PendingDispatchAction stores details of an action waiting for user confirmation
type PendingDispatchAction struct {
	ID            string    `json:"id"`
	ActionType    string    `json:"actionType"` // "ASSIGN_DRIVER", "REASSIGN_CREW"
	Date          string    `json:"date"`
	RouteNo       string    `json:"routeNo"`
	RouteName     string    `json:"routeName"`
	ShiftType     string    `json:"shiftType"` // "ALL", "AM", "PM"
	ShiftIDs      []string  `json:"shiftIds"`
	DriverID      string    `json:"driverId"`
	DriverName    string    `json:"driverName"`
	DriverPhone   string    `json:"driverPhone"`
	OldDriverName string    `json:"oldDriverName"`
	CreatedBy     string    `json:"createdBy"`
	CreatedByRole string    `json:"createdByRole,omitempty"`
	CreatedAt     time.Time `json:"createdAt"`
}
