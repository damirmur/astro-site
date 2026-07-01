package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sort"
	"strings"
)

// Универсальная структура для приема любых полей от виджета Telegram
type TelegramUser map[string]any

func CheckTelegramAuth(user TelegramUser, botToken string) (bool, error) {
	// Извлекаем хэш, который прислал Telegram
	receivedHash, ok := user["hash"].(string)
	if !ok || receivedHash == "" {
		return false, fmt.Errorf("hash is missing")
	}

	// Собираем все ключи, кроме hash, в алфавитном порядке
	var keys []string
	for k := range user {
		if k != "hash" && user[k] != nil {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)

	// Формируем проверочную строку по правилам Telegram: key=value\n
	var dataCheckSlice []string
	for _, k := range keys {
		val := user[k]
		// Приводим интерфейс к строке в зависимости от типа (число или строка)
		var valStr string
		switch v := val.(type) {
		case string:
			valStr = v
		case float64:
			// JSON числа распарсиваются в Go как float64
			valStr = fmt.Sprintf("%.0f", v)
		case int64:
			valStr = fmt.Sprintf("%d", v)
		default:
			valStr = fmt.Sprintf("%v", v)
		}
		dataCheckSlice = append(dataCheckSlice, fmt.Sprintf("%s=%s", k, valStr))
	}
	dataCheckString := strings.Join(dataCheckSlice, "\n")

	// Генерируем секретный ключ на основе Bot Token
	sha := sha256.New()
	sha.Write([]byte(botToken))
	secretKey := sha.Sum(nil)

	// Вычисляем HMAC-SHA256
	mac := hmac.New(sha256.New, secretKey)
	mac.Write([]byte(dataCheckString))
	expectedHash := hex.EncodeToString(mac.Sum(nil))

	// Возвращаем результат строгого сравнения
	return expectedHash == receivedHash, nil
}


