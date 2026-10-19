package models

import (
	"time"
)

// ParentUser represents a parent or legal guardian account (Firestore: parent_users)
type ParentUser struct {
	ID               string                    `json:"id" firestore:"id"` // PAR-{sanitizedContact}
	ContactType      string                    `json:"contactType" firestore:"contactType"` // "phone" | "email"
	ContactValue     string                    `json:"contactValue" firestore:"contactValue"`
	DisplayName      string                    `json:"displayName" firestore:"displayName"`
	Phone            string                    `json:"phone,omitempty" firestore:"phone,omitempty"`
	Email            string                    `json:"email,omitempty" firestore:"email,omitempty"`
	HomeAddress      string                    `json:"homeAddress,omitempty" firestore:"homeAddress,omitempty"`
	PasswordHash     string                    `json:"-" firestore:"passwordHash,omitempty"` // bcrypt hash if registered
	IsRegistered     bool                      `json:"isRegistered" firestore:"isRegistered"` // false = guest/OTP-only, true = permanent account
	LinkedStudentIDs []string                  `json:"linkedStudentIds" firestore:"linkedStudentIds"`
	DeviceTokens     []DeviceToken             `json:"deviceTokens,omitempty" firestore:"deviceTokens,omitempty"`
	Preferences      *ParentNotificationConfig `json:"preferences,omitempty" firestore:"preferences,omitempty"`
	CreatedAt        time.Time                 `json:"createdAt" firestore:"createdAt"`
	LastLoginAt      time.Time                 `json:"lastLoginAt" firestore:"lastLoginAt"`
}

// UpdateParentProfileRequest represents incoming profile updates from Parent App
type UpdateParentProfileRequest struct {
	DisplayName string `json:"displayName"`
	Phone       string `json:"phone"`
	Email       string `json:"email"`
	HomeAddress string `json:"homeAddress"`
}

// ParentOTPSession stores short-lived one-time passcodes
type ParentOTPSession struct {
	Contact           string    `json:"contact" firestore:"contact"`
	Code              string    `json:"code" firestore:"code"`
	ExpiresAt         time.Time `json:"expiresAt" firestore:"expiresAt"`
	Verified          bool      `json:"verified" firestore:"verified"`
	MatchedStudentIDs []string  `json:"matchedStudentIds" firestore:"matchedStudentIds"`
	CreatedAt         time.Time `json:"createdAt" firestore:"createdAt"`
}

// ParentNotificationConfig defines alert preference toggles for a parent
type ParentNotificationConfig struct {
	ParentID              string    `json:"parentId,omitempty" firestore:"parentId,omitempty"`
	NotifyApproaching     bool      `json:"notifyApproaching" firestore:"notifyApproaching"`
	ApproachingMinutes    int       `json:"approachingMinutes" firestore:"approachingMinutes"` // default 5 mins
	NotifyDelay           bool      `json:"notifyDelay" firestore:"notifyDelay"`
	DelayThresholdMinutes int       `json:"delayThresholdMinutes" firestore:"delayThresholdMinutes"` // default 10 mins
	NotifyBoarding        bool      `json:"notifyBoarding" firestore:"notifyBoarding"`
	NotifyDropoff         bool      `json:"notifyDropoff" firestore:"notifyDropoff"`
	ChannelPush           bool      `json:"channelPush" firestore:"channelPush"`
	ChannelSMS            bool      `json:"channelSms" firestore:"channelSms"`
	ChannelEmail          bool      `json:"channelEmail" firestore:"channelEmail"`
	UpdatedAt             time.Time `json:"updatedAt" firestore:"updatedAt"`
}

// DefaultParentNotificationConfig returns recommended standard defaults
func DefaultParentNotificationConfig() *ParentNotificationConfig {
	return &ParentNotificationConfig{
		NotifyApproaching:     true,
		ApproachingMinutes:    5,
		NotifyDelay:           true,
		DelayThresholdMinutes: 10,
		NotifyBoarding:        true,
		NotifyDropoff:         true,
		ChannelPush:           true,
		ChannelSMS:            true,
		ChannelEmail:          false,
		UpdatedAt:             time.Now().UTC(),
	}
}

// VehicleLiveLocation represents real-time bus telemetry (Firestore: vehicle_locations/{unitNumber})
type VehicleLiveLocation struct {
	UnitNumber          string    `json:"unitNumber" firestore:"unitNumber"`
	RouteNo             string    `json:"routeNo" firestore:"routeNo"`
	ShiftID             string    `json:"shiftId" firestore:"shiftId"`
	Latitude            float64   `json:"latitude" firestore:"latitude"`
	Longitude           float64   `json:"longitude" firestore:"longitude"`
	Heading             float64   `json:"heading" firestore:"heading"` // 0-360 degrees
	SpeedKmh            float64   `json:"speedKmh" firestore:"speedKmh"`
	LastUpdated         time.Time `json:"lastUpdated" firestore:"lastUpdated"`
	CurrentStopSequence int       `json:"currentStopSequence" firestore:"currentStopSequence"`
	NextStopLocation    string    `json:"nextStopLocation,omitempty" firestore:"nextStopLocation,omitempty"`
	Status              string    `json:"status" firestore:"status"` // "EN_ROUTE", "AT_STOP", "SCHEDULED", "COMPLETED"
}

// ParentStudentCommute summarizes one child's daily bus transit status
type ParentStudentCommute struct {
	StudentID       int                  `json:"studentId"`
	StudentNo       string               `json:"studentNo"`
	StudentName     string               `json:"studentName"`
	Grade           string               `json:"grade"`
	SchoolName      string               `json:"schoolName"`
	SchoolLatitude  *float64             `json:"schoolLatitude,omitempty"`
	SchoolLongitude *float64             `json:"schoolLongitude,omitempty"`
	AvatarColor     string               `json:"avatarColor"` // e.g. "#4F46E5", "#059669"
	ShiftType       string               `json:"shiftType"`   // "AM", "PM"
	ShiftID         string               `json:"shiftId"`
	RouteNo         string               `json:"routeNo"`
	BusUnitNumber   string               `json:"busUnitNumber"`
	DriverName      string               `json:"driverName"`
	StopLocation    string               `json:"stopLocation"`
	StopLatitude    *float64             `json:"stopLatitude,omitempty"`
	StopLongitude   *float64             `json:"stopLongitude,omitempty"`
	StopType        string               `json:"stopType"`
	ScheduledTime   string               `json:"scheduledTime"`
	EstimatedTime   string               `json:"estimatedTime"`
	LateMinutes     int                  `json:"lateMinutes"`
	Status          string               `json:"status"` // "SCHEDULED", "EN_ROUTE", "APPROACHING", "BOARDED", "DROPPED_OFF", "DELAYED"
	VehicleLocation *VehicleLiveLocation `json:"vehicleLocation,omitempty"`
	DistanceKm      *float64             `json:"distanceKm,omitempty"`
	MinutesAway     *int                 `json:"minutesAway,omitempty"`
	RoutePolyline   string               `json:"routePolyline,omitempty"` // Google Encoded Polyline for map snapping
}

// RequestOTPPayload payload for requesting a one-time login passcode
type RequestOTPPayload struct {
	Contact string `json:"contact"` // Phone number or email
}

// RequestOTPResponse response returned after sending OTP
type RequestOTPResponse struct {
	Success              bool   `json:"success"`
	Message              string `json:"message"`
	ContactType          string `json:"contactType"` // "phone" | "email"
	MatchedStudentsCount int    `json:"matchedStudentsCount"`
	DevCode              string `json:"devCode,omitempty"` // populated in dev mode for testing convenience
}

// VerifyOTPPayload payload for validating OTP
type VerifyOTPPayload struct {
	Contact string `json:"contact"`
	Code    string `json:"code"`
}

// VerifyOTPResponse response returned upon successful verification
type VerifyOTPResponse struct {
	Success      bool                    `json:"success"`
	Token        string                  `json:"token"`
	IsRegistered bool                    `json:"isRegistered"`
	ParentUser   *ParentUser             `json:"parentUser"`
	Students     []*ParentStudentCommute `json:"students"`
}

// RegisterParentPayload payload to convert a guest session into a permanent account
type RegisterParentPayload struct {
	Contact  string `json:"contact"`
	Password string `json:"password"`
	Name     string `json:"name"`
}
