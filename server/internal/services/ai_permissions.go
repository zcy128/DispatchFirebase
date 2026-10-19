package services

import (
	"fmt"
	"strings"
)

// NormalizeRole maps arbitrary role string variations to standard role names
func NormalizeRole(role string) string {
	r := strings.ToLower(strings.TrimSpace(role))
	switch r {
	case "admin", "administrator":
		return "admin"
	case "dispatcher", "dispatch":
		return "dispatcher"
	case "hr", "human resources", "human_resources":
		return "HR"
	case "payroll", "finance":
		return "payroll"
	case "manager":
		return "manager"
	case "supervisor":
		return "supervisor"
	case "fleet", "mechanic":
		return "fleet"
	case "studentcare", "student_care", "student care":
		return "studentcare"
	case "office staff", "office_staff", "officestaff", "staff":
		return "office staff"
	case "training":
		return "training"
	case "driver":
		return "driver"
	case "helper", "attendant", "monitor":
		return "helper"
	default:
		if role == "" {
			return "dispatcher"
		}
		return role
	}
}

// CanModifyDispatchShifts checks if the role is allowed to assign drivers or alter dispatch shifts.
// Strictly restricted to "admin" and "dispatcher" (unless explicit 'readwrite' override exists).
// Roles like HR, Payroll, Fleet, Manager, etc. CANNOT modify dispatch shifts.
func CanModifyDispatchShifts(userRole string, pagePermissions map[string]string) bool {
	norm := NormalizeRole(userRole)
	if norm == "admin" {
		return true
	}

	if pagePermissions != nil {
		if val, exists := pagePermissions["dispatch"]; exists {
			return strings.EqualFold(val, "readwrite")
		}
	}

	return norm == "dispatcher"
}

// CanAccessPayroll checks if the role is allowed to query payroll and compensation rates.
// Restricted to "admin", "payroll", and "manager" (read-only).
// Dispatcher, HR, Fleet, etc. do NOT have access to Payroll.
func CanAccessPayroll(userRole string, pagePermissions map[string]string) bool {
	norm := NormalizeRole(userRole)
	if norm == "admin" || norm == "payroll" || norm == "manager" {
		return true
	}

	if pagePermissions != nil {
		if val, exists := pagePermissions["payroll"]; exists {
			return strings.EqualFold(val, "readwrite") || strings.EqualFold(val, "readonly")
		}
	}

	return false
}

// CanAccessHR checks if the role is allowed to view HR/personnel compliance data.
func CanAccessHR(userRole string, pagePermissions map[string]string) bool {
	norm := NormalizeRole(userRole)
	if norm == "admin" || norm == "HR" || norm == "manager" || norm == "dispatcher" || norm == "payroll" || norm == "office staff" {
		return true
	}

	if pagePermissions != nil {
		if val, exists := pagePermissions["employees"]; exists {
			return strings.EqualFold(val, "readwrite") || strings.EqualFold(val, "readonly")
		}
	}

	return false
}

// CanModifyHR checks if the role can modify HR personnel records.
func CanModifyHR(userRole string, pagePermissions map[string]string) bool {
	norm := NormalizeRole(userRole)
	if norm == "admin" || norm == "HR" {
		return true
	}

	if pagePermissions != nil {
		if val, exists := pagePermissions["employees"]; exists {
			return strings.EqualFold(val, "readwrite")
		}
	}

	return false
}

// BuildDispatchModificationDeniedMessage generates a polite localized refusal message
func BuildDispatchModificationDeniedMessage(userRole string, lang string) string {
	norm := NormalizeRole(userRole)
	isFr := strings.EqualFold(lang, "fr")

	roleDisplay := norm
	if norm == "HR" {
		roleDisplay = "Human Resources (HR)"
	} else if norm == "payroll" {
		roleDisplay = "Payroll & Finance"
	}

	if isFr {
		return fmt.Sprintf(
			"⚠️ **Accès refusé (Droits insuffisants)**\n\nVotre rôle actuel (**%s**) ne possède pas l'autorisation de modifier les quarts de régulation ou d'assigner des chauffeurs.\n\n- 🔒 **Règle de sécurité** : Seuls les rôles **Régulateur (Dispatch)** et **Administrateur** peuvent planifier, assigner ou modifier des quarts de travail.\n- 💡 Les rôles tels que **RH (HR)** et **Paie (Payroll)** ont un accès restreint à leurs domaines respectifs.",
			roleDisplay,
		)
	}

	return fmt.Sprintf(
		"⚠️ **Permission Denied (Role Scope Restriction)**\n\nYour current role (**%s**) does not have permission to modify dispatch shifts or assign drivers.\n\n- 🔒 **Security Rule**: Only **Dispatcher** and **Admin** roles are authorized to schedule, reassign, or alter route shifts.\n- 💡 Roles such as **HR** and **Payroll** are scoped to their respective domain modules and cannot alter dispatch schedules.",
		roleDisplay,
	)
}

// BuildPayrollAccessDeniedMessage generates a refusal when non-payroll roles try to view payroll
func BuildPayrollAccessDeniedMessage(userRole string, lang string) string {
	norm := NormalizeRole(userRole)
	isFr := strings.EqualFold(lang, "fr")

	if isFr {
		return fmt.Sprintf(
			"⚠️ **Accès refusé (Module Paie & Rémunération)**\n\nVotre rôle actuel (**%s**) n'a pas accès aux données de rémunération et de paie.\n\n- 🔒 L'accès au module Paie est strictement réservé au département **Paie (Payroll)** et aux **Administrateurs**.",
			norm,
		)
	}

	return fmt.Sprintf(
		"⚠️ **Permission Denied (Payroll & Compensation Module)**\n\nYour current role (**%s**) does not have access to driver compensation and payroll rates.\n\n- 🔒 Access to Payroll records is restricted to the **Payroll Department** and **Administrators**.",
		norm,
	)
}

// BuildHRAccessDeniedMessage generates a refusal when unauthorized roles try to access HR
func BuildHRAccessDeniedMessage(userRole string, lang string) string {
	norm := NormalizeRole(userRole)
	isFr := strings.EqualFold(lang, "fr")

	if isFr {
		return fmt.Sprintf(
			"⚠️ **Accès refusé (Ressources Humaines)**\n\nVotre rôle actuel (**%s**) n'a pas accès aux dossiers du personnel.\n\n- 🔒 L'accès aux dossiers des employés est réservé aux **RH (HR)** et aux **Administrateurs**.",
			norm,
		)
	}

	return fmt.Sprintf(
		"⚠️ **Permission Denied (Human Resources Module)**\n\nYour current role (**%s**) does not have access to confidential employee records.\n\n- 🔒 Access to HR records is restricted to **HR** and **Administrators**.",
		norm,
	)
}

// CanAccessTimeOff checks if user can view time off requests.
// Managers, HR, Dispatchers, Admin, and Office Staff have view access.
func CanAccessTimeOff(userRole string, pagePermissions map[string]string) bool {
	norm := NormalizeRole(userRole)
	if norm == "admin" || norm == "HR" || norm == "manager" || norm == "dispatcher" || norm == "office staff" || norm == "payroll" {
		return true
	}

	if pagePermissions != nil {
		if val, exists := pagePermissions["timeoff"]; exists {
			return strings.EqualFold(val, "readwrite") || strings.EqualFold(val, "readonly")
		}
	}

	return false
}

// CanAccessExpenses checks if user can view expense claims and reimbursements.
// Managers, Payroll, HR, Dispatchers, Admin, and Office Staff have view access.
func CanAccessExpenses(userRole string, pagePermissions map[string]string) bool {
	norm := NormalizeRole(userRole)
	if norm == "admin" || norm == "payroll" || norm == "HR" || norm == "manager" || norm == "dispatcher" || norm == "office staff" {
		return true
	}

	if pagePermissions != nil {
		if val, exists := pagePermissions["expenses"]; exists {
			return strings.EqualFold(val, "readwrite") || strings.EqualFold(val, "readonly")
		}
	}

	return false
}

// BuildTimeOffAccessDeniedMessage generates a refusal when unauthorized roles try to access time off requests
func BuildTimeOffAccessDeniedMessage(userRole string, lang string) string {
	norm := NormalizeRole(userRole)
	isFr := strings.EqualFold(lang, "fr")

	if isFr {
		return fmt.Sprintf(
			"⚠️ **Accès refusé (Demandes de congé)**\n\nVotre rôle actuel (**%s**) n'a pas accès aux demandes de congé.\n\n- 🔒 L'accès aux demandes de congé est réservé aux **RH (HR)**, **Régulateurs**, **Gestionnaires** et **Administrateurs**.",
			norm,
		)
	}

	return fmt.Sprintf(
		"⚠️ **Permission Denied (Time Off Requests)**\n\nYour current role (**%s**) does not have permission to view time off requests.\n\n- 🔒 Access to leave requests is restricted to **HR**, **Dispatchers**, **Managers**, and **Administrators**.",
		norm,
	)
}

// BuildExpenseAccessDeniedMessage generates a refusal when unauthorized roles try to access expense claims
func BuildExpenseAccessDeniedMessage(userRole string, lang string) string {
	norm := NormalizeRole(userRole)
	isFr := strings.EqualFold(lang, "fr")

	if isFr {
		return fmt.Sprintf(
			"⚠️ **Accès refusé (Notes de frais & Remboursements)**\n\nVotre rôle actuel (**%s**) n'a pas accès aux demandes de remboursement de frais.\n\n- 🔒 L'accès est réservé à la **Paie / Finance**, aux **Gestionnaires** et aux **Administrateurs**.",
			norm,
		)
	}

	return fmt.Sprintf(
		"⚠️ **Permission Denied (Expense Claims & Reimbursements)**\n\nYour current role (**%s**) does not have permission to view expense reimbursement claims.\n\n- 🔒 Access is restricted to **Payroll / Finance**, **Managers**, and **Administrators**.",
		norm,
	)
}

