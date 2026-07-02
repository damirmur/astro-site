package controllers

import (
	"astro-site/internal/astrology/swissephe"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

func HandleGetSettings(re *core.RequestEvent, defaultSettings swissephe.UserSettings) error {
	authRecord := re.Auth
	if authRecord == nil { return apis.NewUnauthorizedError("Неавторизован", nil) }
	record, err := re.App.FindFirstRecordByData("user_settings", "user", authRecord.Id)
	if err != nil { return re.JSON(200, defaultSettings) }
	var settings swissephe.UserSettings
	if err := record.UnmarshalJSONField("settings_data", &settings); err != nil { return apis.NewBadRequestError("Ошибка парсинга", err) }
	return re.JSON(200, settings)
}

func HandleSaveSettings(re *core.RequestEvent) error {
	authRecord := re.Auth
	if authRecord == nil { return apis.NewUnauthorizedError("Неавторизован", nil) }
	var incomingSettings swissephe.UserSettings
	if err := re.BindBody(&incomingSettings); err != nil { return apis.NewBadRequestError("Неверный формат", err) }
	settingsColl, err := re.App.FindCollectionByNameOrId("user_settings")
	if err != nil { return apis.NewNotFoundError("Коллекция не найдена", err) }
	record, err := re.App.FindFirstRecordByData("user_settings", "user", authRecord.Id)
	if err != nil {
		record = core.NewRecord(settingsColl)
		record.Set("user", authRecord.Id)
	}
	record.Set("settings_data", incomingSettings)
	if err := re.App.Save(record); err != nil { return apis.NewBadRequestError("Не удалось сохранить", err) }
	return re.JSON(200, map[string]string{"status": "success"})
}
