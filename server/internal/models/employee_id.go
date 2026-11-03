package models

import (
	"strconv"
	"strings"
)

// EmployeeIDAliases returns the stored spellings of one employee identifier.
// "EMP-001", "emp-001", and "001" are the same person. Names are returned unchanged.
func EmployeeIDAliases(raw string) []string {
	t := strings.TrimSpace(raw)
	if t == "" {
		return nil
	}
	low := strings.ToLower(t)
	if low == "0" || low == "tbd" || low == "unassigned" || low == "non assigné" {
		return nil
	}

	seen := map[string]bool{}
	var list []string
	add := func(v string) {
		if v == "" || seen[v] {
			return
		}
		seen[v] = true
		list = append(list, v)
	}
	add(t)
	add(low)

	bare := strings.TrimPrefix(strings.ToUpper(t), "EMP-")
	bare = strings.TrimPrefix(bare, "DRV-")
	if !isAllDigits(bare) {
		return list
	}
	n, err := strconv.Atoi(bare)
	if err != nil {
		return list
	}
	padded := strconv.Itoa(n)
	if n < 1000 {
		padded = leftPad3(n)
	}
	add(padded)
	add(strconv.Itoa(n))
	add("EMP-" + padded)
	add("emp-" + padded)
	add("EMP-" + strconv.Itoa(n))
	add("emp-" + strconv.Itoa(n))
	return list
}

func isAllDigits(s string) bool {
	if s == "" {
		return false
	}
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

func leftPad3(n int) string {
	s := strconv.Itoa(n)
	for len(s) < 3 {
		s = "0" + s
	}
	return s
}
