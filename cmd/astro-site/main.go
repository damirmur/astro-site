package main

import (
	"log"

	"astro-site/internal/astrology"
	"astro-site/internal/astrology/models"
	"astro-site/internal/astrology/swissephe"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"
	"github.com/pocketbase/pocketbase/plugins/ghupdate"
)

func main() {
	app := pocketbase.New()

	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{Automigrate: true})
	ghupdate.MustRegister(app, app.RootCmd, ghupdate.Config{})

	defaultSettings := swissephe.UserSettings{
		Planets:    []string{"0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "12"},
		Aspects:    []string{"0", "60", "90", "120", "180"},
		TransitOrb: "1", Houses: "P", Rotate: "0", Direction: "clockwise", TZ: "Asia/Yekaterinburg", Locale: "ru-RU", City: "Orenburg", Latitude: 51.73, Longitude: 55.10,
		NatalOrb:   map[string]int{"0": 10, "1": 9, "2": 7, "3": 7, "4": 7, "5": 6, "6": 6, "7": 5, "8": 5, "9": 5, "10": 5, "12": 3},
	}
	
	aiFallback := models.AiConfig{
		Endpoint: "http://10.66.66", ModelID: "gemma-4-12b-it", Temperature: 0.7,
		SystemPrompt: "You are an experienced astrologer, psychologist, and consultant. Your task is to provide a deep, accurate, and psychological interpretation of astrological data in Russian.",
	}

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.Bind(apis.CORS(apis.CORSConfig{
			AllowOrigins: []string{"https://astro3d.ru", "http://10.66.66.9:8090", "http://localhost:8090"},
			AllowHeaders: []string{"Content-Type", "Authorization"},
			AllowMethods: []string{"GET", "POST", "PUT", "DELETE"},
		}))

		astrology.RegisterAstrologyRoutes(se, defaultSettings, aiFallback)
		return se.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
