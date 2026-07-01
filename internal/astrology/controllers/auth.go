package controllers

import (
	"strconv"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/tools/security"
)

func HandleTelegramAuth(re *core.RequestEvent) error {
	var tgUser map[string]any
	if err := re.BindBody(&tgUser); err != nil {
		return apis.NewBadRequestError("Неверный формат", err)
	}
	
	usersCollection, err := re.App.FindCollectionByNameOrId("users")
	if err != nil {
		return apis.NewNotFoundError("Коллекция не найдена", err)
	}

	var tgID int64
	if idFloat, ok := tgUser["id"].(float64); ok {
		tgID = int64(idFloat)
	}
	if tgID == 0 {
		return apis.NewBadRequestError("Не удалось получить ID", nil)
	}

	tgUsername := "tg_" + strconv.FormatInt(tgID, 10)
	userRecord, err := re.App.FindFirstRecordByData("users", "username", tgUsername)

	if err != nil {
		firstName, _ := tgUser["first_name"].(string)
		userRecord = core.NewRecord(usersCollection)
		userRecord.Set("username", tgUsername)
		userRecord.Set("name", firstName)
		userRecord.SetPassword(security.RandomString(32)) 
		if err := re.App.Save(userRecord); err != nil {
			return apis.NewBadRequestError("Ошибка создания", err)
		}
	}
	return apis.RecordAuthResponse(re, userRecord, "", nil)
}
