package models

import (
	"hash/fnv"
	"strconv"
	"strings"
)

// PayrollAssigneeLookupID is the integer id used by route payroll rates.
// A stored employeeId wins. Otherwise a numeric employee number is used.
// Non-numeric numbers share the same hash as the payroll lookup list.
func PayrollAssigneeLookupID(storedEmployeeID int, documentID, employeeNumber string) int {
	if storedEmployeeID > 0 {
		return storedEmployeeID
	}
	if n := NumericPayrollToken(employeeNumber); n > 0 {
		return n
	}
	if n := NumericPayrollToken(documentID); n > 0 {
		return n
	}
	documentID = strings.TrimSpace(documentID)
	employeeNumber = strings.TrimSpace(employeeNumber)
	if documentID == "" && employeeNumber == "" {
		return 0
	}
	hasher := fnv.New32a()
	_, _ = hasher.Write([]byte(documentID + "|" + employeeNumber))
	return int(hasher.Sum32()%800000) + 100001
}

func NumericPayrollToken(raw string) int {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0
	}
	if len(raw) > 4 && strings.EqualFold(raw[:4], "EMP-") {
		raw = strings.TrimSpace(raw[4:])
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return 0
	}
	return n
}
