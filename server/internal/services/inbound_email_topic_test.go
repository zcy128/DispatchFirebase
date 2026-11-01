package services

import (
	"testing"
	"time"

	"dispatch-server/internal/config"
)

func TestSNSTopicAllowed(t *testing.T) {
	cfg := &config.Config{SNSTopicARNs: []string{"arn:aws:sns:ca-central-1:123:inbound-email"}}
	if !snsTopicAllowed(cfg, "arn:aws:sns:ca-central-1:123:inbound-email") {
		t.Fatal("listed topic was rejected")
	}
	if snsTopicAllowed(cfg, "arn:aws:sns:us-east-1:999:other") {
		t.Fatal("unlisted topic was accepted")
	}
	if snsTopicAllowed(cfg, "  ") {
		t.Fatal("blank topic was accepted")
	}
	if snsTopicAllowed(nil, "arn:aws:sns:ca-central-1:123:inbound-email") {
		t.Fatal("missing config was accepted")
	}
	if snsTopicAllowed(&config.Config{}, "arn:aws:sns:ca-central-1:123:inbound-email") {
		t.Fatal("empty allowlist was accepted")
	}
}

func TestSNSTimestampFresh(t *testing.T) {
	if !snsTimestampFresh(time.Now().UTC().Format(time.RFC3339)) {
		t.Fatal("current timestamp was rejected")
	}
	if snsTimestampFresh(time.Now().Add(-16 * time.Minute).UTC().Format(time.RFC3339)) {
		t.Fatal("stale timestamp was accepted")
	}
	if snsTimestampFresh(time.Now().Add(6 * time.Minute).UTC().Format(time.RFC3339)) {
		t.Fatal("future timestamp was accepted")
	}
	if snsTimestampFresh("") {
		t.Fatal("blank timestamp was accepted")
	}
	if snsTimestampFresh("yesterday") {
		t.Fatal("invalid timestamp was accepted")
	}
}
