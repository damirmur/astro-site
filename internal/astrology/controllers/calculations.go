package controllers

import (
	"context"
	"strconv"
	"time"

	"astro-site/internal/astrology/models"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/apis"
)

func HandleComputeNatal(re *core.RequestEvent, defaultSettings models.UserSettings) error {
	authRecord := re.Auth
	if authRecord == nil { return apis.NewUnauthorizedError("Неавторизован", nil) }
	dateStr := re.Request.URL.Query().Get("date")
	latStr := re.Request.URL.Query().Get("lat")
	lonStr := re.Request.URL.Query().Get("lon")
	title := re.Request.URL.Query().Get("title") 

	currentSettings := defaultSettings
	userSettingsRecord, err := re.App.FindFirstRecordByData("user_settings", "user", authRecord.Id)
	if err == nil {
		var us models.UserSettings
		if err := userSettingsRecord.UnmarshalJSONField("settings_data", &us); err == nil { currentSettings = us }
	}

	if title == "" { title = "Natal" }
	t, err := time.Parse(time.RFC3339, dateStr)
	if err != nil { t = time.Now() }
	lat, _ := strconv.ParseFloat(latStr, 64)
	lon, _ := strconv.ParseFloat(lonStr, 64)

	// Вызов конструктора калькулятора напрямую из пакета моделей
	calc := models.NewCalculator("./ephe")
	defer calc.Close()

	result, err := calc.ComputeNatal(context.Background(), t, lat, lon, currentSettings.Houses, currentSettings)
	if err != nil { return apis.NewBadRequestError("Ошибка расчета", err) }

	horoscopesColl, err := re.App.FindCollectionByNameOrId("horoscopes")
	if err == nil {
		newHoroscope := core.NewRecord(horoscopesColl)
		newHoroscope.Set("user", authRecord.Id)          
		newHoroscope.Set("title", title)                 
		newHoroscope.Set("event_date", t.Format(time.RFC3339)) 
		newHoroscope.Set("astrological_data", result)    
		newHoroscope.Set("interpretation", "Натал") 
		re.App.Save(newHoroscope)
	}
	return re.JSON(200, result)
}

func HandleComputeTransit(re *core.RequestEvent, defaultSettings models.UserSettings) error {
	authRecord := re.Auth
	if authRecord == nil { return apis.NewUnauthorizedError("Неавторизован", nil) }

	natalID := re.Request.URL.Query().Get("natal_id")
	var natalRecord *core.Record
	var err error

	if natalID != "" {
		natalRecord, err = re.App.FindRecordById("horoscopes", natalID)
	} else {
		var records []*core.Record
		records, err = re.App.FindRecordsByFilter("horoscopes", "user = '"+authRecord.Id+"'", "-created", 1, 0)
		if len(records) > 0 { natalRecord = records[0] }
	}

	if err != nil || natalRecord == nil { return apis.NewBadRequestError("Натальная карта не найдена.", nil) }

	var natalChart models.AstroResult
	if err := natalRecord.UnmarshalJSONField("astrological_data", &natalChart); err != nil { return apis.NewBadRequestError("Ошибка чтения натала", err) }

	currentSettings := defaultSettings
	userSettingsRecord, err := re.App.FindFirstRecordByData("user_settings", "user", authRecord.Id)
	if err == nil {
		var us models.UserSettings
		if err := userSettingsRecord.UnmarshalJSONField("settings_data", &us); err == nil { currentSettings = us }
	}

	transitTime := time.Now()
	calc := models.NewCalculator("./ephe")
	defer calc.Close()

	transitResult, err := calc.ComputeTransit(context.Background(), transitTime, natalChart.Planets, natalChart.Houses, currentSettings.Houses, currentSettings)
	if err != nil { return apis.NewBadRequestError("Ошибка транзита", err) }

	return re.JSON(200, transitResult)
}
