package services

import (
	"crypto"
	"crypto/rsa"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// ErrSNSRejected is returned when an SNS webhook fails host or signature checks.
var ErrSNSRejected = errors.New("sns signature rejected")

var (
	snsCertCache sync.Map
	snsCertMu    sync.Mutex
	snsCertCount int
)

func snsHostAllowed(raw string) bool {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed.User != nil {
		return false
	}
	if !strings.EqualFold(parsed.Scheme, "https") {
		return false
	}
	host := strings.ToLower(parsed.Hostname())
	if host == "" || strings.Contains(host, "\\") {
		return false
	}
	if !strings.HasPrefix(host, "sns.") {
		return false
	}
	return strings.HasSuffix(host, ".amazonaws.com") || strings.HasSuffix(host, ".amazonaws.com.cn")
}

func snsSigningCertAllowed(raw string) bool {
	if !snsHostAllowed(raw) {
		return false
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return false
	}
	return strings.HasSuffix(strings.ToLower(parsed.EscapedPath()), ".pem")
}

func snsStringToSign(sns *SNSInboundPayload) (string, error) {
	switch sns.Type {
	case "Notification":
		var b strings.Builder
		b.WriteString("Message\n")
		b.WriteString(sns.Message)
		b.WriteString("\nMessageId\n")
		b.WriteString(sns.MessageID)
		b.WriteString("\n")
		if sns.Subject != "" {
			b.WriteString("Subject\n")
			b.WriteString(sns.Subject)
			b.WriteString("\n")
		}
		b.WriteString("Timestamp\n")
		b.WriteString(sns.Timestamp)
		b.WriteString("\nTopicArn\n")
		b.WriteString(sns.TopicArn)
		b.WriteString("\nType\n")
		b.WriteString(sns.Type)
		b.WriteString("\n")
		return b.String(), nil
	case "SubscriptionConfirmation", "UnsubscribeConfirmation":
		return strings.Join([]string{
			"Message", sns.Message,
			"MessageId", sns.MessageID,
			"SubscribeURL", sns.SubscribeURL,
			"Timestamp", sns.Timestamp,
			"Token", sns.Token,
			"TopicArn", sns.TopicArn,
			"Type", sns.Type,
		}, "\n") + "\n", nil
	default:
		return "", ErrSNSRejected
	}
}

func verifySNSMessage(client *http.Client, sns *SNSInboundPayload) error {
	if sns == nil || strings.TrimSpace(sns.Signature) == "" || strings.TrimSpace(sns.SigningCertURL) == "" {
		return ErrSNSRejected
	}
	if !snsTimestampFresh(sns.Timestamp) {
		return ErrSNSRejected
	}
	if !snsSigningCertAllowed(sns.SigningCertURL) {
		return ErrSNSRejected
	}
	if sns.Type == "SubscriptionConfirmation" || sns.Type == "UnsubscribeConfirmation" {
		if !snsHostAllowed(sns.SubscribeURL) {
			return ErrSNSRejected
		}
	}
	payload, err := snsStringToSign(sns)
	if err != nil {
		return ErrSNSRejected
	}
	cert, err := snsCertificate(client, sns.SigningCertURL)
	if err != nil {
		return ErrSNSRejected
	}
	pub, ok := cert.PublicKey.(*rsa.PublicKey)
	if !ok {
		return ErrSNSRejected
	}
	sig, err := base64.StdEncoding.DecodeString(sns.Signature)
	if err != nil {
		return ErrSNSRejected
	}
	var digest []byte
	var hash crypto.Hash
	switch sns.SignatureVersion {
	case "", "1":
		sum := sha1.Sum([]byte(payload))
		digest = sum[:]
		hash = crypto.SHA1
	case "2":
		sum := sha256.Sum256([]byte(payload))
		digest = sum[:]
		hash = crypto.SHA256
	default:
		return ErrSNSRejected
	}
	if err := rsa.VerifyPKCS1v15(pub, hash, digest, sig); err != nil {
		return ErrSNSRejected
	}
	return nil
}

func snsTimestampFresh(raw string) bool {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return false
	}
	parsed, err := time.Parse(time.RFC3339Nano, raw)
	if err != nil {
		parsed, err = time.Parse(time.RFC3339, raw)
		if err != nil {
			return false
		}
	}
	delta := time.Since(parsed)
	return delta >= -5*time.Minute && delta <= 15*time.Minute
}

func snsCertificate(client *http.Client, certURL string) (*x509.Certificate, error) {
	if cached, ok := snsCertCache.Load(certURL); ok {
		if cert, ok := cached.(*x509.Certificate); ok {
			return cert, nil
		}
	}
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Get(certURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("sns cert status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, err
	}
	block, _ := pem.Decode(body)
	if block == nil {
		return nil, errors.New("sns cert pem rejected")
	}
	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	if now.Before(cert.NotBefore) || now.After(cert.NotAfter) {
		return nil, errors.New("sns cert is outside its validity window")
	}
	if !snsCertNamesAWS(cert) {
		return nil, errors.New("sns cert subject rejected")
	}
	storeSNSCert(certURL, cert)
	return cert, nil
}

func snsCertNamesAWS(cert *x509.Certificate) bool {
	if cert == nil {
		return false
	}
	if strings.Contains(strings.ToLower(cert.Subject.CommonName), "amazonaws.com") {
		return true
	}
	for _, name := range cert.DNSNames {
		lower := strings.ToLower(name)
		if strings.HasSuffix(lower, ".amazonaws.com") || strings.HasSuffix(lower, ".amazonaws.com.cn") {
			return true
		}
	}
	return false
}

func storeSNSCert(certURL string, cert *x509.Certificate) {
	snsCertMu.Lock()
	defer snsCertMu.Unlock()
	if snsCertCount >= 32 {
		snsCertCache.Range(func(key, _ any) bool {
			snsCertCache.Delete(key)
			return true
		})
		snsCertCount = 0
	}
	if _, loaded := snsCertCache.LoadOrStore(certURL, cert); !loaded {
		snsCertCount++
	}
}
