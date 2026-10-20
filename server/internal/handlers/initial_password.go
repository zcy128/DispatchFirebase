package handlers

import (
	"crypto/rand"
	"math/big"
)

const demoInitialPassword = "Dispatch2026!"

func provisionPassword(allowDemo bool) string {
	if allowDemo {
		return demoInitialPassword
	}
	return randomPassword()
}

func randomPassword() string {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
	buf := make([]byte, 16)
	for i := range buf {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(alphabet))))
		if err != nil {
			buf[i] = alphabet[i%len(alphabet)]
			continue
		}
		buf[i] = alphabet[n.Int64()]
	}
	return string(buf) + "aA1!"
}
