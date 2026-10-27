package auth

import (
	"strings"
)

// AllSystemModules lists the 34 core functional pages/modules in the system.
var AllSystemModules = []string{
	"dashboard",
	"dispatch",
	"routes",
	"staging_routes",
	"dispatch_payroll",
	"charter",
	"dispatch_log",
	"temporary_assignments",
	"assignment_history",
	"route_assessments",
	"defects",
	"vehicle_signouts",
	"student_incidents",
	"hazards",
	"employees",
	"students",
	"student_absences",
	"schools",
	"calendar",
	"vehicles",
	"vehicle_inspections",
	"yards",
	"compliance",
	"time_off",
	"training",
	"expenses",
	"payroll",
	"biweekly_payroll",
	"payroll_dept_log",
	"roles",
	"company_contacts",
	"login_logs",
	"audit_logs",
	"external_sync",
	"settings",
}

// NormalizeRoleName returns the canonical role name for permissions resolution.
func NormalizeRoleName(role string) string {
	r := strings.ToLower(strings.TrimSpace(role))
	switch r {
	case "admin", "administrator":
		return "admin"
	case "manager":
		return "manager"
	case "dispatcher", "dispatch":
		return "dispatcher"
	case "supervisor":
		return "supervisor"
	case "office staff", "office_staff", "officestaff", "staff":
		return "office staff"
	case "studentcare", "student_care", "student care":
		return "studentcare"
	case "fleet", "mechanic":
		return "fleet"
	case "hr", "human resources", "human_resources":
		return "HR"
	case "payroll", "finance":
		return "payroll"
	case "training":
		return "training"
	case "driver":
		return "driver"
	case "helper", "attendant", "monitor":
		return "helper"
	default:
		if role == "" {
			return "driver"
		}
		return role
	}
}

// FactoryRolePermissions defines the factory baseline permission matrix for all 12 roles.
var FactoryRolePermissions = map[string]map[string]string{
	"admin": {
		"dashboard": "readwrite", "dispatch": "readwrite", "charter": "readwrite",
		"dispatch_payroll": "readwrite", "dispatch_log": "readwrite", "temporary_assignments": "readwrite",
		"assignment_history": "readwrite", "routes": "readwrite", "staging_routes": "readwrite",
		"route_assessments": "readwrite", "defects": "readwrite", "vehicle_signouts": "readwrite",
		"student_incidents": "readwrite", "hazards": "readwrite", "employees": "readwrite",
		"students": "readwrite", "student_absences": "readwrite", "schools": "readwrite",
		"calendar": "readwrite", "vehicles": "readwrite", "vehicle_inspections": "readwrite",
		"yards": "readwrite", "compliance": "readwrite", "time_off": "readwrite",
		"training": "readwrite", "expenses": "readwrite", "payroll": "readwrite",
		"biweekly_payroll": "readwrite", "payroll_dept_log": "readwrite", "roles": "readwrite",
		"company_contacts": "readwrite", "login_logs": "readwrite", "audit_logs": "readwrite",
		"settings": "readwrite", "external_sync": "readwrite",
	},
	"manager": {
		"dashboard": "readonly", "dispatch": "readonly", "charter": "readonly",
		"dispatch_payroll": "readonly", "dispatch_log": "readonly", "temporary_assignments": "readonly",
		"assignment_history": "readonly", "routes": "readonly", "staging_routes": "readonly",
		"route_assessments": "readonly", "defects": "readonly", "vehicle_signouts": "readonly",
		"student_incidents": "readonly", "hazards": "readonly", "employees": "readonly",
		"students": "readonly", "student_absences": "readonly", "schools": "readonly",
		"calendar": "readonly", "vehicles": "readonly", "vehicle_inspections": "readonly",
		"yards": "readonly", "compliance": "readonly", "time_off": "readonly",
		"training": "readonly", "expenses": "readonly", "payroll": "readonly",
		"biweekly_payroll": "readonly", "payroll_dept_log": "readonly", "roles": "readonly",
		"company_contacts": "readonly", "login_logs": "none", "audit_logs": "none",
		"settings": "none", "external_sync": "none",
	},
	"dispatcher": {
		"dashboard": "readwrite", "dispatch": "readwrite", "charter": "readwrite",
		"dispatch_payroll": "readwrite", "dispatch_log": "readwrite", "temporary_assignments": "readwrite",
		"assignment_history": "readwrite", "routes": "readwrite", "staging_routes": "readwrite",
		"route_assessments": "readwrite", "defects": "readonly", "vehicle_signouts": "readonly",
		"student_incidents": "readonly", "hazards": "readonly", "employees": "readonly",
		"students": "readwrite", "student_absences": "readwrite", "schools": "readwrite",
		"calendar": "readwrite", "vehicles": "readonly", "vehicle_inspections": "readonly",
		"yards": "readonly", "compliance": "readonly", "time_off": "readonly",
		"training": "readonly", "expenses": "none", "payroll": "none",
		"biweekly_payroll": "none", "payroll_dept_log": "readonly", "roles": "readonly",
		"company_contacts": "readonly", "login_logs": "none", "audit_logs": "none",
		"settings": "none", "external_sync": "none",
	},
	"office staff": {
		"dashboard": "readonly", "dispatch": "readonly", "charter": "none",
		"dispatch_payroll": "none", "dispatch_log": "readonly", "temporary_assignments": "readonly",
		"assignment_history": "readonly", "routes": "readonly", "staging_routes": "readonly",
		"route_assessments": "readonly", "defects": "readonly", "vehicle_signouts": "readonly",
		"student_incidents": "readonly", "hazards": "readonly", "employees": "readonly",
		"students": "readonly", "student_absences": "readonly", "schools": "readonly",
		"calendar": "readonly", "vehicles": "readonly", "vehicle_inspections": "readonly",
		"yards": "readonly", "compliance": "readonly", "time_off": "readonly",
		"training": "readonly", "expenses": "readonly", "payroll": "none",
		"biweekly_payroll": "none", "payroll_dept_log": "none", "roles": "readonly",
		"company_contacts": "readonly", "login_logs": "none", "audit_logs": "none",
		"settings": "none", "external_sync": "none",
	},
	"studentcare": {
		"dashboard": "readonly", "dispatch": "readonly", "charter": "none",
		"dispatch_payroll": "none", "dispatch_log": "readonly", "temporary_assignments": "readonly",
		"assignment_history": "none", "routes": "readonly", "staging_routes": "readonly",
		"route_assessments": "readonly", "defects": "readonly", "vehicle_signouts": "none",
		"student_incidents": "readwrite", "hazards": "readonly", "employees": "none",
		"students": "readwrite", "student_absences": "readwrite", "schools": "readonly",
		"calendar": "readonly", "vehicles": "none", "vehicle_inspections": "none",
		"yards": "none", "compliance": "none", "time_off": "none",
		"training": "readonly", "expenses": "none", "payroll": "none",
		"biweekly_payroll": "none", "payroll_dept_log": "none", "roles": "none",
		"company_contacts": "readonly", "login_logs": "none", "audit_logs": "none",
		"settings": "none", "external_sync": "none",
	},
	"fleet": {
		"dashboard": "readonly", "dispatch": "readonly", "charter": "readonly",
		"dispatch_payroll": "none", "dispatch_log": "readonly", "temporary_assignments": "readonly",
		"assignment_history": "readwrite", "routes": "readonly", "staging_routes": "readonly",
		"route_assessments": "readonly", "defects": "readwrite", "vehicle_signouts": "readwrite",
		"student_incidents": "none", "hazards": "readonly", "employees": "none",
		"students": "none", "student_absences": "none", "schools": "none",
		"calendar": "none", "vehicles": "readwrite", "vehicle_inspections": "readwrite",
		"yards": "readonly", "compliance": "readonly", "time_off": "none",
		"training": "none", "expenses": "none", "payroll": "none",
		"biweekly_payroll": "none", "payroll_dept_log": "none", "roles": "none",
		"company_contacts": "readonly", "login_logs": "none", "audit_logs": "none",
		"settings": "none", "external_sync": "none",
	},
	"supervisor": {
		"dashboard": "readonly", "dispatch": "readonly", "charter": "readonly",
		"dispatch_payroll": "readonly", "dispatch_log": "readonly", "temporary_assignments": "readonly",
		"assignment_history": "readonly", "routes": "readonly", "staging_routes": "readonly",
		"route_assessments": "readonly", "defects": "readonly", "vehicle_signouts": "readonly",
		"student_incidents": "readonly", "hazards": "readonly", "employees": "none",
		"students": "none", "student_absences": "readonly", "schools": "none",
		"calendar": "readonly", "vehicles": "readonly", "vehicle_inspections": "readonly",
		"yards": "readonly", "compliance": "readonly", "time_off": "none",
		"training": "none", "expenses": "none", "payroll": "none",
		"biweekly_payroll": "none", "payroll_dept_log": "none", "roles": "none",
		"company_contacts": "readonly", "login_logs": "none", "audit_logs": "none",
		"settings": "none", "external_sync": "none",
	},
	"HR": {
		"dashboard": "readonly", "dispatch": "readonly", "charter": "none",
		"dispatch_payroll": "none", "dispatch_log": "readonly", "temporary_assignments": "readonly",
		"assignment_history": "readonly", "routes": "readonly", "staging_routes": "readonly",
		"route_assessments": "readonly", "defects": "readonly", "vehicle_signouts": "none",
		"student_incidents": "readonly", "hazards": "readonly", "employees": "readwrite",
		"students": "readonly", "student_absences": "readonly", "schools": "readonly",
		"calendar": "readonly", "vehicles": "readonly", "vehicle_inspections": "readonly",
		"yards": "readonly", "compliance": "readonly", "time_off": "readwrite",
		"training": "readonly", "expenses": "readwrite", "payroll": "none",
		"biweekly_payroll": "none", "payroll_dept_log": "none", "roles": "readwrite",
		"company_contacts": "readwrite", "login_logs": "none", "audit_logs": "none",
		"settings": "none", "external_sync": "none",
	},
	"payroll": {
		"dashboard": "readonly", "dispatch": "readonly", "charter": "readonly",
		"dispatch_payroll": "readonly", "dispatch_log": "readonly", "temporary_assignments": "readonly",
		"assignment_history": "readonly", "routes": "readonly", "staging_routes": "readonly",
		"route_assessments": "readonly", "defects": "readonly", "vehicle_signouts": "readonly",
		"student_incidents": "readonly", "hazards": "readonly", "employees": "readonly",
		"students": "readonly", "student_absences": "readonly", "schools": "readonly",
		"calendar": "readonly", "vehicles": "readonly", "vehicle_inspections": "readonly",
		"yards": "readonly", "compliance": "readonly", "time_off": "readonly",
		"training": "readonly", "expenses": "readonly", "payroll": "readwrite",
		"biweekly_payroll": "readwrite", "payroll_dept_log": "readwrite", "roles": "none",
		"company_contacts": "readonly", "login_logs": "none", "audit_logs": "none",
		"settings": "none", "external_sync": "none",
	},
	"training": {
		"dashboard": "readonly", "dispatch": "readonly", "charter": "none",
		"dispatch_payroll": "none", "dispatch_log": "readonly", "temporary_assignments": "readonly",
		"assignment_history": "readonly", "routes": "readonly", "staging_routes": "readonly",
		"route_assessments": "readonly", "defects": "readonly", "vehicle_signouts": "none",
		"student_incidents": "readonly", "hazards": "readonly", "employees": "readonly",
		"students": "none", "student_absences": "none", "schools": "none",
		"calendar": "none", "vehicles": "readonly", "vehicle_inspections": "none",
		"yards": "none", "compliance": "readwrite", "time_off": "none",
		"training": "readwrite", "expenses": "none", "payroll": "none",
		"biweekly_payroll": "none", "payroll_dept_log": "none", "roles": "none",
		"company_contacts": "readonly", "login_logs": "none", "audit_logs": "none",
		"settings": "none", "external_sync": "none",
	},
	"driver": {
		"dashboard": "none", "dispatch": "readwrite", "charter": "readwrite",
		"dispatch_payroll": "none", "dispatch_log": "none", "temporary_assignments": "readonly",
		"assignment_history": "none", "routes": "readonly", "staging_routes": "none",
		"route_assessments": "readwrite", "defects": "readwrite", "vehicle_signouts": "readwrite",
		"student_incidents": "readwrite", "hazards": "readwrite", "employees": "none",
		"students": "readonly", "student_absences": "readonly", "schools": "readonly",
		"calendar": "readonly", "vehicles": "readonly", "vehicle_inspections": "readonly",
		"yards": "readonly", "compliance": "none", "time_off": "readwrite",
		"training": "readonly", "expenses": "readwrite", "payroll": "none",
		"biweekly_payroll": "none", "payroll_dept_log": "none", "roles": "none",
		"company_contacts": "readonly", "login_logs": "none", "audit_logs": "none",
		"settings": "none", "external_sync": "none",
	},
	"helper": {
		"dashboard": "none", "dispatch": "readonly", "charter": "none",
		"dispatch_payroll": "none", "dispatch_log": "none", "temporary_assignments": "readonly",
		"assignment_history": "none", "routes": "readonly", "staging_routes": "none",
		"route_assessments": "none", "defects": "none", "vehicle_signouts": "none",
		"student_incidents": "readwrite", "hazards": "readwrite", "employees": "none",
		"students": "readonly", "student_absences": "readonly", "schools": "readonly",
		"calendar": "readonly", "vehicles": "none", "vehicle_inspections": "none",
		"yards": "readonly", "compliance": "none", "time_off": "readwrite",
		"training": "readonly", "expenses": "readwrite", "payroll": "none",
		"biweekly_payroll": "none", "payroll_dept_log": "none", "roles": "none",
		"company_contacts": "readonly", "login_logs": "none", "audit_logs": "none",
		"settings": "none", "external_sync": "none",
	},
}

// ComputeOverrides calculates only the differences between the user's custom page permissions
// and the factory default permissions of their role. If there are no differences, it returns an empty map.
func ComputeOverrides(role string, customPermissions map[string]string) map[string]string {
	if len(customPermissions) == 0 {
		return make(map[string]string)
	}

	normRole := NormalizeRoleName(role)
	defaults, hasDefaults := FactoryRolePermissions[normRole]
	if !hasDefaults {
		defaults = FactoryRolePermissions["driver"]
	}

	diffOverrides := make(map[string]string)
	for module, customVal := range customPermissions {
		customClean := strings.ToLower(strings.TrimSpace(customVal))
		if customClean == "" {
			continue
		}
		defVal := defaults[module]
		if defVal == "" {
			defVal = "none"
		}
		if customClean != defVal {
			diffOverrides[module] = customClean
		}
	}

	return diffOverrides
}

// ComputeEffectivePermissions resolves the user's role and custom page overrides into
// effective permissions, list of allowed modules, read-write modules, read-only modules, and the diff overrides.
func ComputeEffectivePermissions(role string, overrides map[string]string) (
	effective map[string]string,
	allowed []string,
	readWrite []string,
	readOnly []string,
	diffOverrides map[string]string,
) {
	normRole := NormalizeRoleName(role)
	defaults, hasDefaults := FactoryRolePermissions[normRole]
	if !hasDefaults {
		defaults = FactoryRolePermissions["driver"]
	}

	effective = make(map[string]string, len(AllSystemModules))
	diffOverrides = make(map[string]string)
	allowed = make([]string, 0, len(AllSystemModules))
	readWrite = make([]string, 0, len(AllSystemModules))
	readOnly = make([]string, 0, len(AllSystemModules))

	for _, module := range AllSystemModules {
		defVal := defaults[module]
		if defVal == "" {
			defVal = "none"
		}

		perm := defVal
		if overrides != nil {
			if custom, ok := overrides[module]; ok && custom != "" {
				customLower := strings.ToLower(strings.TrimSpace(custom))
				if customLower == "readwrite" || customLower == "readonly" || customLower == "none" {
					perm = customLower
				}
			}
		}

		effective[module] = perm

		if perm != defVal {
			diffOverrides[module] = perm
		}

		if perm == "readwrite" {
			allowed = append(allowed, module)
			readWrite = append(readWrite, module)
		} else if perm == "readonly" {
			allowed = append(allowed, module)
			readOnly = append(readOnly, module)
		}
	}

	return effective, allowed, readWrite, readOnly, diffOverrides
}
