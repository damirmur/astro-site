package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	"astro-site/internal/astrology"
	//"astro-site/internal/auth"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"
	"github.com/pocketbase/pocketbase/tools/security"
	"github.com/pocketbase/pocketbase/plugins/ghupdate"
)

type InterpretRequest struct {
	Type    string `json:"type"`     // "natal", "transit", "full"
	NatalID string `json:"natal_id"` // ID натальной карты
}

type TelegramUser map[string]interface{}

// getDefaultSettings возвращает настройки по умолчанию
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
	if err != nil || len(records) == 0 {
		return fallback
	}

	var dbDefault astrology.UserSettings
	if err := records[0].UnmarshalJSONField("settings_data", &dbDefault); err != nil {
		return fallback
	}
	return dbDefault
}

// getAiConfig возвращает конфигурацию ИИ из базы данных
func getAiConfig(app core.App) astrology.AiConfig {
	fallback := astrology.AiConfig{
		Endpoint:     "http://10.66.66",
		ModelID:      "gemma-4-12b-it",
		Temperature:  0.7,
		SystemPrompt: "Ты — опытный астролог-консультант. Твоя задача — давать глубокую, точную и психологичную интерпретацию астрологических данных на русском языке.",
	}

	records, err := app.FindRecordsByFilter("ai_settings", "1=1", "", 1, 0)
	if err != nil || len(records) == 0 {
		return fallback
	}

	var cfg astrology.AiConfig
	if err := records[0].UnmarshalJSONField("config_data", &cfg); err != nil {
		return fallback
	}
	return cfg
}

// checkTelegramAuth проверяет авторизацию через Telegram
func checkTelegramAuth(tgUser TelegramUser, botToken string) (bool, error) {
	// Здесь должна быть реализация проверки Telegram WebApp данных
	// Это упрощенная версия
	if tgUser["id"] == nil {
		return false, fmt.Errorf("user id is required")
	}
	return true, nil
}

func main() {
	app := pocketbase.New()

	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{Automigrate: true})
	ghupdate.MustRegister(app, app.RootCmd, ghupdate.Config{})

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		// Настройка CORS
		se.Router.Bind(apis.CORS(apis.CORSConfig{
			AllowOrigins: []string{"https://astro3d.ru", "http://10.66.66.9:8090", "http://localhost:8090"},
			AllowHeaders: []string{"Content-Type", "Authorization"},
			AllowMethods: []string{"GET", "POST", "PUT", "DELETE"},
		}))

		// 1. Авторизация Telegram
		se.Router.POST("/api/auth/telegram", func(re *core.RequestEvent) error {
			var tgUser TelegramUser
			if err := re.BindBody(&tgUser); err != nil {
				return apis.NewBadRequestError("Неверный формат", err)
			}

			botToken := os.Getenv("TELEGRAM_BOT_TOKEN")
			if botToken == "" {
				return apis.NewBadRequestError("Критическая ошибка: Переменная TELEGRAM_BOT_TOKEN не задана", nil)
			}

			isValid, err := checkTelegramAuth(tgUser, botToken)
			if err != nil || !isValid {
				return apis.NewBadRequestError("Ошибка верификации", err)
			}

			usersCollection, err := re.App.FindCollectionByNameOrId("users")
			if err != nil {
				return apis.NewNotFoundError("Коллекция не найдена", err)
			}

			// Получаем ID пользователя из данных Telegram
			userID, ok := tgUser["id"].(float64)
			if !ok {
				return apis.NewBadRequestError("Неверный формат ID пользователя", nil)
			}

			tgUsername := "tg_" + strconv.FormatInt(int64(userID), 10)
			userRecord, err := re.App.FindFirstRecordByData("users", "username", tgUsername)

			if err != nil {
				// Создаем нового пользователя
				firstName, _ := tgUser["first_name"].(string)
				userRecord = core.NewRecord(usersCollection)
				userRecord.Set("username", tgUsername)
				userRecord.Set("name", firstName)
				userRecord.SetPassword(security.RandomString(32))
				if err := re.App.Save(userRecord); err != nil {
					return apis.NewBadRequestError("Ошибка создания пользователя", err)
				}
			}

			return apis.RecordAuthResponse(re, userRecord, "", nil)
		})

		// 2. Получение настроек пользователя
		se.Router.GET("/api/astrology/settings", func(re *core.RequestEvent) error {
			authRecord := re.Auth
			if authRecord == nil {
				return apis.NewUnauthorizedError("Неавторизован", nil)
			}

			record, err := re.App.FindFirstRecordByData("user_settings", "user", authRecord.Id)
			if err != nil {
				// Возвращаем настройки по умолчанию
				return re.JSON(200, getDefaultSettings(re.App))
			}

			var settings astrology.UserSettings
			if err := record.UnmarshalJSONField("settings_data", &settings); err != nil {
				return apis.NewBadRequestError("Ошибка парсинга настроек", err)
			}

			return re.JSON(200, settings)
		})

		// 3. Сохранение настроек пользователя
		se.Router.POST("/api/astrology/settings", func(re *core.RequestEvent) error {
			authRecord := re.Auth
			if authRecord == nil {
				return apis.NewUnauthorizedError("Неавторизован", nil)
			}

			var incomingSettings astrology.UserSettings
			if err := re.BindBody(&incomingSettings); err != nil {
				return apis.NewBadRequestError("Неверный формат данных", err)
			}

			settingsColl, err := re.App.FindCollectionByNameOrId("user_settings")
			if err != nil {
				return apis.NewNotFoundError("Коллекция не найдена", err)
			}

			record, err := re.App.FindFirstRecordByData("user_settings", "user", authRecord.Id)
			if err != nil {
				record = core.NewRecord(settingsColl)
				record.Set("user", authRecord.Id)
			}

			record.Set("settings_data", incomingSettings)
			if err := re.App.Save(record); err != nil {
				return apis.NewBadRequestError("Не удалось сохранить настройки", err)
			}

			return re.JSON(200, map[string]string{"status": "success"})
		})

		// 4. Расчет натальной карты
		se.Router.GET("/api/astrology/chart", func(re *core.RequestEvent) error {
			authRecord := re.Auth
			if authRecord == nil {
				return apis.NewUnauthorizedError("Неавторизован", nil)
			}

			dateStr := re.Request.URL.Query().Get("date")
			latStr := re.Request.URL.Query().Get("lat")
			lonStr := re.Request.URL.Query().Get("lon")
			title := re.Request.URL.Query().Get("title")

			// Получаем настройки пользователя или используем дефолтные
			currentSettings := getDefaultSettings(re.App)
			userSettingsRecord, err := re.App.FindFirstRecordByData("user_settings", "user", authRecord.Id)
			if err == nil {
				var us astrology.UserSettings
				if err := userSettingsRecord.UnmarshalJSONField("settings_data", &us); err == nil {
					currentSettings = us
				}
			}

			if title == "" {
				title = "Natal"
			}

			// Парсим дату и координаты
			t, err := time.Parse(time.RFC3339, dateStr)
			if err != nil {
				t = time.Now()
			}

			lat, _ := strconv.ParseFloat(latStr, 64)
			lon, _ := strconv.ParseFloat(lonStr, 64)

			// Создаем калькулятор
			calc := astrology.NewCalculator("./ephe")
			defer calc.Close()

			// Вычисляем натальную карту
			result, err := calc.ComputeNatal(context.Background(), t, lat, lon, currentSettings.Houses, currentSettings)
			if err != nil {
				return apis.NewBadRequestError("Ошибка расчета натальной карты", err)
			}

			// Сохраняем в базу данных
			horoscopesColl, err := re.App.FindCollectionByNameOrId("horoscopes")
			if err == nil {
				newHoroscope := core.NewRecord(horoscopesColl)
				newHoroscope.Set("user", authRecord.Id)
				newHoroscope.Set("title", title)
				newHoroscope.Set("event_date", t.Format(time.RFC3339))
				newHoroscope.Set("astrological_data", result)
				newHoroscope.Set("interpretation", "Натал")
				if err := re.App.Save(newHoroscope); err != nil {
					// Логируем ошибку, но продолжаем работу
					log.Printf("Ошибка сохранения натальной карты: %v", err)
				}
			}

			return re.JSON(200, result)
		})

		// 5. Расчет транзитов
		se.Router.GET("/api/astrology/transit", func(re *core.RequestEvent) error {
			authRecord := re.Auth
			if authRecord == nil {
				return apis.NewUnauthorizedError("Неавторизован", nil)
			}

			natalID := re.Request.URL.Query().Get("natal_id")
			var natalRecord *core.Record
			var err error

			if natalID != "" {
				natalRecord, err = re.App.FindRecordById("horoscopes", natalID)
			} else {
				records, err := re.App.FindRecordsByFilter(
					"horoscopes",
					"user = '"+authRecord.Id+"'",
					"-created",
					1,
					0,
				)
				if err == nil && len(records) > 0 {
					natalRecord = records[0]
				}
			}

			if err != nil || natalRecord == nil {
				return apis.NewBadRequestError("Натальная карта не найдена", nil)
			}

			var natalChart astrology.AstroResult
			if err := natalRecord.UnmarshalJSONField("astrological_data", &natalChart); err != nil {
				return apis.NewBadRequestError("Ошибка чтения натальной карты", err)
			}

			// Получаем настройки пользователя
			currentSettings := getDefaultSettings(re.App)
			userSettingsRecord, err := re.App.FindFirstRecordByData("user_settings", "user", authRecord.Id)
			if err == nil {
				var us astrology.UserSettings
				if err := userSettingsRecord.UnmarshalJSONField("settings_data", &us); err == nil {
					currentSettings = us
				}
			}

			// Вычисляем транзиты
			transitTime := time.Now()
			calc := astrology.NewCalculator("./ephe")
			defer calc.Close()

			transitResult, err := calc.ComputeTransit(
				context.Background(),
				transitTime,
				natalChart.Planets,
				natalChart.Houses,
				currentSettings.Houses,
				currentSettings,
			)
			if err != nil {
				return apis.NewBadRequestError("Ошибка расчета транзитов", err)
			}

			return re.JSON(200, transitResult)
		})

		// 6. Интерпретация с динамическими настройками из базы данных ai_settings
		se.Router.POST("/api/astrology/interpret", func(re *core.RequestEvent) error {
			authRecord := re.Auth
			if authRecord == nil {
				return apis.NewUnauthorizedError("Неавторизован", nil)
			}

			var body InterpretRequest
			if err := re.BindBody(&body); err != nil {
				return apis.NewBadRequestError("Неверный формат запроса", err)
			}

			if body.NatalID == "" {
				return apis.NewBadRequestError("Не передан natal_id натальной карты", nil)
			}

			// Получаем натальную карту
			natalRecord, err := re.App.FindRecordById("horoscopes", body.NatalID)
			if err != nil {
				return apis.NewBadRequestError("Натальная карта не найдена в БД", nil)
			}

			var natalData astrology.AstroResult
			if err := natalRecord.UnmarshalJSONField("astrological_data", &natalData); err != nil {
				return apis.NewBadRequestError("Ошибка чтения натальных данных", err)
			}

			// Выгружаем конфигурацию ИИ
			aiConfig := getAiConfig(re.App)
			var userPrompt string

			switch body.Type {
			case "natal":
				rawJson, _ := json.Marshal(natalData)
				userPrompt = fmt.Sprintf(
					"Сделай полный психологический разбор натальной карты рождения. Вот входные данные планет, их абсолютных градусов, номеров домов и аспектов в формате JSON:\n%s\n\nОпиши ядро личности (Солнце, Луна) и разбери ключевые мажорные аспекты между личными планетами.",
					string(rawJson),
				)

			case "transit":
				currentSettings := getDefaultSettings(re.App)
				calc := astrology.NewCalculator("./ephe")
				defer calc.Close()

				transitResult, err := calc.ComputeTransit(
					context.Background(),
					time.Now(),
					natalData.Planets,
					natalData.Houses,
					currentSettings.Houses,
					currentSettings,
				)
				if err != nil {
					return apis.NewBadRequestError("Ошибка расчета транзитов", err)
				}

				rawJson, _ := json.Marshal(transitResult)
				userPrompt = fmt.Sprintf(
					"Проанализируй текущую транзитную астрологическую обстановку на небе. Вот JSON с текущими координатами планет и их касаниями (аспектами) к карте рождения:\n%s\n\nДай прогноз: какие энергии сейчас активны на небе и как они влияют на общее состояние.",
					string(rawJson),
				)

			case "full":
				currentSettings := getDefaultSettings(re.App)
				calc := astrology.NewCalculator("./ephe")
				defer calc.Close()

				transitResult, err := calc.ComputeTransit(
					context.Background(),
					time.Now(),
					natalData.Planets,
					natalData.Houses,
					currentSettings.Houses,
					currentSettings,
				)
				if err != nil {
					return apis.NewBadRequestError("Ошибка расчета транзитов", err)
				}

				userPrompt = fmt.Sprintf(
					"Дай развернутый предсказательный анализ. Проанализируй транзитные планеты, которые вошли в конкретные дома натальной карты и делают аспекты к радикалу.\n\nНатальные планеты (координаты рождения):\n%+v\n\nТранзитные планеты (их текущее положение в натальных домах и аспекты к ним):\n%+v\n\nОпиши, какие сферы жизни (дома) сейчас активированы транзитом и какие события или психологические состояния это несет.",
					natalData.Planets,
					transitResult,
				)

			default:
				return apis.NewBadRequestError("Неизвестный тип интерпретации", nil)
			}

			// Вызываем ИИ
			aiResponse, err := astrology.AskGemma(context.Background(), aiConfig, userPrompt)
			if err != nil {
				return apis.NewBadRequestError(fmt.Sprintf("Ошибка нейросети: %v", err), err)
			}

			return re.JSON(200, map[string]string{
				"type":           body.Type,
				"interpretation": aiResponse,
			})
		})

		// Статические файлы
		se.Router.GET("/{path...}", apis.Static(os.DirFS("./pb_public"), true))

		return se.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
