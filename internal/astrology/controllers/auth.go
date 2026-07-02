package controllers

import (
	"encoding/json"
	"strconv"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/tools/security"
)

// AuthProvider тип провайдера
type AuthProvider string

const (
	ProviderTelegram AuthProvider = "telegram"
	ProviderVK       AuthProvider = "vk"
)

// UserData структура данных пользователя
type UserData struct {
	Provider   AuthProvider
	ProviderID string
	Email      string
	Username   string
	FirstName  string
	LastName   string
	Avatar     string
}

// LinkedAccount связанный аккаунт
type LinkedAccount struct {
	Provider   string `json:"provider"`
	ProviderID string `json:"providerId"`
	LinkedAt   string `json:"linkedAt"`
}

// HandleAuth универсальный обработчик
func HandleAuth(re *core.RequestEvent) error {
	var request struct {
		Provider string         `json:"provider"`
		Data     map[string]any `json:"data"`
	}

	if err := re.BindBody(&request); err != nil {
		return apis.NewBadRequestError("Неверный формат запроса", err)
	}

	// Парсим данные в зависимости от провайдера
	var userData UserData
	switch request.Provider {
	case "telegram":
		userData = parseTelegramData(request.Data)
	case "vk":
		userData = parseVKData(request.Data)
	default:
		return apis.NewBadRequestError("Неподдерживаемый провайдер: "+request.Provider, nil)
	}

	// Проверяем обязательные поля
	if userData.ProviderID == "" {
		return apis.NewBadRequestError("Не удалось получить ID пользователя", nil)
	}

	// Ищем или создаем пользователя
	userRecord, err := findOrCreateUser(re, userData)
	if err != nil {
		return err
	}

	return apis.RecordAuthResponse(re, userRecord, "", nil)
}

// parseTelegramData парсит Telegram данные
func parseTelegramData(data map[string]any) UserData {
	var tgID int64
	if idFloat, ok := data["id"].(float64); ok {
		tgID = int64(idFloat)
	}

	firstName, _ := data["first_name"].(string)
	lastName, _ := data["last_name"].(string)
	username, _ := data["username"].(string)
	photoURL, _ := data["photo_url"].(string)

	return UserData{
		Provider:   ProviderTelegram,
		ProviderID: strconv.FormatInt(tgID, 10),
		Email:      strconv.FormatInt(tgID, 10) + "@telegram.user",
		Username:   username,
		FirstName:  firstName,
		LastName:   lastName,
		Avatar:     photoURL,
	}
}

// parseVKData парсит VK данные
func parseVKData(data map[string]any) UserData {
	// VK Mini Apps передает данные в параметре 'user'
	var userData map[string]any
	if user, ok := data["user"].(map[string]any); ok {
		userData = user
	} else {
		userData = data
	}

	// Получаем VK ID
	var vkID string
	if id, ok := userData["id"].(float64); ok {
		vkID = strconv.FormatInt(int64(id), 10)
	} else if id, ok := userData["user_id"].(float64); ok {
		vkID = strconv.FormatInt(int64(id), 10)
	}

	firstName, _ := userData["first_name"].(string)
	lastName, _ := userData["last_name"].(string)
	username, _ := userData["screen_name"].(string)
	photoURL, _ := userData["photo_200"].(string)
	email, _ := userData["email"].(string)

	// Если email не передан, генерируем
	if email == "" && vkID != "" {
		email = vkID + "@vk.user"
	}

	return UserData{
		Provider:   ProviderVK,
		ProviderID: vkID,
		Email:      email,
		Username:   username,
		FirstName:  firstName,
		LastName:   lastName,
		Avatar:     photoURL,
	}
}

// findOrCreateUser ищет или создает пользователя
func findOrCreateUser(re *core.RequestEvent, userData UserData) (*core.Record, error) {
	app := re.App

	// 1. Ищем по provider ID
	var userRecord *core.Record
	var err error

	switch userData.Provider {
	case ProviderTelegram:
		userRecord, err = app.FindFirstRecordByData("users", "telegramId", userData.ProviderID)
	case ProviderVK:
		userRecord, err = app.FindFirstRecordByData("users", "vkId", userData.ProviderID)
	}

	if err == nil && userRecord != nil {
		// Нашли пользователя - обновляем данные
		return updateUser(re, userRecord, userData)
	}

	// 2. Ищем по email (если есть)
	if userData.Email != "" {
		userRecord, err = app.FindFirstRecordByData("users", "email", userData.Email)
		if err == nil && userRecord != nil {
			// Нашли по email - привязываем новый провайдер
			return linkProvider(re, userRecord, userData)
		}
	}

	// 3. Ищем по username (если есть)
	if userData.Username != "" {
		userRecord, err = app.FindFirstRecordByData("users", "username", userData.Username)
		if err == nil && userRecord != nil {
			// Нашли по username - привязываем новый провайдер
			return linkProvider(re, userRecord, userData)
		}
	}

	// 4. Создаем нового пользователя
	return createUser(re, userData)
}

// linkProvider привязывает новый провайдер к существующему пользователю
func linkProvider(re *core.RequestEvent, record *core.Record, userData UserData) (*core.Record, error) {
	// Проверяем, не привязан ли уже этот провайдер
	linkedAccounts := getLinkedAccounts(record)
	for _, acc := range linkedAccounts {
		if acc.Provider == string(userData.Provider) && acc.ProviderID == userData.ProviderID {
			// Уже привязан - просто обновляем
			return updateUser(re, record, userData)
		}
	}

	// Добавляем новый провайдер
	newAccount := LinkedAccount{
		Provider:   string(userData.Provider),
		ProviderID: userData.ProviderID,
		LinkedAt:   time.Now().Format(time.RFC3339),
	}
	linkedAccounts = append(linkedAccounts, newAccount)

	// Сохраняем в JSON
	accountsJSON, _ := json.Marshal(linkedAccounts)
	record.Set("linkedAccounts", string(accountsJSON))

	// Сохраняем ID провайдера
	switch userData.Provider {
	case ProviderTelegram:
		record.Set("telegramId", userData.ProviderID)
	case ProviderVK:
		record.Set("vkId", userData.ProviderID)
	}

	// Обновляем остальные данные
	record = updateUserData(record, userData)

	if err := re.App.Save(record); err != nil {
		return nil, apis.NewBadRequestError("Ошибка привязки: "+err.Error(), err)
	}

	return record, nil
}

// createUser создает нового пользователя
func createUser(re *core.RequestEvent, userData UserData) (*core.Record, error) {
	usersCollection, err := re.App.FindCollectionByNameOrId("users")
	if err != nil {
		return nil, apis.NewNotFoundError("Коллекция не найдена", err)
	}

	record := core.NewRecord(usersCollection)

	// Генерируем email если его нет
	email := userData.Email
	if email == "" {
		email = userData.ProviderID + "@" + string(userData.Provider) + ".user"
	}

	// Генерируем username если его нет
	username := userData.Username
	if username == "" {
		username = string(userData.Provider) + "_" + userData.ProviderID
	}

	// Создаем запись о связанном аккаунте
	linkedAccount := LinkedAccount{
		Provider:   string(userData.Provider),
		ProviderID: userData.ProviderID,
		LinkedAt:   time.Now().Format(time.RFC3339),
	}
	linkedAccounts := []LinkedAccount{linkedAccount}
	accountsJSON, _ := json.Marshal(linkedAccounts)

	// Устанавливаем поля
	record.Set("email", email)
	record.Set("username", username)
	record.Set("name", userData.FirstName+" "+userData.LastName)
	record.Set("avatar", userData.Avatar)
	record.Set("linkedAccounts", string(accountsJSON))
	record.Set("lastLogin", time.Now())
	record.SetPassword(security.RandomString(32))

	// Устанавливаем ID провайдера
	switch userData.Provider {
	case ProviderTelegram:
		record.Set("telegramId", userData.ProviderID)
	case ProviderVK:
		record.Set("vkId", userData.ProviderID)
	}

	if err := re.App.Save(record); err != nil {
		return nil, apis.NewBadRequestError("Ошибка создания: "+err.Error(), err)
	}

	return record, nil
}

// updateUser обновляет существующего пользователя
func updateUser(re *core.RequestEvent, record *core.Record, userData UserData) (*core.Record, error) {
	record = updateUserData(record, userData)

	if err := re.App.Save(record); err != nil {
		return nil, apis.NewBadRequestError("Ошибка обновления: "+err.Error(), err)
	}

	return record, nil
}

// updateUserData обновляет поля пользователя
func updateUserData(record *core.Record, userData UserData) *core.Record {
	if userData.FirstName != "" || userData.LastName != "" {
		newName := userData.FirstName
		if userData.LastName != "" {
			newName += " " + userData.LastName
		}
		if record.GetString("name") != newName {
			record.Set("name", newName)
		}
	}

	if userData.Avatar != "" && record.GetString("avatar") != userData.Avatar {
		record.Set("avatar", userData.Avatar)
	}

	if userData.Username != "" && record.GetString("username") != userData.Username {
		record.Set("username", userData.Username)
	}

	record.Set("lastLogin", time.Now())

	return record
}

// getLinkedAccounts возвращает список связанных аккаунтов
func getLinkedAccounts(record *core.Record) []LinkedAccount {
	var accounts []LinkedAccount
	accountsJSON := record.GetString("linkedAccounts")
	if accountsJSON != "" {
		json.Unmarshal([]byte(accountsJSON), &accounts)
	}
	return accounts
}
