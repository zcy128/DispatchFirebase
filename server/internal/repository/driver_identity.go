package repository

import (
	"strconv"
	"strings"
)

// DriverIdentitiesOverlap reports whether two driver identifiers are the same person.
// Employee number 001 and EMP-001 match. The published demo login
// (driver1d / EMP-2001) also matches the route stored as EMP-001.
func DriverIdentitiesOverlap(a, b string) bool {
	left := strings.TrimSpace(a)
	right := strings.TrimSpace(b)
	if left == "" || right == "" {
		return false
	}
	if strings.EqualFold(left, right) {
		return true
	}
	if demoDriverAlias(left) && demoDriverAlias(right) {
		return true
	}
	leftNo, leftOK := bareEmployeeNumber(left)
	rightNo, rightOK := bareEmployeeNumber(right)
	return leftOK && rightOK && leftNo == rightNo
}

func demoDriverAlias(raw string) bool {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "driver1d", "driver1", "drv-1021", "emp-2001", "emp-001":
		return true
	default:
		return false
	}
}

func bareEmployeeNumber(raw string) (int, bool) {
	s := strings.ToLower(strings.TrimSpace(raw))
	s = strings.TrimPrefix(s, "emp-")
	s = strings.TrimPrefix(s, "drv-")
	if s == "" {
		return 0, false
	}
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0, false
		}
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return 0, false
	}
	return n, true
}

func matchesPersonQuery(query, id, name string) bool {
	q := strings.TrimSpace(query)
	if q == "" {
		return true
	}
	if DriverIdentitiesOverlap(q, id) {
		return true
	}
	qLower := strings.ToLower(q)
	if id != "" && strings.Contains(strings.ToLower(id), qLower) {
		return true
	}
	if name != "" && strings.Contains(strings.ToLower(name), qLower) {
		return true
	}
	if name != "" && strings.Contains(qLower, strings.ToLower(strings.TrimSpace(name))) {
		return true
	}
	return false
}
