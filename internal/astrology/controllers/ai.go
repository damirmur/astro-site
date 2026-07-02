package controllers

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"astro-site/internal/astrology/models"
	"astro-site/internal/astrology/swissephe"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"

)

func HandleAiInterpretation(re *core.RequestEvent, defaultSettings swissephe.UserSettings, aiFallback models.AiConfig) error {
	authRecord := re.Auth
	if authRecord == nil { return apis.NewUnauthorizedError("Неавторизован", nil) }

	var body models.InterpretRequest
	if err := re.BindBody(&body); err != nil { return apis.NewBadRequestError("Некорректное тело", err) }
	if body.NatalID == "" { return apis.NewBadRequestError("Отсутствует natal_id", nil) }

	natalRecord, err := re.App.FindRecordById("horoscopes", body.NatalID)
	if err != nil { return apis.NewBadRequestError("Гороскоп не найден", err) }
	
	var natalData swissephe.AstroResult
	natalRecord.UnmarshalJSONField("astrological_data", &natalData)

	aiConfig := aiFallback
	aiRecords, err := re.App.FindRecordsByFilter("ai_settings", "1=1", "", 1, 0)
	if err == nil && len(aiRecords) > 0 {
		aiRecords[0].UnmarshalJSONField("config_data", &aiConfig)
	}

	userPrompt := ""

	switch body.Type {
	case "natal":
		rawJson, _ := json.Marshal(natalData)
		userPrompt = models.GetPromptText(re.App, "natal", map[string]string{"{{.Data}}": string(rawJson)})
		
	case "transit":
		currentSettings := defaultSettings
		calc := swissephe.NewCalculator("./ephe")
		defer calc.Close()
		transitResult, _ := calc.ComputeTransit(context.Background(), time.Now(), natalData.Planets, natalData.Houses, currentSettings.Houses, currentSettings)
		
		rawJson, _ := json.Marshal(transitResult)
		userPrompt = models.GetPromptText(re.App, "transit", map[string]string{"{{.Data}}": string(rawJson)})

	case "full":
		currentSettings := defaultSettings
		calc := swissephe.NewCalculator("./ephe")
		defer calc.Close()
		transitResult, _ := calc.ComputeTransit(context.Background(), time.Now(), natalData.Planets, natalData.Houses, currentSettings.Houses, currentSettings)

		natalJson, _ := json.Marshal(natalData.Planets)
		transitJson, _ := json.Marshal(transitResult)
		userPrompt = models.GetPromptText(re.App, "full", map[string]string{
			"{{.NatalPl}}":   string(natalJson),
			"{{.TransitPl}}": string(transitJson),
		})
	default:
		return apis.NewBadRequestError("Неизвестный тип", nil)
	}

	aiResponse, err := models.AskGemma(context.Background(), aiConfig, userPrompt)
	if err != nil { return apis.NewBadRequestError(fmt.Sprintf("Ошибка ИИ: %v", err), err) }

	return re.JSON(200, map[string]string{
		"type":           body.Type,
		"interpretation": aiResponse,
	})
}
