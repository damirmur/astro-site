package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sort"
	"strings"
)

type TelegramUser struct {
	ID        int64  `json:"id"`
	FirstName string `json:"first_name"`
	Username  string `json:"username"`
	AuthDate  int64  `json:"auth_date"`
	Hash      string `json:"hash"`
}

func CheckTelegramAuth(user TelegramUser, botToken string) (bool, error) {
	dataCheckSlice := []string{
		fmt.Sprintf("auth_date=%d", user.AuthDate),
		fmt.Sprintf("first_name=%s", user.FirstName),
		fmt.Sprintf("id=%d", user.ID),
	}
	if user.Username != "" {
		dataCheckSlice = append(dataCheckSlice, fmt.Sprintf("username=%s", user.Username))
	}
	sort.Strings(dataCheckSlice)
	dataCheckString := strings.Join(dataCheckSlice, "\n")

	sha := sha256.New()
	sha.Write([]byte(botToken))
	secretKey := sha.Sum(nil)

	mac := hmac.New(sha256.New, secretKey)
	mac.Write([]byte(dataCheckString))
	expectedHash := hex.EncodeToString(mac.Sum(nil))

	// ВРЕМЕННЫЙ ЛОГ: выводим в консоль сервера то, что ожидает бэкенд
	fmt.Printf("\n[DEBUG TG] Ожидаемый хэш: %s\n", expectedHash)

	return expectedHash == user.Hash, nil
}
