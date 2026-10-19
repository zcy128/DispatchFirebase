package models

import (
	"strings"
	"time"
)

// DriverLicense mirrors the driver_license table from EmployeeModel.cs
type DriverLicense struct {
	LicenseID        string     `json:"licenseId" firestore:"licenseId"`
	ExpirationDate   time.Time  `json:"expirationDate" firestore:"expirationDate"`
	LicenseClass     string     `json:"licenseClass" firestore:"licenseClass"`
	LicenseCondition string     `json:"licenseCondition,omitempty" firestore:"licenseCondition,omitempty"`
	MVID             string     `json:"mvid,omitempty" firestore:"mvid,omitempty"`
	IssuedDate       *time.Time `json:"issuedDate,omitempty" firestore:"issuedDate,omitempty"`
}

// EmployeeContact mirrors employee_contact table from EmployeeModel.cs
type EmployeeContact struct {
	ContactID      string `json:"contactId" firestore:"contactId"`
	PrimaryContact bool   `json:"primaryContact" firestore:"primaryContact"`
	ContactName    string `json:"contactName" firestore:"contactName"`
	Relationship   string `json:"relationship,omitempty" firestore:"relationship,omitempty"`
	MobilePhone    string `json:"mobilePhone,omitempty" firestore:"mobilePhone,omitempty"`
	HomePhone      string `json:"homePhone,omitempty" firestore:"homePhone,omitempty"`
	WorkPhone      string `json:"workPhone,omitempty" firestore:"workPhone,omitempty"`
	Street         string `json:"street,omitempty" firestore:"street,omitempty"`
	City           string `json:"city,omitempty" firestore:"city,omitempty"`
	PostalCode     string `json:"postalCode,omitempty" firestore:"postalCode,omitempty"`
	Email          string `json:"email,omitempty" firestore:"email,omitempty"`
	Active         bool   `json:"active" firestore:"active"`
}

// EmployeePhoto mirrors employee_photo table from EmployeeModel.cs
type EmployeePhoto struct {
	PhotoURL  string    `json:"photoUrl,omitempty" firestore:"photoUrl,omitempty"`
	MimeType  string    `json:"mimeType,omitempty" firestore:"mimeType,omitempty"`
	Width     int       `json:"width,omitempty" firestore:"width,omitempty"`
	Height    int       `json:"height,omitempty" firestore:"height,omitempty"`
	UpdatedAt time.Time `json:"updatedAt,omitempty" firestore:"updatedAt,omitempty"`
}

// Employee represents the primary business master data entity based on EmployeeModel.cs
type Employee struct {
	ID             string            `json:"id" firestore:"id"`
	EmployeeID     int               `json:"employeeId,omitempty" firestore:"employeeId,omitempty"`
	EmployeeNumber string            `json:"employeeNumber" firestore:"employeeNumber"`
	FirstName      string            `json:"firstName" firestore:"firstName"`
	LastName       string            `json:"lastName" firestore:"lastName"`
	MiddleName     string            `json:"middleName,omitempty" firestore:"middleName,omitempty"`
	FullName       string            `json:"fullName" firestore:"fullName"`
	MobilePhone    string            `json:"mobilePhone,omitempty" firestore:"mobilePhone,omitempty"`
	WorkPhonePhone string            `json:"workPhonePhone,omitempty" firestore:"workPhonePhone,omitempty"`
	HomePhone      string            `json:"homePhone,omitempty" firestore:"homePhone,omitempty"`
	PreferredPhone string            `json:"preferredPhone,omitempty" firestore:"preferredPhone,omitempty"`
	PersonalEmail  string            `json:"personalEmail,omitempty" firestore:"personalEmail,omitempty"`
	WorkEmail      string            `json:"workEmail,omitempty" firestore:"workEmail,omitempty"`
	PreferredEmail string            `json:"preferredEmail,omitempty" firestore:"preferredEmail,omitempty"`
	JobPosition    string            `json:"jobPosition" firestore:"jobPosition"`
	DateHired      *time.Time        `json:"dateHired,omitempty" firestore:"dateHired,omitempty"`
	IsActive       bool              `json:"isActive" firestore:"isActive"`
	PersonalAddress string           `json:"personalAddress,omitempty" firestore:"personalAddress,omitempty"`
	Lat            *float64          `json:"lat,omitempty" firestore:"lat,omitempty"`
	Lng            *float64          `json:"lng,omitempty" firestore:"lng,omitempty"`
	YardID         string            `json:"yardId,omitempty" firestore:"yardId,omitempty"`
	DriverLicense  *DriverLicense    `json:"driverLicense,omitempty" firestore:"driverLicense,omitempty"`
	EmployeeContacts []EmployeeContact `json:"employeeContacts,omitempty" firestore:"employeeContacts,omitempty"`
	EmployeePhoto  *EmployeePhoto    `json:"employeePhoto,omitempty" firestore:"employeePhoto,omitempty"`
	
	// Identity & RBAC Integration
	Username        string            `json:"username,omitempty" firestore:"username,omitempty"`
	FirebaseUID     string            `json:"firebaseUid,omitempty" firestore:"firebaseUid,omitempty"`
	// Role: driver, helper, office staff, dispatcher, studentcare, fleet, supervisor, payroll, HR, training, manager, admin
	Role            string            `json:"role,omitempty" firestore:"role,omitempty"`
	PagePermissions map[string]string `json:"pagePermissions,omitempty" firestore:"pagePermissions,omitempty"` // pageId -> "none" | "readonly" | "readwrite"
	Devices         []DeviceToken     `json:"devices,omitempty" firestore:"devices,omitempty"`
	CreatedAt       time.Time         `json:"createdAt" firestore:"createdAt"`
	UpdatedAt       time.Time         `json:"updatedAt" firestore:"updatedAt"`
}

// DeviceToken stores FCM device registration info for multi-device push notifications
type DeviceToken struct {
	Token        string    `json:"token" firestore:"token"`
	Platform     string    `json:"platform" firestore:"platform"` // "android", "web", "ios"
	DeviceName   string    `json:"deviceName,omitempty" firestore:"deviceName,omitempty"`
	LastActiveAt time.Time `json:"lastActiveAt" firestore:"lastActiveAt"`
}

// GenerateUsername generates a username from firstName and lastName: e.g. "driver1 Doe" -> "driver1d"
func GenerateUsername(firstName, lastName string) string {
	fn := strings.ToLower(strings.TrimSpace(firstName))
	// Keep alphanumeric characters only
	var fnClean strings.Builder
	for _, r := range fn {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			fnClean.WriteRune(r)
		}
	}

	ln := strings.ToLower(strings.TrimSpace(lastName))
	var lnClean strings.Builder
	for _, r := range ln {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			lnClean.WriteRune(r)
		}
	}

	fnStr := fnClean.String()
	lnStr := lnClean.String()

	if len(lnStr) > 0 {
		return fnStr + string(lnStr[0])
	}
	return fnStr
}

// ComputeComputedFields fills FullName, Username, PreferredPhone, PreferredEmail
func (e *Employee) ComputeComputedFields() {
	// FullName
	if strings.TrimSpace(e.MiddleName) != "" {
		e.FullName = strings.TrimSpace(e.FirstName) + " (" + strings.TrimSpace(e.MiddleName) + ") " + strings.TrimSpace(e.LastName)
	} else {
		e.FullName = strings.TrimSpace(strings.TrimSpace(e.FirstName) + " " + strings.TrimSpace(e.LastName))
	}

	// Username: e.g. "driver1 Doe" -> "driver1d"
	if strings.TrimSpace(e.Username) == "" && (strings.TrimSpace(e.FirstName) != "" || strings.TrimSpace(e.LastName) != "") {
		e.Username = GenerateUsername(e.FirstName, e.LastName)
	}

	// Default WorkEmail to username@dispatch.pcy.ca if empty
	if strings.TrimSpace(e.WorkEmail) == "" && strings.TrimSpace(e.Username) != "" {
		e.WorkEmail = strings.TrimSpace(e.Username) + "@dispatch.pcy.ca"
	}

	// PreferredPhone
	for _, p := range []string{e.WorkPhonePhone, e.MobilePhone, e.HomePhone} {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			e.PreferredPhone = trimmed
			break
		}
	}

	// PreferredEmail
	for _, em := range []string{e.WorkEmail, e.PersonalEmail} {
		trimmed := strings.TrimSpace(em)
		if trimmed != "" {
			e.PreferredEmail = trimmed
			break
		}
	}
}
