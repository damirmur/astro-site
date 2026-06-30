package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sort"
	"strings"
	"time"
)

func main() {
	// === ЗАМЕНИТЕ НА ВАШИ ДАННЫЕ ===
	botToken := "ВАШ_ТОКЕН_БОТА_ИЗ_BOTFATHER"
	var myTelegramID int64 = 123456789 // Ваш реальный ID
	firstName := "Dmitry"
	username := "dmyr_astro"
	// ===============================

	authDate := time.Now().Unix()

	dataCheckSlice := []string{
		fmt.Sprintf("auth_date=%d", authDate),
		fmt.Sprintf("first_name=%s", firstName),
		fmt.Sprintf("id=%d", myTelegramID),
	}
	if username != "" {
		dataCheckSlice = append(dataCheckSlice, fmt.Sprintf("username=%s", username))
	}
	sort.Strings(dataCheckSlice)
	dataCheckString := strings.Join(dataCheckSlice, "\n")

	sha := sha256.New()
	sha.Write([]byte(botToken))
	secretKey := sha.Sum(nil)

	mac := hmac.New(sha256.New, secretKey)
	mac.Write([]byte(dataCheckString))
	hash := hex.EncodeToString(mac.Sum(nil))

	fmt.Println("\n=== СКОПИРУЙТЕ ЭТОТ JSON ДЛЯ CURL ===")
	fmt.Printf(`{"id":%d,"first_name":"%s","username":"%s","auth_date":%d,"hash":"%s"}`+"\n\n", 
		myTelegramID, firstName, username, authDate, hash)
}
