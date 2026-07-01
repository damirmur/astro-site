package main

import (
	"context"
	"log"
	"os"
	"strconv"
	"time"

	"astro-site/internal/astrology"
	"astro-site/internal/auth"

        "github.com/pocketbase/pocketbase"
        "github.com/pocketbase/pocketbase/apis"
        "github.com/pocketbase/pocketbase/core"
        "github.com/pocketbase/pocketbase/plugins/ghupdate"
        "github.com/pocketbase/pocketbase/plugins/migratecmd"
        "github.com/pocketbase/pocketbase/tools/security"
)

func getDefaultSettings(app core.App) astrology.UserSettings {
	fallback := astrology.UserSettings{
		Planets:    []string{"0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "12"},
		Aspects:    []string{"0", "72", "90", "120", "180"},
		TransitOrb: "1",
		Houses:     "P",
		Rotate:     "0",
		Direction:  "clockwise",
		TZ:         "Asia/Yekaterinburg",
		Locale:     "ru-RU",
		City:       "Orenburg",
		Latitude:   51.73,
		Longitude:  55.10,
		NatalOrb:   map[string]int{"0": 10, "1": 9, "2": 7, "3": 7, "4": 7, "5": 6, "6": 6, "7": 5, "8": 5, "9": 5, "10": 5, "12": 3},
	}
	records, err := app.FindRecordsByFilter("default_settings", "1=1", "", 1, 0)
	if err != nil || len(records) == 0 { return fallback }
	
	var dbDefault astrology.UserSettings
	// ИСПРАВЛЕНО: обращаемся к первому элементу слайса records[0]
	if err := records[0].UnmarshalJSONField("settings_data", &dbDefault); err != nil { return fallback }
	return dbDefault
}

func main() {
	app := pocketbase.New()

	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{Automigrate: true})
	ghupdate.MustRegister(app, app.RootCmd, ghupdate.Config{})

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		
		se.Router.Bind(apis.CORS(apis.CORSConfig{
			AllowOrigins: []string{"https://astro3d.ru", "http://10.66.66.9:8090", "http://localhost:8090"},
			AllowHeaders: []string{"Content-Type", "Authorization"},
			AllowMethods: []string{"GET", "POST", "PUT", "DELETE"},
		}))

		// 1. Авторизация Telegram
		se.Router.POST("/api/auth/telegram", func(re *core.RequestEvent) error {
			var tgUser auth.TelegramUser
			if err := re.BindBody(&tgUser); err != nil { return apis.NewBadRequestError("Неверный формат", err) }

			botToken := os.Getenv("TELEGRAM_BOT_TOKEN")
			if botToken == "" {
				return apis.NewBadRequestError("Критическая ошибка: Переменная TELEGRAM_BOT_TOKEN не задана на сервере", nil)
			}

			isValid, err := auth.CheckTelegramAuth(tgUser, botToken)
			if err != nil || !isValid { return apis.NewBadRequestError("Ошибка верификации Telegram хэша", err) }

			usersCollection, err := re.App.FindCollectionByNameOrId("users")
			if err != nil { return apis.NewNotFoundError("Коллекция не найдена", err) }

			var tgID int64
			if idFloat, ok := tgUser["id"].(float64); ok {
				tgID = int64(idFloat)
			} else if idInt, ok := tgUser["id"].(int64); ok {
				tgID = idInt
			}

			if tgID == 0 {
				return apis.NewBadRequestError("Не удалось получить ID пользователя от Telegram", nil)
			}

			tgUsername := "tg_" + strconv.FormatInt(tgID, 10)
			userRecord, err := re.App.FindFirstRecordByData("users", "username", tgUsername)

			if err != nil {
				firstName, _ := tgUser["first_name"].(string)
				userRecord = core.NewRecord(usersCollection)
				userRecord.Set("username", tgUsername)
				userRecord.Set("name", firstName)
				userRecord.SetPassword(security.RandomString(32)) 
				if err := re.App.Save(userRecord); err != nil { return apis.NewBadRequestError("Ошибка создания", err) }
			}
			return apis.RecordAuthResponse(re, userRecord, "", nil)
		})

		// 2. Получение настроек
		se.Router.GET("/api/astrology/settings", func(re *core.RequestEvent) error {
			authRecord := re.Auth
			if authRecord == nil { return apis.NewUnauthorizedError("Неавторизован", nil) }
			record, err := re.App.FindFirstRecordByData("user_settings", "user", authRecord.Id)
			if err != nil { return re.JSON(200, getDefaultSettings(re.App)) }
			var settings astrology.UserSettings
			if err := record.UnmarshalJSONField("settings_data", &settings); err != nil {
				return apis.NewBadRequestError("Ошибка парсинга", err)
			}
			return re.JSON(200, settings)
		})

		// 3. Сохранение настроек
		se.Router.POST("/api/astrology/settings", func(re *core.RequestEvent) error {
			authRecord := re.Auth
			if authRecord == nil { return apis.NewUnauthorizedError("Неавторизован", nil) }
			var incomingSettings astrology.UserSettings
			if err := re.BindBody(&incomingSettings); err != nil { return apis.NewBadRequestError("Неверный формат", err) }
			settingsColl, err := re.App.FindCollectionByNameOrId("user_settings")
			if err != nil { return apis.NewNotFoundError("Коллекция не найдена", err) }
			record, err := re.App.FindFirstRecordByData("user_settings", "user", authRecord.Id)
			if err != nil { record = core.NewRecord(settingsColl); record.Set("user", authRecord.Id) }
			record.Set("settings_data", incomingSettings)
			if err := re.App.Save(record); err != nil { return apis.NewBadRequestError("Не удалось сохранить", err) }
			return re.JSON(200, map[string]string{"status": "success"})
		})

		// 4. Натальная карта
		se.Router.GET("/api/astrology/chart", func(re *core.RequestEvent) error {
			authRecord := re.Auth
			if authRecord == nil { return apis.NewUnauthorizedError("Неавторизован", nil) }
			dateStr := re.Request.URL.Query().Get("date")
			latStr := re.Request.URL.Query().Get("lat")
			lonStr := re.Request.URL.Query().Get("lon")
			title := re.Request.URL.Query().Get("title") 

			currentSettings := getDefaultSettings(re.App)
			userSettingsRecord, err := re.App.FindFirstRecordByData("user_settings", "user", authRecord.Id)
			if err == nil {
				var us astrology.UserSettings
				if err := userSettingsRecord.UnmarshalJSONField("settings_data", &us); err == nil { currentSettings = us }
			}

			if title == "" { title = "Natal" }
			t, err := time.Parse(time.RFC3339, dateStr)
			if err != nil { t = time.Now() }
			lat, _ := strconv.ParseFloat(latStr, 64)
			lon, _ := strconv.ParseFloat(lonStr, 64)

			calc := astrology.NewCalculator("./ephe")
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
		})

		// 5. Расчет транзитов
		se.Router.GET("/api/astrology/transit", func(re *core.RequestEvent) error {
			authRecord := re.Auth
			if authRecord == nil { return apis.NewUnauthorizedError("Неавторизован", nil) }

			natalRecords, err := re.App.FindRecordsByFilter("horoscopes", "user = '" + authRecord.Id + "' && title = 'Natal'", "-created", 1, 0)
			if err != nil || len(natalRecords) == 0 {
				return apis.NewBadRequestError("Сначала рассчитайте вашу натальную карту (/api/astrology/chart)", nil)
			}

			var natalChart astrology.AstroResult
			// ИСПРАВЛЕНО: обращаемся к первому элементу слайса natalRecords[0]
			if err := natalRecords[0].UnmarshalJSONField("astrological_data", &natalChart); err != nil {
				return apis.NewBadRequestError("Ошибка чтения натала", err)
			}

			currentSettings := getDefaultSettings(re.App)
			userSettingsRecord, err := re.App.FindFirstRecordByData("user_settings", "user", authRecord.Id)
			if err == nil {
				var us astrology.UserSettings
				if err := userSettingsRecord.UnmarshalJSONField("settings_data", &us); err == nil { currentSettings = us }
			}

			transitTime := time.Now()

			calc := astrology.NewCalculator("./ephe")
			defer calc.Close()

			transitResult, err := calc.ComputeTransit(context.Background(), transitTime, natalChart.Planets, currentSettings)
			if err != nil { return apis.NewBadRequestError("Ошибка транзита", err) }

			horoscopesColl, err := re.App.FindCollectionByNameOrId("horoscopes")
			if err == nil {
				newTransitRec := core.NewRecord(horoscopesColl)
				newTransitRec.Set("user", authRecord.Id)
				newTransitRec.Set("title", "Transit Today")
				newTransitRec.Set("event_date", transitTime.Format(time.RFC3339))
				newTransitRec.Set("astrological_data", transitResult)
				newTransitRec.Set("interpretation", "Текущие транзиты")
				re.App.Save(newTransitRec)
			}

			return re.JSON(200, transitResult)
		})

		se.Router.GET("/{path...}", apis.Static(os.DirFS("./pb_public"), true))
		
		return se.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
