package models

import "time"

// Yard represents a bus dispatch yard or terminal depot facility.
type Yard struct {
	ID                 string    `firestore:"id" json:"id"`
	YardID             int       `firestore:"yardId" json:"yardId"`
	Name               string    `firestore:"name" json:"name"`
	SupervisorID       *string   `firestore:"supervisorId,omitempty" json:"supervisorId,omitempty"`
	SupervisorName     string    `firestore:"supervisorName,omitempty" json:"supervisorName,omitempty"`
	SupervisorPhone    string    `firestore:"supervisorPhone,omitempty" json:"supervisorPhone,omitempty"`
	SupervisorEmail    string    `firestore:"supervisorEmail,omitempty" json:"supervisorEmail,omitempty"`
	SupervisorAltID    *string   `firestore:"supervisorAltId,omitempty" json:"supervisorAltId,omitempty"`
	SupervisorAltName  string    `firestore:"supervisorAltName,omitempty" json:"supervisorAltName,omitempty"`
	SupervisorAltPhone string    `firestore:"supervisorAltPhone,omitempty" json:"supervisorAltPhone,omitempty"`
	SupervisorAltEmail string    `firestore:"supervisorAltEmail,omitempty" json:"supervisorAltEmail,omitempty"`
	IsActive           bool      `firestore:"isActive" json:"isActive"`
	CreatedAt          time.Time `firestore:"createdAt,omitempty" json:"createdAt,omitempty"`
	UpdatedAt          time.Time `firestore:"updatedAt,omitempty" json:"updatedAt,omitempty"`
}

// CreateYardRequest represents the payload to create a new yard.
type CreateYardRequest struct {
	Name               string  `json:"name"`
	SupervisorID       *string `json:"supervisorId,omitempty"`
	SupervisorName     string  `json:"supervisorName,omitempty"`
	SupervisorPhone    string  `json:"supervisorPhone,omitempty"`
	SupervisorEmail    string  `json:"supervisorEmail,omitempty"`
	SupervisorAltID    *string `json:"supervisorAltId,omitempty"`
	SupervisorAltName  string  `json:"supervisorAltName,omitempty"`
	SupervisorAltPhone string  `json:"supervisorAltPhone,omitempty"`
	SupervisorAltEmail string  `json:"supervisorAltEmail,omitempty"`
	IsActive           *bool   `json:"isActive,omitempty"`
}

// UpdateYardRequest represents the payload to update an existing yard.
type UpdateYardRequest struct {
	Name               *string `json:"name,omitempty"`
	SupervisorID       *string `json:"supervisorId,omitempty"`
	SupervisorName     *string `json:"supervisorName,omitempty"`
	SupervisorPhone    *string `json:"supervisorPhone,omitempty"`
	SupervisorEmail    *string `json:"supervisorEmail,omitempty"`
	SupervisorAltID    *string `json:"supervisorAltId,omitempty"`
	SupervisorAltName  *string `json:"supervisorAltName,omitempty"`
	SupervisorAltPhone *string `json:"supervisorAltPhone,omitempty"`
	SupervisorAltEmail *string `json:"supervisorAltEmail,omitempty"`
	IsActive           *bool   `json:"isActive,omitempty"`
}

// YardStats represents high level metrics for yards.
type YardStats struct {
	TotalYards  int `json:"totalYards"`
	ActiveYards int `json:"activeYards"`
}
